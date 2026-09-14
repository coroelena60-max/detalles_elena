'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icono from '@/components/Icono'
import { revisarArchivo, subirConPermiso } from '@/lib/subidaFirmada'
import { TIPOS_IMAGEN, type TipoImagen } from '@/lib/tipoImagen'
import { guardarProducto, prepararSubidaFoto, registrarFoto } from '../acciones'
import { claseChip, type OpcionesFormulario } from '../FormularioProducto'

const PASOS = ['Foto', 'Datos', 'Publicar'] as const

/**
 * Alta de producto en tres pasos: la foto primero (es lo que la persona tiene
 * en la mano), después nombre, precio y categoría, y al final si se muestra.
 * Lo técnico (envoltorio, minutos, orden, stock mínimo) queda para la ficha,
 * en "Más opciones". Al guardar: se crea el producto y recién ahí se sube la
 * foto, porque la ruta del archivo lleva el código que genera la base.
 */
export default function AsistenteProducto({ opciones }: { opciones: OpcionesFormulario }) {
  const router = useRouter()
  const [paso, setPaso] = useState(0)
  const [foto, setFoto] = useState<{ archivo: File; tipo: TipoImagen; vista: string } | null>(null)
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [categoriaId, setCategoriaId] = useState<number>(opciones.categorias[0]?.id ?? 0)
  const [descripcion, setDescripcion] = useState('')
  const [publicar, setPublicar] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creadoId, setCreadoId] = useState<number | null>(null)

  // liberar la vista previa cuando se cambia la foto o se sale de la pantalla
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.vista) }, [foto])

  async function elegirFoto(archivo: File) {
    setError(null)
    const revision = await revisarArchivo(archivo)
    if (!revision.ok) {
      setError(revision.mensaje)
      return
    }
    setFoto({ archivo, tipo: revision.tipo, vista: URL.createObjectURL(archivo) })
  }

  const precioNumero = Number(precio.replace(',', '.'))
  const datosListos = nombre.trim().length >= 3 && precio !== '' && Number.isFinite(precioNumero) && precioNumero >= 0 && categoriaId > 0

  async function guardar() {
    setError(null)
    let id = creadoId
    if (id === null) {
      setGuardando('Guardando el producto…')
      const r = await guardarProducto({
        nombre,
        descripcion,
        categoriaId,
        envoltorioId: null,
        precio: precioNumero,
        precioDesde: false,
        estado: publicar ? 'activo' : 'borrador',
        destacado: false,
        orden: 0,
        leadTimeDias: null,
        minutosArmado: null,
        stockMinimo: 0,
      })
      if (!r.ok) {
        setGuardando(null)
        setError(r.mensaje)
        return
      }
      id = r.id
      setCreadoId(r.id)
    }

    if (foto) {
      setGuardando('Subiendo la foto…')
      const permiso = await prepararSubidaFoto(id, foto.tipo)
      const fallo = !permiso.ok
        ? permiso.mensaje
        : (await subirConPermiso(permiso.ruta, permiso.token, foto.archivo, foto.tipo)) ??
          (await registrarFoto(id, permiso.ruta, nombre).then((r) => (r.ok ? null : r.mensaje)))
      if (fallo) {
        setGuardando(null)
        setError(`El producto se guardó, pero la foto no se pudo subir: ${fallo}`)
        return
      }
    }

    router.push(`/productos/${id}?nuevo=1`)
  }

  return (
    <div className="tarjeta mt-5 p-5 sm:p-6">
      {/* indicador de pasos */}
      <ol className="flex items-center gap-2">
        {PASOS.map((titulo, i) => (
          <li key={titulo} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full text-base font-semibold ${
                i < paso ? 'bg-ok text-white' : i === paso ? 'bg-rosa-600 text-white' : 'bg-fondo text-tinta-suave'
              }`}
            >
              {i < paso ? <Icono nombre="listo" className="size-5" /> : i + 1}
            </span>
            <span className={`text-sm ${i === paso ? 'font-semibold' : 'hidden text-tinta-suave sm:inline'}`}>{titulo}</span>
            {i < PASOS.length - 1 && <span className="h-0.5 flex-1 rounded bg-linea" />}
          </li>
        ))}
      </ol>

      {/* ---------- 1. Foto ---------- */}
      {paso === 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Elegí la foto del ramo</h2>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-rosa-300 bg-rosa-50 text-rosa-700 transition hover:bg-rosa-100">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image
              <img src={foto.vista} alt="Vista previa" className="max-h-80 w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 py-14">
                <Icono nombre="camara" className="size-12" />
                <span className="text-lg font-semibold">Tocá para elegir una foto</span>
              </span>
            )}
            <input
              type="file"
              accept={Object.keys(TIPOS_IMAGEN).join(',')}
              className="sr-only"
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                if (archivo) void elegirFoto(archivo)
                e.target.value = ''
              }}
            />
          </label>
          {foto && <p className="mt-2 text-center text-sm text-tinta-suave">Tocá la foto para cambiarla.</p>}
        </div>
      )}

      {/* ---------- 2. Datos ---------- */}
      {paso === 1 && (
        <div className="mt-6 space-y-5">
          <h2 className="text-xl font-semibold">¿Cómo se llama y cuánto cuesta?</h2>
          <div>
            <label htmlFor="a-nombre" className="block text-sm font-medium">Nombre</label>
            <input id="a-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Ramo de 5 rosas" autoFocus className="campo mt-1 text-lg focus:campo-foco" />
          </div>
          <div>
            <label htmlFor="a-precio" className="block text-sm font-medium">Precio (Bs)</label>
            <input id="a-precio" type="number" min="0" step="0.01" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" className="campo mt-1 max-w-48 text-lg focus:campo-foco" />
          </div>
          <div>
            <span className="block text-sm font-medium">Categoría</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {opciones.categorias.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoriaId(c.id)} aria-pressed={categoriaId === c.id} className={claseChip(categoriaId === c.id)}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="a-desc" className="block text-sm font-medium">
              Descripción <span className="font-normal text-tinta-suave">(opcional)</span>
            </label>
            <textarea id="a-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="campo mt-1 focus:campo-foco" />
          </div>
        </div>
      )}

      {/* ---------- 3. Publicar ---------- */}
      {paso === 2 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">¿Lo mostramos en el catálogo?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setPublicar(true)} aria-pressed={publicar} className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition ${publicar ? 'border-rosa-600 bg-rosa-50 text-rosa-700' : 'border-linea hover:border-rosa-300'}`}>
              <Icono nombre="ver" className="size-8" />
              <span className="text-lg font-semibold">Sí, mostrarlo</span>
              <span className="text-sm text-tinta-suave">Los clientes ya lo pueden pedir</span>
            </button>
            <button type="button" onClick={() => setPublicar(false)} aria-pressed={!publicar} className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition ${!publicar ? 'border-rosa-600 bg-rosa-50 text-rosa-700' : 'border-linea hover:border-rosa-300'}`}>
              <Icono nombre="ocultar" className="size-8" />
              <span className="text-lg font-semibold">Todavía no</span>
              <span className="text-sm text-tinta-suave">Queda guardado, sin mostrarse</span>
            </button>
          </div>

          <div className="mt-5 flex items-center gap-4 rounded-xl bg-fondo p-3">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
              <img src={foto.vista} alt="" className="size-16 rounded-lg object-cover" />
            ) : (
              <span className="grid size-16 place-items-center rounded-lg bg-rosa-50 text-2xl text-rosa-300">❀</span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{nombre}</p>
              <p className="text-tinta-suave">
                Bs {precio} · {opciones.categorias.find((c) => c.id === categoriaId)?.nombre}
              </p>
            </div>
          </div>
          {!foto && publicar && (
            <p className="mt-3 flex items-center gap-2 text-sm text-aviso">
              <Icono nombre="alerta" className="size-4" />
              Sin foto, en el catálogo se ve una flor dibujada.
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-lg bg-alerta-suave px-3 py-2 text-alerta">{error}</p>}

      {/* ---------- botones de abajo ---------- */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-5">
        {paso > 0 ? (
          <button type="button" onClick={() => { setError(null); setPaso(paso - 1) }} disabled={guardando !== null} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-tinta-suave transition hover:bg-fondo">
            <Icono nombre="atras" />
            Atrás
          </button>
        ) : (
          <span />
        )}

        {paso === 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {!foto && (
              <button type="button" onClick={() => setPaso(1)} className="text-sm text-tinta-suave underline-offset-2 hover:underline">
                Seguir sin foto
              </button>
            )}
            <button type="button" onClick={() => setPaso(1)} disabled={!foto} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-rosa-600 px-6 text-base font-semibold text-white transition hover:bg-rosa-700 disabled:opacity-40">
              Siguiente
              <Icono nombre="siguiente" />
            </button>
          </div>
        )}
        {paso === 1 && (
          <button type="button" onClick={() => setPaso(2)} disabled={!datosListos} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-rosa-600 px-6 text-base font-semibold text-white transition hover:bg-rosa-700 disabled:opacity-40">
            Siguiente
            <Icono nombre="siguiente" />
          </button>
        )}
        {paso === 2 && (
          <button type="button" onClick={() => void guardar()} disabled={guardando !== null} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-rosa-600 px-6 text-base font-semibold text-white transition hover:bg-rosa-700 disabled:opacity-60">
            <Icono nombre="listo" />
            {guardando ?? 'Guardar producto'}
          </button>
        )}
      </div>

      {creadoId !== null && error && (
        <p className="mt-3 text-right">
          <a href={`/productos/${creadoId}`} className="text-sm font-medium text-rosa-700 hover:underline">
            Ir al producto y subir la foto desde ahí
          </a>
        </p>
      )}
    </div>
  )
}
