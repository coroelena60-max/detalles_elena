'use client'

import { useState } from 'react'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO, Etiqueta } from '@/components/ui'
import { useAccion } from '@/lib/useAccion'
import { guardarProveedor, type DatosProveedor } from '../acciones'

export interface Proveedor {
  id: number
  nombre: string
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  activo: boolean
  insumos: number
  compras: number
}

const VACIO: DatosProveedor = { nombre: '', telefono: '', email: '', direccion: '', notas: '', activo: true }

function Formulario({
  inicial,
  alTerminar,
}: {
  inicial: DatosProveedor
  alTerminar: () => void
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [d, setD] = useState(inicial)
  const id = inicial.id ?? 'nuevo'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(() => guardarProveedor(d), (r) => r.ok && alTerminar())
      }}
      className="rounded-lg border border-rosa-200 bg-rosa-50 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor={`pn-${id}`} className="block text-xs font-medium">Nombre</label>
          <input id={`pn-${id}`} required autoFocus value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Papelería El Sol" className={CAMPO} />
        </div>
        <div>
          <label htmlFor={`pt-${id}`} className="block text-xs font-medium">Teléfono / WhatsApp</label>
          <input id={`pt-${id}`} inputMode="numeric" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} placeholder="70000000" className={CAMPO} />
        </div>
        <div>
          <label htmlFor={`pe-${id}`} className="block text-xs font-medium">Correo</label>
          <input id={`pe-${id}`} type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="Opcional" className={CAMPO} />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor={`pd-${id}`} className="block text-xs font-medium">Dirección</label>
          <input id={`pd-${id}`} value={d.direccion} onChange={(e) => setD({ ...d, direccion: e.target.value })} placeholder="Mercado Los Pozos, puesto 12" className={CAMPO} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`po-${id}`} className="block text-xs font-medium">Notas</label>
          <input id={`po-${id}`} value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} placeholder="Qué vende, horarios, si hace delivery…" className={CAMPO} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pendiente} className={BOTON}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={alTerminar} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
        {inicial.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} className="accent-rosa-600" />
            Le seguimos comprando
          </label>
        )}
      </div>
      {aviso && <Aviso {...aviso} />}
    </form>
  )
}

export default function EditorProveedores({
  proveedores,
  puedeEditar,
}: {
  proveedores: Proveedor[]
  puedeEditar: boolean
}) {
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)

  return (
    <div className="mt-4">
      {puedeEditar &&
        (editando === 'nuevo' ? (
          <Formulario inicial={VACIO} alTerminar={() => setEditando(null)} />
        ) : (
          <button type="button" onClick={() => setEditando('nuevo')} className={BOTON}>
            Nuevo proveedor
          </button>
        ))}

      {proveedores.length === 0 ? (
        <p className="tarjeta mt-4 p-6 text-sm text-tinta-suave">
          Todavía no hay proveedores.
        </p>
      ) : (
        <ul className="tarjeta mt-4 divide-y divide-linea">
          {proveedores.map((p) => (
            <li key={p.id} className="p-3">
              {editando === p.id ? (
                <Formulario
                  inicial={{
                    id: p.id,
                    nombre: p.nombre,
                    telefono: p.telefono ?? '',
                    email: p.email ?? '',
                    direccion: p.direccion ?? '',
                    notas: p.notas ?? '',
                    activo: p.activo,
                  }}
                  alTerminar={() => setEditando(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${p.activo ? '' : 'text-tinta-suave line-through'}`}>{p.nombre}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-tinta-suave">
                      {p.telefono && (
                        <a href={`https://wa.me/591${p.telefono}`} target="_blank" rel="noreferrer" className="text-rosa-700 hover:underline">
                          {p.telefono}
                        </a>
                      )}
                      {p.direccion && <span>{p.direccion}</span>}
                      {p.notas && <span>{p.notas}</span>}
                    </p>
                  </div>
                  <Etiqueta>{p.insumos} insumo{p.insumos === 1 ? '' : 's'}</Etiqueta>
                  <Etiqueta>{p.compras} compra{p.compras === 1 ? '' : 's'}</Etiqueta>
                  {puedeEditar && (
                    <button type="button" onClick={() => setEditando(p.id)} className="text-xs text-rosa-700 hover:underline">
                      Editar
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
