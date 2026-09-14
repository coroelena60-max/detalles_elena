'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Aviso, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import { UNIDADES, type UnidadMedida } from '@/lib/estados'
import { bs, numero } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { guardarIngrediente, quitarIngrediente } from '../../../maestro'

export interface Ingrediente {
  insumoId: number
  nombre: string
  unidad: UnidadMedida
  cantidad: number
  costoUnitario: number
}

export default function Receta({
  extraId,
  ingredientes,
  insumos,
  puedeEditar,
}: {
  extraId: number
  ingredientes: Ingrediente[]
  insumos: { id: number; nombre: string; unidad: UnidadMedida; costo: number }[]
  puedeEditar: boolean
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [insumoId, setInsumoId] = useState(0)
  const [cantidad, setCantidad] = useState('')

  const usados = new Set(ingredientes.map((i) => i.insumoId))
  const disponibles = insumos.filter((i) => !usados.has(i.id))
  const elegido = insumos.find((i) => i.id === insumoId)
  const total = ingredientes.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0)

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Qué materiales lleva cada una</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Con esto se calcula el costo.
      </p>

      {ingredientes.length === 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">Todavía no tiene receta.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linea">
          {ingredientes.map((i) => (
            <li key={i.insumoId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <Link href={`/compras/insumos/${i.insumoId}`} className="min-w-0 flex-1 truncate hover:text-rosa-700 hover:underline">
                {i.nombre}
              </Link>
              {puedeEditar ? (
                <input
                  aria-label={`Cantidad de ${i.nombre}`}
                  inputMode="decimal"
                  defaultValue={i.cantidad}
                  disabled={pendiente}
                  onBlur={(e) => {
                    if (Number(e.target.value.replace(',', '.')) !== i.cantidad) {
                      ejecutar(() => guardarIngrediente(extraId, i.insumoId, e.target.value))
                    }
                  }}
                  className="campo w-20 py-1 text-right tabular-nums focus:campo-foco"
                />
              ) : (
                <span className="tabular-nums">{numero(i.cantidad)}</span>
              )}
              <span className="w-16 text-xs text-tinta-suave">{UNIDADES[i.unidad]}</span>
              <span className="w-20 text-right tabular-nums">{bs(i.cantidad * i.costoUnitario)}</span>
              {puedeEditar && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => ejecutar(() => quitarIngrediente(extraId, i.insumoId))}
                  className="text-xs text-tinta-suave hover:text-alerta"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
          <li className="flex justify-between py-2 text-sm font-semibold">
            <span>Materiales por unidad</span>
            <span className="tabular-nums">{bs(total)}</span>
          </li>
        </ul>
      )}

      {puedeEditar && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ejecutar(
              () => guardarIngrediente(extraId, insumoId, cantidad),
              (r) => {
                if (r.ok) {
                  setInsumoId(0)
                  setCantidad('')
                }
              },
            )
          }}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-linea pt-3"
        >
          <div className="min-w-44 flex-1">
            <label htmlFor="r-ins" className="block text-sm font-medium">Agregar material</label>
            <select id="r-ins" required value={insumoId || ''} onChange={(e) => setInsumoId(Number(e.target.value))} className={CAMPO}>
              <option value="" disabled>Elegí…</option>
              {disponibles.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({bs(i.costo)}/{UNIDADES[i.unidad]})
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label htmlFor="r-cant" className="block text-xs font-medium">
              Cantidad{elegido ? ` (${UNIDADES[elegido.unidad]})` : ''}
            </label>
            <input id="r-cant" required inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0,5" className={`${CAMPO} text-right tabular-nums`} />
          </div>
          <button type="submit" disabled={pendiente} className={BOTON_SECUNDARIO}>
            Agregar
          </button>
          {insumos.length === 0 && (
            <p className="w-full text-xs text-tinta-suave">
              No hay insumos cargados. Crealos en{' '}
              <Link href="/compras/insumos" className="text-rosa-700 hover:underline">Compras → Insumos</Link>.
            </p>
          )}
        </form>
      )}
      {aviso && !aviso.ok && <Aviso {...aviso} />}
    </section>
  )
}
