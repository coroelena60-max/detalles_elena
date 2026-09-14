'use client'

import { useMemo, useState } from 'react'
import AnularConMotivo from '@/components/AnularConMotivo'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import { UNIDADES, type EstadoCompra, type UnidadMedida } from '@/lib/estados'
import { bs, numero } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { actualizarCabecera, agregarItem, anularCompra, quitarItem, recibirCompra } from '../acciones'

export interface ItemCompra {
  id: number
  insumo: string
  unidad: UnidadMedida
  cantidad: number
  costo: number
  subtotal: number
}

export interface InsumoElegible {
  id: number
  nombre: string
  unidad: UnidadMedida
  costo: number
}

export default function EditorCompra({
  compra,
  items,
  insumos,
  proveedores,
  puedeEditar,
}: {
  compra: {
    id: number
    codigo: string
    estado: EstadoCompra
    proveedorId: number | null
    fecha: string
    documento: string
    nota: string
    subtotal: number
    descuento: number
    total: number
  }
  items: ItemCompra[]
  insumos: InsumoElegible[]
  proveedores: { id: number; nombre: string }[]
  puedeEditar: boolean
}) {
  const cabecera = useAccion()
  const linea = useAccion()
  const cierre = useAccion()
  const editable = puedeEditar && compra.estado === 'borrador'

  const [d, setD] = useState({
    proveedorId: compra.proveedorId,
    fecha: compra.fecha,
    documento: compra.documento,
    nota: compra.nota,
    descuento: compra.descuento ? String(compra.descuento) : '',
  })

  const [insumoId, setInsumoId] = useState(0)
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  const elegido = insumos.find((i) => i.id === insumoId)
  const vistaPrevia = useMemo(() => {
    const c = Number(cantidad.replace(',', '.'))
    const u = Number(costo.replace(',', '.'))
    return Number.isFinite(c) && Number.isFinite(u) ? c * u : 0
  }, [cantidad, costo])

  return (
    <div className="space-y-4">
      <section className="tarjeta p-4">
        <h2 className="text-sm font-semibold">Datos de la compra</h2>
        <fieldset disabled={!editable || cabecera.pendiente} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="c-prov" className="block text-sm font-medium">Proveedor</label>
            <select id="c-prov" value={d.proveedorId ?? ''} onChange={(e) => setD({ ...d, proveedorId: e.target.value ? Number(e.target.value) : null })} className={CAMPO}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="c-fecha" className="block text-sm font-medium">Fecha</label>
            <input id="c-fecha" type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="c-doc" className="block text-sm font-medium">Nº de factura o recibo</label>
            <input id="c-doc" value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="c-desc" className="block text-sm font-medium">Descuento (Bs)</label>
            <input id="c-desc" inputMode="decimal" value={d.descuento} onChange={(e) => setD({ ...d, descuento: e.target.value })} placeholder="0" className={`${CAMPO} text-right tabular-nums`} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="c-nota" className="block text-sm font-medium">Nota</label>
            <input id="c-nota" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} className={CAMPO} />
          </div>
        </fieldset>
        {editable && (
          <button
            type="button"
            disabled={cabecera.pendiente}
            onClick={() => cabecera.ejecutar(() => actualizarCabecera(compra.id, compra.codigo, d))}
            className={`${BOTON_SECUNDARIO} mt-3`}
          >
            Guardar datos
          </button>
        )}
        {cabecera.aviso && <Aviso {...cabecera.aviso} />}
      </section>

      <section className="tarjeta overflow-x-auto">
        <h2 className="px-4 pt-4 text-sm font-semibold">Qué se compró</h2>
        {items.length === 0 ? (
          <p className="px-4 pb-2 pt-2 text-sm text-tinta-suave">Todavía no cargaste ningún material.</p>
        ) : (
          <table className="mt-2 w-full min-w-[520px] text-sm">
            <thead className="border-y border-linea bg-fondo text-left text-xs uppercase tracking-wide text-tinta-suave">
              <tr>
                <th className="px-4 py-2 font-medium">Material</th>
                <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                <th className="px-4 py-2 text-right font-medium">Costo unit.</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                {editable && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2">{it.insumo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {numero(it.cantidad)} {UNIDADES[it.unidad]}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{bs(it.costo)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{bs(it.subtotal)}</td>
                  {editable && (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        disabled={linea.pendiente}
                        onClick={() => linea.ejecutar(() => quitarItem(it.id, compra.codigo))}
                        className="text-xs text-tinta-suave hover:text-alerta"
                      >
                        Quitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editable && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              linea.ejecutar(
                () => agregarItem(compra.id, compra.codigo, insumoId, cantidad, costo),
                (r) => {
                  if (r.ok) {
                    setCantidad('')
                    setCosto('')
                    setInsumoId(0)
                  }
                },
              )
            }}
            className="flex flex-wrap items-end gap-2 border-t border-linea p-4"
          >
            <div className="min-w-48 flex-[2]">
              <label htmlFor="it-ins" className="block text-sm font-medium">Material</label>
              <select
                id="it-ins"
                required
                value={insumoId || ''}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  setInsumoId(id)
                  const i = insumos.find((x) => x.id === id)
                  // sugiere el último costo conocido: casi siempre es el mismo
                  if (i && costo === '' && i.costo > 0) setCosto(String(i.costo))
                }}
                className={CAMPO}
              >
                <option value="" disabled>Elegí…</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label htmlFor="it-cant" className="block text-xs font-medium">
                Cantidad{elegido ? ` (${UNIDADES[elegido.unidad]})` : ''}
              </label>
              <input id="it-cant" inputMode="decimal" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={`${CAMPO} text-right tabular-nums`} />
            </div>
            <div className="w-28">
              <label htmlFor="it-costo" className="block text-xs font-medium">Costo unit. (Bs)</label>
              <input id="it-costo" inputMode="decimal" required value={costo} onChange={(e) => setCosto(e.target.value)} className={`${CAMPO} text-right tabular-nums`} />
            </div>
            <div className="w-24 pb-2 text-right text-sm tabular-nums text-tinta-suave">{bs(vistaPrevia)}</div>
            <button type="submit" disabled={linea.pendiente} className={BOTON_SECUNDARIO}>
              Agregar
            </button>
            {insumos.length === 0 && (
              <p className="w-full text-xs text-tinta-suave">Primero cargá los materiales en la pestaña Materiales.</p>
            )}
          </form>
        )}
        {linea.aviso && !linea.aviso.ok && <div className="px-4 pb-4"><Aviso {...linea.aviso} /></div>}

        <dl className="space-y-1 border-t border-linea bg-fondo p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Subtotal</dt>
            <dd className="tabular-nums">{bs(compra.subtotal)}</dd>
          </div>
          {compra.descuento > 0 && (
            <div className="flex justify-between">
              <dt className="text-tinta-suave">Descuento</dt>
              <dd className="tabular-nums">−{bs(compra.descuento)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{bs(compra.total)}</dd>
          </div>
        </dl>
      </section>

      {editable && (
        <section className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <p className="font-medium">¿Llegó la mercadería?</p>
            <p className="text-xs text-tinta-suave">
              Al recibirla entra al stock y ya no se puede cambiar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AnularConMotivo accion={anularCompra.bind(null, compra.id, compra.codigo)} etiqueta="Anular compra" />
            <button
              type="button"
              disabled={cierre.pendiente || items.length === 0}
              onClick={() => cierre.ejecutar(() => recibirCompra(compra.id, compra.codigo))}
              className={BOTON}
            >
              {cierre.pendiente ? 'Recibiendo…' : 'Marcar como recibida'}
            </button>
          </div>
          {cierre.aviso && <div className="w-full"><Aviso {...cierre.aviso} /></div>}
        </section>
      )}
    </div>
  )
}
