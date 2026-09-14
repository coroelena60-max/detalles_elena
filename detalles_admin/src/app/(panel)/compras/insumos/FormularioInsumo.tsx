'use client'

import { useState } from 'react'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import { UNIDADES, type UnidadMedida } from '@/lib/estados'
import { useAccion } from '@/lib/useAccion'
import { guardarInsumo, type DatosInsumo } from '../acciones'

export default function FormularioInsumo({
  inicial,
  proveedores,
  puedeEditar,
  alCancelar,
}: {
  inicial?: DatosInsumo
  proveedores: { id: number; nombre: string }[]
  puedeEditar: boolean
  alCancelar?: () => void
}) {
  const { pendiente, aviso, ejecutar, router } = useAccion()
  const nuevo = !inicial?.id
  const [d, setD] = useState<DatosInsumo>(
    inicial ?? {
      nombre: '',
      descripcion: '',
      unidad: 'unidad',
      costo: '',
      minimo: '',
      proveedorId: null,
      activo: true,
    },
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(
          () => guardarInsumo(d),
          (r) => {
            if (r.ok && nuevo && r.id) router.push(`/compras/insumos/${r.id}`)
          },
        )
      }}
      className="tarjeta p-4"
    >
      <h2 className="text-sm font-semibold">{nuevo ? 'Nuevo material' : 'Datos del material'}</h2>
      {nuevo && (
        <p className="mt-1 text-xs text-tinta-suave">
          Papel, cinta, alambre, cajas: lo que se usa para armar.
        </p>
      )}

      <fieldset disabled={!puedeEditar || pendiente} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="i-nombre" className="block text-sm font-medium">Nombre</label>
          <input id="i-nombre" required value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Papel coreano rosa" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="i-unidad" className="block text-sm font-medium">Se mide en</label>
          <select id="i-unidad" value={d.unidad} onChange={(e) => setD({ ...d, unidad: e.target.value as UnidadMedida })} className={CAMPO}>
            {Object.entries(UNIDADES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="i-prov" className="block text-sm font-medium">Proveedor habitual</label>
          <select id="i-prov" value={d.proveedorId ?? ''} onChange={(e) => setD({ ...d, proveedorId: e.target.value ? Number(e.target.value) : null })} className={CAMPO}>
            <option value="">—</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="i-costo" className="block text-sm font-medium">Costo por {UNIDADES[d.unidad]} (Bs)</label>
          <input id="i-costo" inputMode="decimal" value={d.costo} onChange={(e) => setD({ ...d, costo: e.target.value })} placeholder="0,00" className={`${CAMPO} text-right tabular-nums`} />
        </div>
        <div>
          <label htmlFor="i-min" className="block text-sm font-medium">Avisar cuando queden</label>
          <input id="i-min" inputMode="decimal" value={d.minimo} onChange={(e) => setD({ ...d, minimo: e.target.value })} placeholder="0" className={`${CAMPO} text-right tabular-nums`} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="i-desc" className="block text-sm font-medium">Descripción</label>
          <input id="i-desc" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} placeholder="Opcional: medida, color, marca" className={CAMPO} />
        </div>
      </fieldset>

      {!nuevo && (
        <p className="mt-2 text-xs text-tinta-suave">
          El costo se actualiza solo al recibir una compra (promedio con lo que ya había). Tocarlo
          a mano cambia el costo de todas las recetas que lo usan.
        </p>
      )}

      {puedeEditar && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pendiente} className={BOTON}>
            {pendiente ? 'Guardando…' : nuevo ? 'Crear material' : 'Guardar'}
          </button>
          {alCancelar && (
            <button type="button" onClick={alCancelar} className={BOTON_SECUNDARIO}>
              Cancelar
            </button>
          )}
          {!nuevo && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} className="accent-rosa-600" />
              En uso
            </label>
          )}
        </div>
      )}
      {aviso && <Aviso {...aviso} />}
    </form>
  )
}
