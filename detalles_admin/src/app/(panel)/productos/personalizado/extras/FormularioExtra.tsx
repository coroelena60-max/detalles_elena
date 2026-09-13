'use client'

import { useState } from 'react'
import { Aviso, BOTON, CAMPO } from '@/components/ui'
import { ESTADOS_PUBLICACION, type EstadoPublicacion } from '@/lib/estados'
import { useAccion } from '@/lib/useAccion'
import { guardarExtra, type DatosExtra } from '../../maestro'

export default function FormularioExtra({
  inicial,
  categorias,
  puedeEditar,
}: {
  inicial?: DatosExtra
  categorias: { id: number; nombre: string }[]
  puedeEditar: boolean
}) {
  const { pendiente, aviso, ejecutar, router } = useAccion()
  const nuevo = !inicial?.id
  const [d, setD] = useState<DatosExtra>(
    inicial ?? {
      nombre: '',
      descripcion: '',
      categoriaId: categorias[0]?.id ?? null,
      precio: '',
      espacios: '1',
      unidad: 'unidad',
      estado: 'borrador',
      orden: '0',
      stockMinimo: '0',
      minutosArmado: '',
    },
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(
          () => guardarExtra(d),
          (r) => r.ok && nuevo && r.id && router.push(`/productos/personalizado/extras/${r.id}`),
        )
      }}
      className="tarjeta p-4"
    >
      <h2 className="text-sm font-semibold">{nuevo ? 'Nuevo extra' : 'Datos del extra'}</h2>
      <fieldset disabled={!puedeEditar || pendiente} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="e-nombre" className="block text-sm font-medium">Nombre</label>
          <input id="e-nombre" required value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Tulipán" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="e-cat" className="block text-sm font-medium">Tipo</label>
          <select id="e-cat" value={d.categoriaId ?? ''} onChange={(e) => setD({ ...d, categoriaId: e.target.value ? Number(e.target.value) : null })} className={CAMPO}>
            <option value="">—</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="e-estado" className="block text-sm font-medium">Estado</label>
          <select id="e-estado" value={d.estado} onChange={(e) => setD({ ...d, estado: e.target.value as EstadoPublicacion })} className={CAMPO}>
            {Object.entries(ESTADOS_PUBLICACION).map(([k, v]) => (
              <option key={k} value={k}>{v.etiqueta}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="e-precio" className="block text-sm font-medium">Precio de venta (Bs)</label>
          <input id="e-precio" required inputMode="decimal" value={d.precio} onChange={(e) => setD({ ...d, precio: e.target.value })} className={`${CAMPO} text-right tabular-nums`} />
        </div>
        <div>
          <label htmlFor="e-esp" className="block text-sm font-medium">Espacios que ocupa</label>
          <input id="e-esp" inputMode="decimal" value={d.espacios} onChange={(e) => setD({ ...d, espacios: e.target.value })} className={`${CAMPO} text-right tabular-nums`} />
          <p className="mt-1 text-xs text-tinta-suave">Rosa 1, girasol 2, peluche 8, tarjeta 0.</p>
        </div>
        <div>
          <label htmlFor="e-min" className="block text-sm font-medium">Minutos de armado</label>
          <input id="e-min" inputMode="numeric" value={d.minutosArmado} onChange={(e) => setD({ ...d, minutosArmado: e.target.value })} placeholder="—" className={`${CAMPO} text-right tabular-nums`} />
          <p className="mt-1 text-xs text-tinta-suave">Por unidad. Suma mano de obra al costo.</p>
        </div>
        <div>
          <label htmlFor="e-stock" className="block text-sm font-medium">Avisar cuando queden</label>
          <input id="e-stock" inputMode="decimal" value={d.stockMinimo} onChange={(e) => setD({ ...d, stockMinimo: e.target.value })} className={`${CAMPO} text-right tabular-nums`} />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="e-desc" className="block text-sm font-medium">Descripción</label>
          <input id="e-desc" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} placeholder="Opcional: se muestra en el catálogo" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="e-orden" className="block text-sm font-medium">Orden</label>
          <input id="e-orden" inputMode="numeric" value={d.orden} onChange={(e) => setD({ ...d, orden: e.target.value })} className={`${CAMPO} text-right`} />
        </div>
      </fieldset>

      {puedeEditar && (
        <button type="submit" disabled={pendiente} className={`${BOTON} mt-4`}>
          {pendiente ? 'Guardando…' : nuevo ? 'Crear extra' : 'Guardar'}
        </button>
      )}
      {aviso && <Aviso {...aviso} />}
    </form>
  )
}
