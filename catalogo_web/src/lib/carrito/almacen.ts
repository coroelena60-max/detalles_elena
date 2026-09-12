import {
  claveDeLinea,
  claveLinea,
  type ExtraDeLinea,
  type LineaCarrito,
  type TipoLinea,
} from './tipos'

/**
 * Almacén externo del carrito.
 *
 * Se implementa como store para leerlo con useSyncExternalStore: así el
 * contenido guardado en localStorage se hidrata sin llamar a setState dentro
 * de un efecto (que provoca renders en cascada).
 *
 * El carrito vive solo en el navegador de quien compra: no viaja al servidor
 * ni se comparte entre dispositivos. Si el storage está bloqueado (modo
 * privado), todo sigue funcionando en memoria durante la visita.
 */

const CLAVE_STORAGE = 'detalles-elena:carrito:v1'
const VACIO: LineaCarrito[] = []

let lineas: LineaCarrito[] | null = null
const suscriptores = new Set<() => void>()

function esExtraDeLinea(valor: unknown): valor is ExtraDeLinea {
  if (typeof valor !== 'object' || valor === null) return false
  const e = valor as Record<string, unknown>
  return (
    typeof e.extraId === 'number' &&
    typeof e.nombre === 'string' &&
    typeof e.precio === 'number' &&
    typeof e.cantidad === 'number' &&
    e.cantidad > 0
  )
}

function esLinea(valor: unknown): valor is LineaCarrito {
  if (typeof valor !== 'object' || valor === null) return false
  const l = valor as Record<string, unknown>
  const tipoValido =
    l.tipo === 'producto' || l.tipo === 'extra' || l.tipo === 'personalizado'
  if (!tipoValido) return false
  // una línea armada por el cliente siempre lleva su receta de extras
  if (l.tipo === 'personalizado') {
    if (!Array.isArray(l.extras) || !l.extras.every(esExtraDeLinea)) return false
  } else if (l.extras !== undefined) {
    if (!Array.isArray(l.extras) || !l.extras.every(esExtraDeLinea)) return false
  }
  return (
    typeof l.clave === 'string' &&
    typeof l.referenciaId === 'number' &&
    typeof l.nombre === 'string' &&
    typeof l.precio === 'number' &&
    typeof l.cantidad === 'number' &&
    l.cantidad > 0
  )
}

function leerStorage(): LineaCarrito[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_STORAGE)
    if (!crudo) return VACIO
    const datos: unknown = JSON.parse(crudo)
    if (!Array.isArray(datos)) return VACIO
    const validas = datos.filter(esLinea)
    return validas.length > 0 ? validas : VACIO
  } catch {
    return VACIO
  }
}

function guardarStorage(valor: LineaCarrito[]) {
  try {
    window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(valor))
  } catch {
    /* storage bloqueado: el carrito sigue en memoria */
  }
}

function avisar() {
  for (const s of suscriptores) s()
}

function escribir(siguiente: LineaCarrito[]) {
  lineas = siguiente
  guardarStorage(siguiente)
  avisar()
}

export function suscribir(callback: () => void): () => void {
  suscriptores.add(callback)
  return () => {
    suscriptores.delete(callback)
  }
}

/** Snapshot para el cliente. Lee el storage una sola vez y lo cachea. */
export function obtenerSnapshot(): LineaCarrito[] {
  if (lineas === null) lineas = leerStorage()
  return lineas
}

/** En el servidor el carrito siempre arranca vacío (no hay storage). */
export function obtenerSnapshotServidor(): LineaCarrito[] {
  return VACIO
}

export function agregarLinea(
  linea: Omit<LineaCarrito, 'clave' | 'cantidad'>,
  cantidad = 1,
) {
  const actuales = obtenerSnapshot()
  const clave = claveDeLinea(linea)
  const existente = actuales.find((l) => l.clave === clave)
  escribir(
    existente
      ? actuales.map((l) =>
          l.clave === clave
            ? { ...l, cantidad: Math.min(99, l.cantidad + cantidad) }
            : l,
        )
      : [...actuales, { ...linea, clave, cantidad }],
  )
}

export function cambiarCantidadLinea(clave: string, cantidad: number) {
  const actuales = obtenerSnapshot()
  escribir(
    cantidad <= 0
      ? actuales.filter((l) => l.clave !== clave)
      : actuales.map((l) =>
          l.clave === clave ? { ...l, cantidad: Math.min(99, cantidad) } : l,
        ),
  )
}

export function quitarLinea(clave: string) {
  escribir(obtenerSnapshot().filter((l) => l.clave !== clave))
}

export function vaciarCarrito() {
  escribir(VACIO)
}

export function cantidadDeLinea(tipo: TipoLinea, id: number): number {
  return (
    obtenerSnapshot().find((l) => l.clave === claveLinea(tipo, id))?.cantidad ?? 0
  )
}
