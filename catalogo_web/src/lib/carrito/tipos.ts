export type TipoLinea = 'producto' | 'extra' | 'personalizado'

/** Un extra agregado a una línea armada por el cliente. */
export interface ExtraDeLinea {
  extraId: number
  nombre: string
  /** precio de referencia por unidad; el monto real lo recalcula la base */
  precio: number
  cantidad: number
}

/** Una línea del carrito, tal como vive en el navegador. */
export interface LineaCarrito {
  /** clave estable para React y para sumar cantidades */
  clave: string
  tipo: TipoLinea
  /** id del producto, del extra o del envoltorio según el tipo */
  referenciaId: number
  nombre: string
  /** precio de referencia; el monto real lo recalcula la base al crear el pedido */
  precio: number
  cantidad: number
  imagen: string | null
  dedicatoria?: string
  /** solo en líneas personalizadas: qué se le puso al envoltorio */
  extras?: ExtraDeLinea[]
}

export interface EstadoCarrito {
  lineas: LineaCarrito[]
}

export const CARRITO_VACIO: EstadoCarrito = { lineas: [] }

export function claveLinea(tipo: TipoLinea, id: number): string {
  return `${tipo}:${id}`
}

/**
 * Dos ramos armados iguales son la misma línea (se suman las cantidades); si
 * cambia el envoltorio o cualquier extra, es una línea distinta.
 */
export function clavePersonalizado(
  envoltorioId: number,
  extras: ExtraDeLinea[],
): string {
  const receta = [...extras]
    .sort((a, b) => a.extraId - b.extraId)
    .map((e) => `${e.extraId}x${e.cantidad}`)
    .join(',')
  return `personalizado:${envoltorioId}:${receta}`
}

export function claveDeLinea(
  linea: Pick<LineaCarrito, 'tipo' | 'referenciaId' | 'extras'>,
): string {
  return linea.tipo === 'personalizado'
    ? clavePersonalizado(linea.referenciaId, linea.extras ?? [])
    : claveLinea(linea.tipo, linea.referenciaId)
}

export function totalCarrito(lineas: LineaCarrito[]): number {
  return lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0)
}

export function cantidadTotal(lineas: LineaCarrito[]): number {
  return lineas.reduce((suma, l) => suma + l.cantidad, 0)
}
