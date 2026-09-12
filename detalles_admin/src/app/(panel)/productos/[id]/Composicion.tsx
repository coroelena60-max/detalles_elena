'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { bs, numero } from '@/lib/formato'
import { guardarComposicion, quitarDeComposicion } from '../acciones'

export interface LineaComposicion {
  extraId: number
  nombre: string
  cantidad: number
  precio: number
  espacios: number
}

export interface ExtraDisponible {
  id: number
  nombre: string
  precio: number
  espacios: number
}

export default function Composicion({
  productoId,
  lineas,
  disponibles,
  capacidad,
  puedeEditar,
}: {
  productoId: number
  lineas: LineaComposicion[]
  disponibles: ExtraDisponible[]
  capacidad: number | null
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [nuevoExtra, setNuevoExtra] = useState<number>(disponibles[0]?.id ?? 0)
  const [nuevaCantidad, setNuevaCantidad] = useState(1)

  const usados = lineas.reduce((s, l) => s + l.espacios * l.cantidad, 0)
  const costoFlores = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
  const pasado = capacidad !== null && usados > capacidad

  function accion(fn: () => Promise<{ ok: boolean; mensaje: string }>) {
    setAviso(null)
    iniciar(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Qué lleva el ramo</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Es lo que se muestra en la ficha del catálogo y lo que usa el costeo. No cambia
        el precio de venta: ese lo ponés vos.
      </p>

      {capacidad !== null && (
        <p
          className={`mt-3 text-xs ${pasado ? 'font-medium text-alerta' : 'text-tinta-suave'}`}
        >
          Ocupa {numero(usados)} de {numero(capacidad)} espacios
          {pasado ? ' — no entra en este envoltorio' : ''}
        </p>
      )}

      {lineas.length > 0 ? (
        <ul className="mt-3 divide-y divide-linea">
          {lineas.map((l) => (
            <li key={l.extraId} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{l.nombre}</span>
              <span className="text-xs text-tinta-suave">
                {bs(l.precio)} · {numero(l.espacios)} esp.
              </span>
              {puedeEditar ? (
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={l.cantidad}
                  disabled={pendiente}
                  aria-label={`Cantidad de ${l.nombre}`}
                  onBlur={(e) => {
                    const valor = Number(e.target.value)
                    if (valor !== l.cantidad) {
                      accion(() => guardarComposicion(productoId, l.extraId, valor))
                    }
                  }}
                  className="campo w-20 py-1 text-sm"
                />
              ) : (
                <span className="w-20 text-right text-sm">{numero(l.cantidad)}</span>
              )}
              {puedeEditar && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => accion(() => quitarDeComposicion(productoId, l.extraId))}
                  className="text-xs text-tinta-suave transition hover:text-alerta disabled:opacity-40"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-tinta-suave">Todavía no cargaste qué lleva.</p>
      )}

      {lineas.length > 0 && (
        <p className="mt-3 border-t border-linea pt-2 text-sm">
          Flores a precio de venta:{' '}
          <strong>{bs(costoFlores)}</strong>
        </p>
      )}

      {puedeEditar && disponibles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label htmlFor="extra" className="block text-sm font-medium">
              Agregar
            </label>
            <select
              id="extra"
              value={nuevoExtra}
              onChange={(e) => setNuevoExtra(Number(e.target.value))}
              className="campo mt-1 focus:campo-foco"
            >
              {disponibles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} · {bs(x.precio)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label htmlFor="cantidad" className="block text-sm font-medium">
              Cantidad
            </label>
            <input
              id="cantidad"
              type="number"
              min="0.01"
              step="0.01"
              value={nuevaCantidad}
              onChange={(e) => setNuevaCantidad(Number(e.target.value))}
              className="campo mt-1 focus:campo-foco"
            />
          </div>
          <button
            type="button"
            disabled={pendiente || !nuevoExtra}
            onClick={() =>
              accion(() => guardarComposicion(productoId, nuevoExtra, nuevaCantidad))
            }
            className="rounded-lg border border-rosa-300 px-4 py-2 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-60"
          >
            Agregar
          </button>
        </div>
      )}

      {aviso && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </section>
  )
}
