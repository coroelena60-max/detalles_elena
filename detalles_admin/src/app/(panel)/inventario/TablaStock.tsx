'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Aviso, Etiqueta } from '@/components/ui'
import { numero } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { moverStock, producirExtra, type Movida } from './acciones'

export interface FilaStock {
  id: number
  nombre: string
  codigo?: string | null
  existencia: number
  minimo: number
  estado: string | null
  tieneReceta?: boolean
}

const MOVIDAS: { clave: Movida; etiqueta: string; ayuda: string; campo: string }[] = [
  { clave: 'entrada', etiqueta: 'Entrada', ayuda: 'Armé o fabriqué unidades nuevas.', campo: '¿Cuántas?' },
  { clave: 'conteo', etiqueta: 'Conté', ayuda: 'Conté lo que hay en el estante: el sistema se corrige solo.', campo: 'Hay en total' },
  { clave: 'merma', etiqueta: 'Merma', ayuda: 'Se rompió, se marchitó o se perdió.', campo: '¿Cuántas?' },
  { clave: 'devolucion', etiqueta: 'Devolución', ayuda: 'Volvió a la tienda.', campo: '¿Cuántas?' },
]

function Mover({
  tipoItem,
  fila,
  alCerrar,
}: {
  tipoItem: 'producto' | 'extra'
  fila: FilaStock
  alCerrar: () => void
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [movida, setMovida] = useState<Movida>('entrada')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [usarReceta, setUsarReceta] = useState(true)

  const def = MOVIDAS.find((m) => m.clave === movida)!
  const n = Number(cantidad.replace(',', '.'))
  const diferencia = movida === 'conteo' && cantidad !== '' ? n - fila.existencia : null
  const conReceta = tipoItem === 'extra' && movida === 'entrada' && fila.tieneReceta && usarReceta

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(
          () =>
            conReceta
              ? producirExtra(fila.id, n)
              : moverStock(tipoItem, fila.id, movida, n, fila.existencia, nota),
          (r) => r.ok && setCantidad(''),
        )
      }}
      className="mt-2 rounded-lg border border-rosa-200 bg-rosa-50 p-3"
    >
      <div className="flex flex-wrap gap-1">
        {MOVIDAS.map((m) => (
          <button
            key={m.clave}
            type="button"
            onClick={() => setMovida(m.clave)}
            aria-pressed={movida === m.clave}
            className={`rounded-full px-3 py-1 text-xs transition ${
              movida === m.clave ? 'bg-rosa-600 text-white' : 'bg-white text-tinta-suave hover:text-tinta'
            }`}
          >
            {m.etiqueta}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-tinta-suave">{def.ayuda}</p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="w-28">
          <label htmlFor={`c-${fila.id}`} className="block text-xs font-medium">
            {def.campo}
          </label>
          <input
            id={`c-${fila.id}`}
            autoFocus
            inputMode="decimal"
            required
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="campo mt-1 py-1.5 text-right tabular-nums focus:campo-foco"
          />
        </div>
        {!conReceta && (
          <div className="min-w-40 flex-1">
            <label htmlFor={`n-${fila.id}`} className="block text-xs font-medium">
              Nota
            </label>
            <input
              id={`n-${fila.id}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Opcional"
              className="campo mt-1 py-1.5 focus:campo-foco"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={pendiente || cantidad === '' || !Number.isFinite(n)}
          className="rounded-lg bg-rosa-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-50"
        >
          {pendiente ? '…' : 'Guardar'}
        </button>
        <button type="button" onClick={alCerrar} className="px-2 py-1.5 text-sm text-tinta-suave hover:text-tinta">
          Cerrar
        </button>
      </div>

      {diferencia !== null && Number.isFinite(diferencia) && (
        <p className="mt-2 text-xs">
          El sistema dice {numero(fila.existencia)}:{' '}
          {diferencia === 0 ? (
            'coincide.'
          ) : (
            <strong className={diferencia < 0 ? 'text-alerta' : 'text-ok'}>
              se ajusta {diferencia > 0 ? '+' : ''}
              {numero(diferencia)}
            </strong>
          )}
        </p>
      )}

      {tipoItem === 'extra' && movida === 'entrada' && fila.tieneReceta && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={usarReceta}
            onChange={(e) => setUsarReceta(e.target.checked)}
            className="accent-rosa-600"
          />
          Descontar los insumos de la receta (papel, alambre, cinta…)
        </label>
      )}

      {aviso && <Aviso {...aviso} />}
    </form>
  )
}

export default function TablaStock({
  tipoItem,
  filas,
  puedeEditar,
  enlaceBase,
}: {
  tipoItem: 'producto' | 'extra'
  filas: FilaStock[]
  puedeEditar: boolean
  /** prefijo de la ficha, p. ej. '/productos' → /productos/12 */
  enlaceBase?: string
}) {
  const [abierta, setAbierta] = useState<number | null>(null)

  return (
    <ul className="tarjeta mt-4 divide-y divide-linea">
      {filas.map((f) => {
        const bajo = f.existencia <= f.minimo
        const sinStock = f.existencia <= 0
        return (
          <li key={f.id} className="p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {enlaceBase ? (
                    <Link href={`${enlaceBase}/${f.id}`} className="hover:text-rosa-700 hover:underline">
                      {f.nombre}
                    </Link>
                  ) : (
                    f.nombre
                  )}
                </p>
                <p className="text-xs text-tinta-suave">
                  {f.codigo && <span className="mr-2 font-mono">{f.codigo}</span>}
                  mínimo {numero(f.minimo)}
                  {tipoItem === 'extra' && !f.tieneReceta && <span className="ml-2">· sin receta</span>}
                </p>
              </div>

              {sinStock ? (
                <Etiqueta clase="bg-alerta-suave text-alerta">Sin stock</Etiqueta>
              ) : bajo ? (
                <Etiqueta clase="bg-aviso-suave text-aviso">Reponer</Etiqueta>
              ) : null}

              <span
                className={`w-16 text-right text-lg font-semibold tabular-nums ${sinStock ? 'text-alerta' : bajo ? 'text-aviso' : ''}`}
              >
                {numero(f.existencia)}
              </span>

              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                  aria-expanded={abierta === f.id}
                  className="rounded-lg border border-linea bg-white px-3 py-1.5 text-sm text-tinta-suave transition hover:border-rosa-300 hover:text-rosa-700"
                >
                  Mover
                </button>
              )}
            </div>
            {abierta === f.id && (
              <Mover tipoItem={tipoItem} fila={f} alCerrar={() => setAbierta(null)} />
            )}
          </li>
        )
      })}
    </ul>
  )
}
