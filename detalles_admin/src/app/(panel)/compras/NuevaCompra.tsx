'use client'

import { useState } from 'react'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import { hoyBolivia } from '@/lib/fechas'
import { useAccion } from '@/lib/useAccion'
import { crearCompra } from './acciones'

export default function NuevaCompra({ proveedores }: { proveedores: { id: number; nombre: string }[] }) {
  const { pendiente, aviso, ejecutar, router } = useAccion()
  const [abierto, setAbierto] = useState(false)
  const [d, setD] = useState({ proveedorId: null as number | null, fecha: hoyBolivia(), documento: '', nota: '' })

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={BOTON}>
        Nueva compra
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(
          () => crearCompra(d),
          (r) => r.ok && r.codigo && router.push(`/compras/${r.codigo}`),
        )
      }}
      className="tarjeta w-full p-4"
    >
      <h2 className="text-sm font-semibold">Nueva compra</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Cuando llegue la mercadería, marcala como recibida.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="nc-prov" className="block text-sm font-medium">Proveedor</label>
          <select id="nc-prov" value={d.proveedorId ?? ''} onChange={(e) => setD({ ...d, proveedorId: e.target.value ? Number(e.target.value) : null })} className={CAMPO}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nc-fecha" className="block text-sm font-medium">Fecha</label>
          <input id="nc-fecha" type="date" required value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="nc-doc" className="block text-sm font-medium">Nº de factura o recibo</label>
          <input id="nc-doc" value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} placeholder="Opcional" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="nc-nota" className="block text-sm font-medium">Nota</label>
          <input id="nc-nota" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Opcional" className={CAMPO} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pendiente} className={BOTON}>
          {pendiente ? 'Creando…' : 'Crear y cargar materiales'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
      </div>
      {aviso && !aviso.ok && <Aviso {...aviso} />}
    </form>
  )
}
