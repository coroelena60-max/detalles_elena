'use client'

import { useState } from 'react'
import { Aviso, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import { useAccion } from '@/lib/useAccion'
import { cambiarTipoGasto, crearTipoGasto } from './acciones'

export default function TiposGasto({
  tipos,
  puedeEditar,
}: {
  tipos: { id: number; nombre: string; descripcion: string | null; activa: boolean }[]
  puedeEditar: boolean
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')

  return (
    <details className="tarjeta mt-6 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Tipos de gasto <span className="font-normal text-tinta-suave">({tipos.length})</span>
      </summary>

      <ul className="mt-3 divide-y divide-linea">
        {tipos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${t.activa ? '' : 'text-tinta-suave line-through'}`}>
                {t.nombre}
              </p>
              {t.descripcion && <p className="text-xs text-tinta-suave">{t.descripcion}</p>}
            </div>
            {puedeEditar && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => ejecutar(() => cambiarTipoGasto(t.id, !t.activa))}
                className="text-xs text-rosa-700 hover:underline disabled:opacity-50"
              >
                {t.activa ? 'Dejar de usar' : 'Volver a usar'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {puedeEditar && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ejecutar(
              () => crearTipoGasto(nombre, descripcion),
              (r) => {
                if (r.ok) {
                  setNombre('')
                  setDescripcion('')
                }
              },
            )
          }}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-linea pt-3"
        >
          <div className="min-w-40 flex-1">
            <label htmlFor="tg-nombre" className="block text-sm font-medium">
              Nuevo tipo
            </label>
            <input
              id="tg-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Empaques para delivery"
              className={CAMPO}
            />
          </div>
          <div className="min-w-40 flex-[2]">
            <label htmlFor="tg-desc" className="block text-sm font-medium">
              Qué entra acá
            </label>
            <input
              id="tg-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
              className={CAMPO}
            />
          </div>
          <button type="submit" disabled={pendiente} className={BOTON_SECUNDARIO}>
            Agregar
          </button>
        </form>
      )}
      {aviso && <Aviso {...aviso} />}
    </details>
  )
}
