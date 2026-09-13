'use client'

import { useState } from 'react'
import { Aviso } from '@/components/ui'
import { bs, numero } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { guardarEnvoltorio } from '../maestro'

export interface Envoltorio {
  id: number
  estilo: string
  tamano: string
  precio: number
  espacios: number | null
  minutos: number | null
  activo: boolean
  costo: number
}

function Fila({ e, puedeEditar }: { e: Envoltorio; puedeEditar: boolean }) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const inicial = {
    precio: String(e.precio),
    espacios: e.espacios == null ? '' : String(e.espacios),
    minutos: e.minutos == null ? '' : String(e.minutos),
    activo: e.activo,
  }
  const [d, setD] = useState(inicial)
  const sucio = JSON.stringify(d) !== JSON.stringify(inicial)
  const campo = 'campo w-20 py-1 text-right text-sm tabular-nums focus:campo-foco disabled:bg-transparent disabled:border-transparent'

  return (
    <>
      <tr className={e.activo ? '' : 'text-tinta-suave'}>
        <td className="px-3 py-1.5 font-medium">{e.tamano}</td>
        <td className="px-3 py-1.5 text-right">
          <input aria-label={`Precio base ${e.estilo} ${e.tamano}`} inputMode="decimal" disabled={!puedeEditar} value={d.precio} onChange={(x) => setD({ ...d, precio: x.target.value })} className={campo} />
        </td>
        <td className="px-3 py-1.5 text-right">
          <input aria-label={`Capacidad ${e.estilo} ${e.tamano}`} inputMode="decimal" disabled={!puedeEditar} value={d.espacios} onChange={(x) => setD({ ...d, espacios: x.target.value })} placeholder="∞" className={campo} />
        </td>
        <td className="px-3 py-1.5 text-right">
          <input aria-label={`Minutos ${e.estilo} ${e.tamano}`} inputMode="numeric" disabled={!puedeEditar} value={d.minutos} onChange={(x) => setD({ ...d, minutos: x.target.value })} placeholder="—" className={campo} />
        </td>
        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-tinta-suave">{bs(e.costo)}</td>
        <td className="px-3 py-1.5 text-center">
          <input type="checkbox" aria-label="Se ofrece" disabled={!puedeEditar} checked={d.activo} onChange={(x) => setD({ ...d, activo: x.target.checked })} className="accent-rosa-600" />
        </td>
        <td className="px-3 py-1.5 text-right">
          {puedeEditar && sucio && (
            <button type="button" disabled={pendiente} onClick={() => ejecutar(() => guardarEnvoltorio(e.id, d))} className="rounded-md bg-rosa-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
              {pendiente ? '…' : 'Guardar'}
            </button>
          )}
        </td>
      </tr>
      {aviso && !aviso.ok && (
        <tr>
          <td colSpan={7} className="px-3 pb-2">
            <Aviso {...aviso} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function Envoltorios({ envoltorios, puedeEditar }: { envoltorios: Envoltorio[]; puedeEditar: boolean }) {
  const estilos = [...new Set(envoltorios.map((e) => e.estilo))]

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      {estilos.map((estilo) => {
        const filas = envoltorios.filter((e) => e.estilo === estilo)
        return (
          <section key={estilo} className="tarjeta overflow-x-auto">
            <h3 className="px-3 pt-3 text-sm font-semibold">
              {estilo}
              <span className="ml-2 text-xs font-normal text-tinta-suave">
                {filas.filter((f) => f.activo).length} tamaño{filas.length === 1 ? '' : 's'} · capacidad hasta{' '}
                {numero(Math.max(...filas.map((f) => f.espacios ?? 0)))} esp.
              </span>
            </h3>
            <table className="mt-2 w-full min-w-[460px] text-sm">
              <thead className="border-y border-linea bg-fondo text-xs uppercase tracking-wide text-tinta-suave">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Tamaño</th>
                  <th className="px-3 py-1.5 text-right font-medium">Precio base</th>
                  <th className="px-3 py-1.5 text-right font-medium">Capacidad</th>
                  <th className="px-3 py-1.5 text-right font-medium">Minutos</th>
                  <th className="px-3 py-1.5 text-right font-medium">Costo</th>
                  <th className="px-3 py-1.5 font-medium">Usar</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {filas.map((e) => (
                  <Fila key={e.id} e={e} puedeEditar={puedeEditar} />
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
