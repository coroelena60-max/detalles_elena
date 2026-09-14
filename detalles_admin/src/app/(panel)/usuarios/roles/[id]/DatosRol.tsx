'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { borrarRol, guardarRol } from '../../acciones'

export default function DatosRol({
  id,
  nombre,
  descripcion,
  activo,
  esSistema,
  usuarios,
  puedeEditar,
}: {
  id: number
  nombre: string
  descripcion: string
  activo: boolean
  esSistema: boolean
  usuarios: number
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [campos, setCampos] = useState({ nombre, descripcion, activo })
  const [confirmar, setConfirmar] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  function guardar() {
    setAviso(null)
    iniciar(async () => {
      const r = await guardarRol(id, campos.nombre, campos.descripcion, campos.activo)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  function borrar() {
    setAviso(null)
    iniciar(async () => {
      const r = await borrarRol(id)
      if (r.ok) {
        router.push('/usuarios/roles')
        return
      }
      setConfirmar(false)
      setAviso({ ok: false, texto: r.mensaje })
    })
  }

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">El rol</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rol-nombre" className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id="rol-nombre"
            value={campos.nombre}
            disabled={!puedeEditar || pendiente}
            onChange={(e) => setCampos({ ...campos, nombre: e.target.value })}
            className="campo mt-1 focus:campo-foco disabled:bg-fondo"
          />
        </div>
        <div>
          <label htmlFor="rol-desc" className="block text-sm font-medium">
            Para qué sirve
          </label>
          <input
            id="rol-desc"
            value={campos.descripcion}
            disabled={!puedeEditar || pendiente}
            onChange={(e) => setCampos({ ...campos, descripcion: e.target.value })}
            className="campo mt-1 focus:campo-foco disabled:bg-fondo"
          />
        </div>
      </div>

      {puedeEditar && (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={campos.activo}
              disabled={pendiente}
              onChange={(e) => setCampos({ ...campos, activo: e.target.checked })}
              className="size-4 accent-rosa-600"
            />
            En uso
            <span className="text-sm text-tinta-suave">— apagado no da permisos</span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={guardar}
              className="rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
            >
              Guardar
            </button>

            {!esSistema &&
              (confirmar ? (
                <>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={borrar}
                    className="rounded-lg bg-alerta px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
                  >
                    Sí, borrar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => setConfirmar(false)}
                    className="rounded-lg px-4 py-2 text-sm text-tinta-suave transition hover:bg-white"
                  >
                    No
                  </button>
                  <span className="text-xs text-alerta">
                    {usuarios > 0
                      ? `${usuarios} persona${usuarios === 1 ? '' : 's'} se queda${
                          usuarios === 1 ? '' : 'n'
                        } sin estos permisos.`
                      : 'No lo tiene nadie: se puede borrar tranquilo.'}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => setConfirmar(true)}
                  className="rounded-lg border border-linea px-4 py-2 text-sm text-tinta-suave transition hover:border-alerta hover:text-alerta disabled:opacity-60"
                >
                  Borrar rol
                </button>
              ))}
          </div>
        </>
      )}

      {esSistema && (
        <p className="mt-3 text-sm text-tinta-suave">
          Este rol no se puede borrar.
        </p>
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
