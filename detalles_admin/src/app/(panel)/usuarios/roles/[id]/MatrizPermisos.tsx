'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ETIQUETA_MODULO } from '../../modulos'
import { definirPermisos } from '../../acciones'

export interface GrupoPermisos {
  modulo: string
  permisos: { codigo: string; descripcion: string; asignado: boolean }[]
}

export default function MatrizPermisos({
  rolId,
  grupos,
  esCompleto,
  puedeEditar,
}: {
  rolId: number
  grupos: GrupoPermisos[]
  esCompleto: boolean
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const inicial = useMemo(
    () =>
      new Set(
        grupos.flatMap((g) => g.permisos.filter((p) => p.asignado).map((p) => p.codigo)),
      ),
    [grupos],
  )
  const [elegidos, setElegidos] = useState<Set<string>>(inicial)

  const editable = puedeEditar && !esCompleto

  const sucio =
    elegidos.size !== inicial.size || [...elegidos].some((c) => !inicial.has(c))

  function alternar(codigo: string) {
    const copia = new Set(elegidos)
    if (copia.has(codigo)) copia.delete(codigo)
    else copia.add(codigo)
    setElegidos(copia)
  }

  function alternarModulo(grupo: GrupoPermisos, marcar: boolean) {
    const copia = new Set(elegidos)
    for (const p of grupo.permisos) {
      if (marcar) copia.add(p.codigo)
      else copia.delete(p.codigo)
    }
    setElegidos(copia)
  }

  function guardar() {
    setAviso(null)
    iniciar(async () => {
      const r = await definirPermisos(rolId, [...elegidos])
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  return (
    <section className="tarjeta p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Qué puede hacer este rol</h2>
        <span className="text-xs text-tinta-suave">
          {elegidos.size} de {grupos.reduce((s, g) => s + g.permisos.length, 0)}
        </span>
      </div>

      {esCompleto && (
        <p className="mt-3 rounded-lg bg-fondo px-3 py-2 text-sm text-tinta-suave">
          Este rol siempre tiene todos los permisos.
        </p>
      )}

      <div className="mt-4 space-y-5">
        {grupos.map((g) => {
          const marcados = g.permisos.filter((p) => elegidos.has(p.codigo)).length
          const todos = marcados === g.permisos.length
          return (
            <div key={g.modulo}>
              <div className="flex items-baseline justify-between gap-2 border-b border-linea pb-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
                  {ETIQUETA_MODULO[g.modulo] ?? g.modulo}
                </h3>
                {editable && (
                  <button
                    type="button"
                    onClick={() => alternarModulo(g, !todos)}
                    className="text-xs text-rosa-700 hover:underline"
                  >
                    {todos ? 'Ninguno' : 'Todos'}
                  </button>
                )}
              </div>

              <ul className="mt-1">
                {g.permisos.map((p) => (
                  <li key={p.codigo} className="flex items-start gap-3 py-2">
                    <input
                      id={`p-${p.codigo}`}
                      type="checkbox"
                      checked={esCompleto || elegidos.has(p.codigo)}
                      disabled={!editable || pendiente}
                      onChange={() => alternar(p.codigo)}
                      className="mt-0.5 size-4 shrink-0 accent-rosa-600"
                    />
                    <label
                      htmlFor={`p-${p.codigo}`}
                      className={`min-w-0 flex-1 text-sm ${editable ? 'cursor-pointer' : ''}`}
                    >
                      {p.descripcion}
                      <span className="ml-2 font-mono text-xs text-tinta-suave">
                        {p.codigo}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {editable && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-linea pt-4">
          <button
            type="button"
            disabled={pendiente || !sucio}
            onClick={guardar}
            className="rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
          >
            {pendiente ? 'Guardando…' : 'Guardar permisos'}
          </button>
          {sucio && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => setElegidos(inicial)}
              className="rounded-lg px-4 py-2 text-sm text-tinta-suave transition hover:bg-white"
            >
              Deshacer
            </button>
          )}
          <span className="text-xs text-tinta-suave">
            {sucio ? 'Hay cambios sin guardar.' : 'Todo guardado.'}
          </span>
        </div>
      )}

      {aviso && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </section>
  )
}
