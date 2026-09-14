'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Icono, { type NombreIcono } from '@/components/Icono'
import { bs } from '@/lib/formato'
import type { Database } from '@/types/database'
import { guardarProducto, type DatosProducto } from './acciones'

type EstadoPublicacion = Database['public']['Enums']['estado_publicacion']

export interface OpcionesFormulario {
  categorias: { id: number; nombre: string }[]
  envoltorios: { id: number; nombre: string; espacios: number | null; precio_base: number }[]
}

/**
 * Los cinco estados de la base se muestran como tres decisiones simples.
 * "De temporada" es una casilla dentro de "Más opciones" y "Sin publicar"
 * (borrador) se conserva si el producto nunca salió al catálogo.
 */
type Visibilidad = 'catalogo' | 'agotado' | 'oculto'

function visibilidadDe(estado: EstadoPublicacion): Visibilidad {
  if (estado === 'activo' || estado === 'temporada') return 'catalogo'
  if (estado === 'agotado') return 'agotado'
  return 'oculto'
}

const VISIBILIDAD: { valor: Visibilidad; etiqueta: string; icono: NombreIcono }[] = [
  { valor: 'catalogo', etiqueta: 'En el catálogo', icono: 'ver' },
  { valor: 'agotado', etiqueta: 'Agotado', icono: 'alerta' },
  { valor: 'oculto', etiqueta: 'Oculto', icono: 'ocultar' },
]

export function claseChip(activo: boolean) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
    activo
      ? 'border-rosa-600 bg-rosa-50 text-rosa-700'
      : 'border-linea bg-white text-tinta-suave hover:border-rosa-300 hover:text-tinta'
  }`
}

export default function FormularioProducto({
  inicial,
  opciones,
  puedeEditar,
}: {
  inicial: DatosProducto & { id: number }
  opciones: OpcionesFormulario
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [d, setD] = useState<DatosProducto>(inicial)

  const envoltorio = opciones.envoltorios.find((e) => e.id === d.envoltorioId)
  const visibilidad = visibilidadDe(d.estado)

  function elegirVisibilidad(v: Visibilidad) {
    const estado: EstadoPublicacion =
      v === 'agotado'
        ? 'agotado'
        : v === 'catalogo'
          ? inicial.estado === 'temporada' ? 'temporada' : 'activo'
          : inicial.estado === 'borrador' ? 'borrador' : 'inactivo'
    setD({ ...d, estado })
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    iniciar(async () => {
      const r = await guardarProducto(d)
      setAviso({ ok: r.ok, texto: r.ok ? 'Cambios guardados.' : r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  const campo = 'campo mt-1 focus:campo-foco'
  const etiqueta = 'block text-sm font-medium'
  const numeroOVacio = (valor: string) => (valor === '' ? null : Number(valor))

  return (
    <form onSubmit={enviar} className="tarjeta p-5">
      <fieldset disabled={!puedeEditar || pendiente} className="space-y-5">
        <div>
          <label htmlFor="nombre" className={etiqueta}>Nombre</label>
          <input
            id="nombre"
            value={d.nombre}
            onChange={(e) => setD({ ...d, nombre: e.target.value })}
            required
            minLength={3}
            className={`${campo} text-lg`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="precio" className={etiqueta}>Precio (Bs)</label>
            <input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={d.precio}
              onChange={(e) => setD({ ...d, precio: Number(e.target.value) })}
              required
              className={`${campo} text-lg`}
            />
          </div>
          <div>
            <span className={etiqueta}>Categoría</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {opciones.categorias.map((c) => (
                <button key={c.id} type="button" onClick={() => setD({ ...d, categoriaId: c.id })} aria-pressed={d.categoriaId === c.id} className={claseChip(d.categoriaId === c.id)}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className={etiqueta}>¿Se ve en el catálogo?</span>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {VISIBILIDAD.map((v) => (
              <button key={v.valor} type="button" onClick={() => elegirVisibilidad(v.valor)} aria-pressed={visibilidad === v.valor} className={claseChip(visibilidad === v.valor)}>
                <Icono nombre={v.icono} />
                {v.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="descripcion" className={etiqueta}>
            Descripción <span className="font-normal text-tinta-suave">(opcional)</span>
          </label>
          <textarea
            id="descripcion"
            rows={3}
            value={d.descripcion}
            onChange={(e) => setD({ ...d, descripcion: e.target.value })}
            className={campo}
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-linea px-3 py-2">
          <input
            type="checkbox"
            checked={d.destacado}
            onChange={(e) => setD({ ...d, destacado: e.target.checked })}
            className="size-5 accent-rosa-600"
          />
          <Icono nombre="estrella" className="size-5 text-rosa-600" />
          Mostrarlo en la portada del catálogo
        </label>

        <details className="group rounded-xl border border-linea">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-tinta-suave [&::-webkit-details-marker]:hidden">
            Más opciones
            <Icono nombre="siguiente" className="size-4 rotate-90 transition group-open:-rotate-90" />
          </summary>
          <div className="grid gap-4 border-t border-linea p-3 sm:grid-cols-2">
            <div>
              <label htmlFor="envoltorio" className={etiqueta}>Envoltorio</label>
              <select
                id="envoltorio"
                value={d.envoltorioId ?? ''}
                onChange={(e) => setD({ ...d, envoltorioId: e.target.value ? Number(e.target.value) : null })}
                className={campo}
              >
                <option value="">Sin envoltorio</option>
                {opciones.envoltorios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} · {bs(e.precio_base)}
                  </option>
                ))}
              </select>
              {envoltorio?.espacios != null && (
                <p className="mt-1 text-sm text-tinta-suave">Entran {envoltorio.espacios} lugares de flores.</p>
              )}
            </div>
            <div>
              <label htmlFor="lead" className={etiqueta}>Días para tenerlo listo</label>
              <input id="lead" type="number" min="0" value={d.leadTimeDias ?? ''} onChange={(e) => setD({ ...d, leadTimeDias: numeroOVacio(e.target.value) })} className={campo} />
            </div>
            <div>
              <label htmlFor="minutos" className={etiqueta}>Minutos que lleva armarlo</label>
              <input id="minutos" type="number" min="0" value={d.minutosArmado ?? ''} onChange={(e) => setD({ ...d, minutosArmado: numeroOVacio(e.target.value) })} className={campo} />
            </div>
            <div>
              <label htmlFor="orden" className={etiqueta}>Posición en el catálogo</label>
              <input id="orden" type="number" value={d.orden} onChange={(e) => setD({ ...d, orden: Number(e.target.value) })} className={campo} />
            </div>
            <div>
              <label htmlFor="stock" className={etiqueta}>Avisar cuando queden menos de</label>
              <input id="stock" type="number" min="0" value={d.stockMinimo} onChange={(e) => setD({ ...d, stockMinimo: Number(e.target.value) })} className={campo} />
            </div>
            <div className="space-y-2 self-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.precioDesde} onChange={(e) => setD({ ...d, precioDesde: e.target.checked })} className="size-5 accent-rosa-600" />
                Mostrar «desde Bs {d.precio || 0}»
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.estado === 'temporada'}
                  disabled={visibilidad !== 'catalogo'}
                  onChange={(e) => setD({ ...d, estado: e.target.checked ? 'temporada' : 'activo' })}
                  className="size-5 accent-rosa-600"
                />
                Es de temporada
              </label>
            </div>
          </div>
        </details>
      </fieldset>

      {aviso && (
        <p role="status" className={`mt-4 rounded-lg px-3 py-2 ${aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'}`}>
          {aviso.texto}
        </p>
      )}

      {puedeEditar ? (
        <button
          type="submit"
          disabled={pendiente}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rosa-600 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-rosa-700 disabled:opacity-60 sm:w-auto sm:px-8"
        >
          <Icono nombre="listo" />
          {pendiente ? 'Guardando…' : 'Guardar cambios'}
        </button>
      ) : (
        <p className="mt-4 text-sm text-tinta-suave">Solo podés mirar este producto.</p>
      )}
    </form>
  )
}
