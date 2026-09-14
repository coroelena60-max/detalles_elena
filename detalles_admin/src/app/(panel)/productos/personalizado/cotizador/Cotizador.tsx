'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Aviso, CAMPO } from '@/components/ui'
import { bs, numero } from '@/lib/formato'
import { cotizar, type Cotizacion } from '../../maestro'

export interface OpcionEnvoltorio {
  id: number
  nombre: string
  precio: number
  espacios: number | null
}
export interface OpcionExtra {
  id: number
  nombre: string
  precio: number
  espacios: number
  grupo: string
}

/**
 * El "armá tu ramo" del catálogo, visto desde adentro: además del precio de
 * lista muestra el costo real y el precio que conviene cobrar. Sirve para
 * cotizar un pedido especial por WhatsApp sin hacer cuentas a mano.
 */
export default function Cotizador({
  envoltorios,
  extras,
}: {
  envoltorios: OpcionEnvoltorio[]
  extras: OpcionExtra[]
}) {
  const [envId, setEnvId] = useState(envoltorios[0]?.id ?? 0)
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [resultado, setResultado] = useState<Cotizacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [calculando, iniciar] = useTransition()

  const env = envoltorios.find((e) => e.id === envId)
  const lineas = useMemo(
    () => Object.entries(cantidades).filter(([, c]) => c > 0).map(([id, c]) => ({ extra_id: Number(id), cantidad: c })),
    [cantidades],
  )

  // precio de lista = lo que marcaría el catálogo sumando piezas
  const lista = (env?.precio ?? 0) + lineas.reduce((s, l) => s + (extras.find((x) => x.id === l.extra_id)?.precio ?? 0) * l.cantidad, 0)
  const usados = lineas.reduce((s, l) => s + (extras.find((x) => x.id === l.extra_id)?.espacios ?? 0) * l.cantidad, 0)
  const capacidad = env?.espacios ?? null
  const pasado = capacidad !== null && usados > capacidad

  // recalcular en la base cada vez que cambia la receta (con una pausa corta)
  useEffect(() => {
    if (!envId) return
    const t = setTimeout(() => {
      iniciar(async () => {
        const r = await cotizar(envId, lineas)
        if (r.ok) {
          setResultado(r.dato)
          setError(null)
        } else {
          setError(r.mensaje)
        }
      })
    }, 250)
    return () => clearTimeout(t)
  }, [envId, lineas])

  function cambiar(id: number, delta: number) {
    setCantidades((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }))
  }

  const grupos = [...new Set(extras.map((e) => e.grupo))]
  const sugerido = Number(resultado?.precio_sugerido ?? 0)
  const costo = Number(resultado?.costo_total ?? 0)
  const margenLista = lista - costo

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <section className="tarjeta p-4">
          <label htmlFor="cot-env" className="block text-sm font-semibold">Envoltorio</label>
          <select id="cot-env" value={envId} onChange={(e) => setEnvId(Number(e.target.value))} className={CAMPO}>
            {envoltorios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} · {bs(e.precio)} · {e.espacios == null ? 'sin límite' : `${numero(e.espacios)} espacios`}
              </option>
            ))}
          </select>
          {capacidad !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs">
                <span className={pasado ? 'font-medium text-alerta' : 'text-tinta-suave'}>
                  {pasado ? 'No entra' : 'Espacio usado'}
                </span>
                <span className="tabular-nums">{numero(usados)} / {numero(capacidad)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-fondo">
                <div className={`h-full rounded-full transition-all ${pasado ? 'bg-alerta' : 'bg-rosa-500'}`} style={{ width: `${Math.min((usados / capacidad) * 100, 100)}%` }} />
              </div>
            </div>
          )}
        </section>

        {grupos.map((g) => (
          <section key={g} className="tarjeta p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{g}</h3>
            <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {extras.filter((e) => e.grupo === g).map((e) => {
                const c = cantidades[e.id] ?? 0
                return (
                  <li key={e.id} className="flex items-center gap-2 border-b border-linea py-2 last:border-0">
                    <span className="min-w-0 flex-1 text-sm">
                      {e.nombre}
                      <span className="block text-xs text-tinta-suave">{bs(e.precio)} · {numero(e.espacios)} esp.</span>
                    </span>
                    <button type="button" onClick={() => cambiar(e.id, -1)} disabled={c === 0} aria-label={`Quitar ${e.nombre}`} className="grid size-8 place-items-center rounded-full border border-linea text-lg leading-none disabled:opacity-30">−</button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">{c}</span>
                    <button type="button" onClick={() => cambiar(e.id, 1)} aria-label={`Agregar ${e.nombre}`} className="grid size-8 place-items-center rounded-full border border-rosa-300 text-lg leading-none text-rosa-700 hover:bg-rosa-50">+</button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-4">
        <section className="tarjeta p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Cotización</h2>
            {calculando && <span className="text-xs text-tinta-suave">calculando…</span>}
          </div>

          <p className="mt-3 text-xs uppercase tracking-wide text-tinta-suave">Precio sugerido</p>
          <p className="text-3xl font-semibold tabular-nums text-rosa-700">{bs(sugerido)}</p>
          <p className="text-xs text-tinta-suave">costo + margen objetivo, redondeado a múltiplo de 5</p>

          <dl className="mt-4 space-y-1 border-t border-linea pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-tinta-suave">Materiales</dt><dd className="tabular-nums">{bs(resultado?.costo_materiales)}</dd></div>
            <div className="flex justify-between"><dt className="text-tinta-suave">Mano de obra ({numero(resultado?.minutos)} min)</dt><dd className="tabular-nums">{bs(resultado?.costo_mano_obra)}</dd></div>
            <div className="flex justify-between font-medium"><dt>Costo total</dt><dd className="tabular-nums">{bs(costo)}</dd></div>
          </dl>

          <dl className="mt-3 space-y-1 border-t border-linea pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-tinta-suave">Precio de lista (suma de piezas)</dt><dd className="tabular-nums">{bs(lista)}</dd></div>
            <div className={`flex justify-between font-medium ${margenLista < 0 ? 'text-alerta' : 'text-ok'}`}>
              <dt>Margen a precio de lista</dt>
              <dd className="tabular-nums">{bs(margenLista)}</dd>
            </div>
          </dl>

          {pasado && <Aviso ok={false} texto="Con estos extras el ramo no entra en el envoltorio: el catálogo no lo dejaría armar." />}
          {error && <Aviso ok={false} texto={error} />}

          {lineas.length > 0 && (
            <button type="button" onClick={() => setCantidades({})} className="mt-3 text-xs text-tinta-suave hover:text-tinta">
              Vaciar
            </button>
          )}
        </section>
        <p className="text-xs text-tinta-suave">
          Si el costo sale muy bajo, faltan cargar materiales.
        </p>
      </aside>
    </div>
  )
}
