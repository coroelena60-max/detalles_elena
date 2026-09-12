import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import Encabezado from '@/components/Encabezado'
import NuevoRol from './NuevoRol'

export const metadata: Metadata = { title: 'Roles' }
export const dynamic = 'force-dynamic'

export default async function PaginaRoles() {
  const sesion = await exigirPermiso('rol.ver')
  const sb = await clienteServidor()

  const [{ data: roles, error }, { count: totalPermisos }] = await Promise.all([
    sb.from('v_rol_admin').select('*').order('es_sistema', { ascending: false }).order('nombre'),
    sb.from('permiso').select('id', { count: 'exact', head: true }),
  ])

  const puedeEditar = sesion.permisos.has('rol.editar')

  return (
    <div>
      <Encabezado
        titulo="Roles"
        descripcion="Un rol es un paquete de permisos. Se le da a una persona entera, no de a pedazos."
        modulo="administracion"
        permisos={sesion.permisos}
      />

      {error && (
        <p className="tarjeta mt-4 border-alerta bg-alerta-suave p-4 text-sm text-alerta">
          No pudimos cargar los roles: {error.message}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {(roles ?? []).map((r) => (
          <li key={r.id}>
            <Link
              href={`/usuarios/roles/${r.id}`}
              className="tarjeta flex flex-wrap items-center gap-x-3 gap-y-1 p-3 transition hover:border-rosa-300"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {r.nombre}
                  {r.es_sistema && (
                    <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-xs font-normal text-tinta-suave">
                      de sistema
                    </span>
                  )}
                  {!r.activo && (
                    <span className="ml-2 rounded-full bg-alerta-suave px-2 py-0.5 text-xs font-normal text-alerta">
                      inactivo
                    </span>
                  )}
                </p>
                {r.descripcion && (
                  <p className="mt-0.5 truncate text-xs text-tinta-suave">{r.descripcion}</p>
                )}
              </div>

              <span className="shrink-0 text-xs text-tinta-suave">
                {r.permisos} de {totalPermisos ?? '—'} permisos ·{' '}
                {r.usuarios === 0
                  ? 'sin gente'
                  : `${r.usuarios} persona${r.usuarios === 1 ? '' : 's'}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {puedeEditar && <NuevoRol />}
    </div>
  )
}
