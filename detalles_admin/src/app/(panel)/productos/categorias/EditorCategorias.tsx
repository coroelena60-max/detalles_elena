'use client'

import { useState } from 'react'
import BotonConfirmar from '@/components/BotonConfirmar'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO, Etiqueta } from '@/components/ui'
import { useAccion } from '@/lib/useAccion'
import { borrarCategoria, guardarCategoria, type DatosCategoria } from '../maestro'

export interface Categoria {
  id: number
  nombre: string
  slug: string
  descripcion: string | null
  orden: number
  activa: boolean
  productos: number
  publicados: number
}

function Formulario({ inicial, alTerminar }: { inicial: DatosCategoria; alTerminar: () => void }) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [d, setD] = useState(inicial)
  const k = inicial.id ?? 'nueva'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(() => guardarCategoria(d), (r) => r.ok && alTerminar())
      }}
      className="rounded-lg border border-rosa-200 bg-rosa-50 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_3fr_6rem]">
        <div>
          <label htmlFor={`cn-${k}`} className="block text-xs font-medium">Nombre</label>
          <input id={`cn-${k}`} autoFocus required value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Ramos para graduación" className={CAMPO} />
        </div>
        <div>
          <label htmlFor={`cd-${k}`} className="block text-xs font-medium">Descripción</label>
          <input id={`cd-${k}`} value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} placeholder="Opcional: se muestra en el catálogo" className={CAMPO} />
        </div>
        <div>
          <label htmlFor={`co-${k}`} className="block text-xs font-medium">Orden</label>
          <input id={`co-${k}`} inputMode="numeric" value={d.orden} onChange={(e) => setD({ ...d, orden: e.target.value })} className={`${CAMPO} text-right`} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pendiente} className={BOTON}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" onClick={alTerminar} className={BOTON_SECUNDARIO}>Cancelar</button>
        {inicial.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.activa} onChange={(e) => setD({ ...d, activa: e.target.checked })} className="accent-rosa-600" />
            Se muestra en el catálogo
          </label>
        )}
      </div>
      {aviso && <Aviso {...aviso} />}
    </form>
  )
}

export default function EditorCategorias({ categorias, puedeEditar }: { categorias: Categoria[]; puedeEditar: boolean }) {
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const borrar = useAccion()
  const siguiente = String((categorias.reduce((m, c) => Math.max(m, c.orden), 0) || 0) + 1)

  return (
    <div className="mt-4">
      {puedeEditar &&
        (editando === 'nueva' ? (
          <Formulario inicial={{ nombre: '', descripcion: '', orden: siguiente, activa: true }} alTerminar={() => setEditando(null)} />
        ) : (
          <button type="button" onClick={() => setEditando('nueva')} className={BOTON}>
            Nueva categoría
          </button>
        ))}

      <ul className="tarjeta mt-4 divide-y divide-linea">
        {categorias.map((c) => (
          <li key={c.id} className="p-3">
            {editando === c.id ? (
              <Formulario
                inicial={{ id: c.id, nombre: c.nombre, descripcion: c.descripcion ?? '', orden: String(c.orden), activa: c.activa }}
                alTerminar={() => setEditando(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-6 text-center text-xs text-tinta-suave tabular-nums">{c.orden}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${c.activa ? '' : 'text-tinta-suave line-through'}`}>{c.nombre}</p>
                  <p className="text-xs text-tinta-suave">
                    <span className="font-mono">/{c.slug}</span>
                    {c.descripcion && <span className="ml-2">{c.descripcion}</span>}
                  </p>
                </div>
                <Etiqueta>
                  {c.publicados} de {c.productos} en el catálogo
                </Etiqueta>
                {!c.activa && <Etiqueta clase="bg-alerta-suave text-alerta">Oculta</Etiqueta>}
                {puedeEditar && (
                  <span className="flex gap-3">
                    <button type="button" onClick={() => setEditando(c.id)} className="text-sm text-rosa-700 hover:underline">
                      Editar
                    </button>
                    {c.productos === 0 && (
                      <BotonConfirmar
                        pregunta={`¿Borrar la categoría ${c.nombre}?`}
                        si="Sí, borrar"
                        disabled={borrar.pendiente}
                        alConfirmar={() => borrar.ejecutar(() => borrarCategoria(c.id))}
                      >
                        Borrar
                      </BotonConfirmar>
                    )}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {borrar.aviso && <Aviso {...borrar.aviso} />}
    </div>
  )
}
