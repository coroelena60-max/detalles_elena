'use client'

import { useState } from 'react'
import { Aviso, BOTON, CAMPO } from '@/components/ui'
import { useAccion } from '@/lib/useAccion'
import { guardarCliente } from '../../acciones'

export default function FormularioCliente({
  id,
  inicial,
  puedeEditar,
}: {
  id: number
  inicial: { nombre: string; telefono: string; email: string; notas: string }
  puedeEditar: boolean
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [d, setD] = useState(inicial)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(() => guardarCliente(id, d))
      }}
      className="tarjeta p-4"
    >
      <h2 className="text-sm font-semibold">Datos</h2>
      <fieldset disabled={!puedeEditar || pendiente} className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="cl-n" className="block text-sm font-medium">Nombre</label>
          <input id="cl-n" required value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="cl-t" className="block text-sm font-medium">Teléfono</label>
          <input id="cl-t" required inputMode="tel" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="cl-e" className="block text-sm font-medium">Correo</label>
          <input id="cl-e" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} className={CAMPO} />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="cl-o" className="block text-sm font-medium">Notas internas</label>
          <textarea id="cl-o" rows={2} value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} placeholder="Le gustan los girasoles, cumple de la mamá en marzo…" className={CAMPO} />
        </div>
      </fieldset>
      {puedeEditar && (
        <button type="submit" disabled={pendiente} className={`${BOTON} mt-3`}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      )}
      {aviso && <Aviso {...aviso} />}
    </form>
  )
}
