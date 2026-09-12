'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cambiarActivo, guardarPerfil } from '../acciones'

export default function DatosPersona({
  id,
  nombre,
  telefono,
  activo,
  esYo,
  puedeEditar,
}: {
  id: string
  nombre: string
  telefono: string
  activo: boolean
  esYo: boolean
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [campos, setCampos] = useState({ nombre, telefono })

  function accion(fn: () => Promise<{ ok: boolean; mensaje: string }>) {
    setAviso(null)
    iniciar(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Datos de la persona</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id="nombre"
            value={campos.nombre}
            disabled={!puedeEditar || pendiente}
            onChange={(e) => setCampos({ ...campos, nombre: e.target.value })}
            className="campo mt-1 focus:campo-foco disabled:bg-fondo"
          />
        </div>
        <div>
          <label htmlFor="telefono" className="block text-sm font-medium">
            Teléfono
          </label>
          <input
            id="telefono"
            inputMode="numeric"
            placeholder="67849464"
            value={campos.telefono}
            disabled={!puedeEditar || pendiente}
            onChange={(e) => setCampos({ ...campos, telefono: e.target.value })}
            className="campo mt-1 focus:campo-foco disabled:bg-fondo"
          />
        </div>
      </div>

      {puedeEditar && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pendiente}
            onClick={() => accion(() => guardarPerfil(id, campos.nombre, campos.telefono))}
            className="rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
          >
            Guardar
          </button>

          {!esYo && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => accion(() => cambiarActivo(id, !activo))}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
                activo
                  ? 'border-linea text-tinta-suave hover:border-alerta hover:text-alerta'
                  : 'border-rosa-300 text-rosa-700 hover:bg-rosa-50'
              }`}
            >
              {activo ? 'Quitarle la entrada' : 'Dejarla entrar de nuevo'}
            </button>
          )}
        </div>
      )}

      {esYo && puedeEditar && (
        <p className="mt-3 text-xs text-tinta-suave">
          Es tu propia cuenta: no podés desactivarte ni quitarte el rol de administrador.
          Eso lo tiene que hacer otro administrador, a propósito.
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
