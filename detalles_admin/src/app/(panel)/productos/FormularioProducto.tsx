'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { bs } from '@/lib/formato'
import type { Database } from '@/types/database'
import { archivarProducto, guardarProducto, type DatosProducto } from './acciones'

type EstadoPublicacion = Database['public']['Enums']['estado_publicacion']

export interface OpcionesFormulario {
  categorias: { id: number; nombre: string }[]
  envoltorios: { id: number; nombre: string; espacios: number | null; precio_base: number }[]
}

const ESTADOS: { valor: EstadoPublicacion; etiqueta: string; ayuda: string }[] = [
  { valor: 'borrador', etiqueta: 'Borrador', ayuda: 'No sale en el catálogo.' },
  { valor: 'activo', etiqueta: 'En el catálogo', ayuda: 'Se puede comprar.' },
  { valor: 'temporada', etiqueta: 'De temporada', ayuda: 'Se puede comprar.' },
  { valor: 'agotado', etiqueta: 'Agotado', ayuda: 'Se ve, pero no se puede agregar.' },
  { valor: 'inactivo', etiqueta: 'Fuera del catálogo', ayuda: 'No se ve.' },
]

export default function FormularioProducto({
  inicial,
  opciones,
  puedeEditar,
}: {
  inicial: Partial<DatosProducto> & { codigo?: string; slug?: string }
  opciones: OpcionesFormulario
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const [d, setD] = useState<DatosProducto>({
    id: inicial.id,
    nombre: inicial.nombre ?? '',
    descripcion: inicial.descripcion ?? '',
    categoriaId: inicial.categoriaId ?? opciones.categorias[0]?.id ?? 0,
    envoltorioId: inicial.envoltorioId ?? null,
    precio: inicial.precio ?? 0,
    precioDesde: inicial.precioDesde ?? false,
    estado: inicial.estado ?? 'borrador',
    destacado: inicial.destacado ?? false,
    orden: inicial.orden ?? 0,
    leadTimeDias: inicial.leadTimeDias ?? null,
    minutosArmado: inicial.minutosArmado ?? null,
    stockMinimo: inicial.stockMinimo ?? 0,
  })

  const envoltorio = opciones.envoltorios.find((e) => e.id === d.envoltorioId)

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    iniciar(async () => {
      const r = await guardarProducto(d)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok && !d.id) router.push(`/productos/${r.id}`)
      else if (r.ok) router.refresh()
    })
  }

  function archivar() {
    if (!d.id) return
    setAviso(null)
    iniciar(async () => {
      const r = await archivarProducto(d.id!)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) {
        setD((prev) => ({ ...prev, estado: 'inactivo', destacado: false }))
        router.refresh()
      }
    })
  }

  const campo = 'campo mt-1 focus:campo-foco'
  const etiqueta = 'block text-sm font-medium'

  return (
    <form onSubmit={enviar} className="tarjeta p-4">
      <fieldset disabled={!puedeEditar || pendiente} className="space-y-4">
        <div>
          <label htmlFor="nombre" className={etiqueta}>
            Nombre
          </label>
          <input
            id="nombre"
            value={d.nombre}
            onChange={(e) => setD({ ...d, nombre: e.target.value })}
            required
            minLength={3}
            className={campo}
          />
          {inicial.codigo ? (
            <p className="mt-1 text-xs text-tinta-suave">
              Código <span className="font-mono">{inicial.codigo}</span> · URL{' '}
              <span className="font-mono">/productos/{inicial.slug}</span> (no cambia al
              renombrar)
            </p>
          ) : (
            <p className="mt-1 text-xs text-tinta-suave">
              El código y la URL los genera la base al guardar.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="descripcion" className={etiqueta}>
            Descripción
          </label>
          <textarea
            id="descripcion"
            rows={3}
            value={d.descripcion}
            onChange={(e) => setD({ ...d, descripcion: e.target.value })}
            className={campo}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="categoria" className={etiqueta}>
              Categoría
            </label>
            <select
              id="categoria"
              value={d.categoriaId}
              onChange={(e) => setD({ ...d, categoriaId: Number(e.target.value) })}
              className={campo}
            >
              {opciones.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="envoltorio" className={etiqueta}>
              Envoltorio
            </label>
            <select
              id="envoltorio"
              value={d.envoltorioId ?? ''}
              onChange={(e) =>
                setD({
                  ...d,
                  envoltorioId: e.target.value ? Number(e.target.value) : null,
                })
              }
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
              <p className="mt-1 text-xs text-tinta-suave">
                Caben {envoltorio.espacios} espacios de flores.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="precio" className={etiqueta}>
              Precio de venta (Bs)
            </label>
            <input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              value={d.precio}
              onChange={(e) => setD({ ...d, precio: Number(e.target.value) })}
              required
              className={campo}
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.precioDesde}
                onChange={(e) => setD({ ...d, precioDesde: e.target.checked })}
              />
              Mostrar como &laquo;desde Bs {d.precio || 0}&raquo;
            </label>
          </div>

          <div>
            <label htmlFor="estado" className={etiqueta}>
              Estado
            </label>
            <select
              id="estado"
              value={d.estado}
              onChange={(e) =>
                setD({ ...d, estado: e.target.value as EstadoPublicacion })
              }
              className={campo}
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-tinta-suave">
              {ESTADOS.find((e) => e.valor === d.estado)?.ayuda}
            </p>
          </div>

          <div>
            <label htmlFor="lead" className={etiqueta}>
              Días de anticipación
            </label>
            <input
              id="lead"
              type="number"
              min="0"
              value={d.leadTimeDias ?? ''}
              onChange={(e) =>
                setD({
                  ...d,
                  leadTimeDias: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className={campo}
            />
            <p className="mt-1 text-xs text-tinta-suave">
              Se muestra en la ficha del catálogo.
            </p>
          </div>

          <div>
            <label htmlFor="minutos" className={etiqueta}>
              Minutos de armado
            </label>
            <input
              id="minutos"
              type="number"
              min="0"
              value={d.minutosArmado ?? ''}
              onChange={(e) =>
                setD({
                  ...d,
                  minutosArmado: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className={campo}
            />
            <p className="mt-1 text-xs text-tinta-suave">
              Entra en el costo a través de la hora de trabajo.
            </p>
          </div>

          <div>
            <label htmlFor="orden" className={etiqueta}>
              Orden en el catálogo
            </label>
            <input
              id="orden"
              type="number"
              value={d.orden}
              onChange={(e) => setD({ ...d, orden: Number(e.target.value) })}
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="stock" className={etiqueta}>
              Stock mínimo
            </label>
            <input
              id="stock"
              type="number"
              step="0.001"
              min="0"
              value={d.stockMinimo}
              onChange={(e) => setD({ ...d, stockMinimo: Number(e.target.value) })}
              className={campo}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={d.destacado}
            onChange={(e) => setD({ ...d, destacado: e.target.checked })}
          />
          Mostrarlo en &laquo;Los más pedidos&raquo; de la portada
        </label>
      </fieldset>

      {aviso && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {puedeEditar && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-rosa-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
          >
            {pendiente ? 'Guardando…' : d.id ? 'Guardar cambios' : 'Crear producto'}
          </button>
          {d.id && d.estado !== 'inactivo' && (
            <button
              type="button"
              onClick={archivar}
              disabled={pendiente}
              className="rounded-lg border border-linea px-4 py-2.5 text-sm text-tinta-suave transition hover:border-alerta hover:text-alerta disabled:opacity-60"
            >
              Sacar del catálogo
            </button>
          )}
        </div>
      )}

      {!puedeEditar && (
        <p className="mt-4 text-sm text-tinta-suave">
          Podés mirar, pero no editar: te falta el permiso <code>maestro.editar</code>.
        </p>
      )}
    </form>
  )
}
