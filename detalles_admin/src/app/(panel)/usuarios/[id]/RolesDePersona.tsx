'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { darRol, quitarRol } from '../acciones'

export interface RolElegible {
  id: number
  nombre: string
  descripcion: string | null
  slug: string
  activo: boolean
  asignado: boolean
}

export default function RolesDePersona({
  perfilId,
  roles,
  esYo,
  puedeEditar,
  verRoles,
}: {
  perfilId: string
  roles: RolElegible[]
  esYo: boolean
  puedeEditar: boolean
  verRoles: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  function alternar(rol: RolElegible) {
    setAviso(null)
    iniciar(async () => {
      const r = rol.asignado
        ? await quitarRol(perfilId, rol.id)
        : await darRol(perfilId, rol.id)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Roles</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Los permisos no se dan de a uno: se dan con el rol. Si hace falta una combinación
        distinta, se crea un rol nuevo.
      </p>

      {roles.length === 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">
          No podemos mostrar los roles: tu cuenta no tiene permiso para verlos.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-linea">
          {roles.map((rol) => (
            <li key={rol.id} className="flex items-center gap-3 py-2.5">
              <input
                id={`rol-${rol.id}`}
                type="checkbox"
                checked={rol.asignado}
                disabled={!puedeEditar || pendiente}
                onChange={() => alternar(rol)}
                className="size-4 shrink-0 accent-rosa-600"
              />
              <label htmlFor={`rol-${rol.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="text-sm font-medium">{rol.nombre}</span>
                {!rol.activo && (
                  <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-xs text-tinta-suave">
                    inactivo
                  </span>
                )}
                {rol.descripcion && (
                  <span className="block text-xs text-tinta-suave">{rol.descripcion}</span>
                )}
              </label>
              {verRoles && (
                <Link
                  href={`/usuarios/roles/${rol.id}`}
                  className="shrink-0 text-xs text-rosa-700 hover:underline"
                >
                  Ver permisos
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {esYo && (
        <p className="mt-3 text-xs text-tinta-suave">
          Sacarte el rol de administrador a vos mismo está bloqueado en la base: es la
          forma más fácil de quedarse afuera del panel.
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
