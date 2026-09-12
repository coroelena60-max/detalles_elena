import type { Metadata } from 'next'
import Link from 'next/link'
import { haceCuanto } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import Encabezado from '@/components/Encabezado'

export const metadata: Metadata = { title: 'Usuarios' }
export const dynamic = 'force-dynamic'

export default async function PaginaUsuarios() {
  const sesion = await exigirPermiso('usuario.ver')
  const sb = await clienteServidor()

  const { data: usuarios, error } = await sb
    .from('v_usuario_admin')
    .select('*')
    .order('activo', { ascending: false })
    .order('nombre')

  return (
    <div>
      <Encabezado
        titulo="Usuarios"
        descripcion="Quiénes entran al panel y qué puede hacer cada uno."
        modulo="administracion"
        permisos={sesion.permisos}
      />

      {error && (
        <p className="tarjeta mt-4 border-alerta bg-alerta-suave p-4 text-sm text-alerta">
          No pudimos cargar los usuarios: {error.message}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {(usuarios ?? []).map((u) => (
          <li key={u.id}>
            <Link
              href={`/usuarios/${u.id}`}
              className="tarjeta flex flex-wrap items-center gap-x-3 gap-y-1 p-3 transition hover:border-rosa-300"
            >
              <span
                aria-hidden
                className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-medium ${
                  u.activo ? 'bg-rosa-100 text-rosa-700' : 'bg-fondo text-tinta-suave'
                }`}
              >
                {(u.nombre ?? '?').trim().charAt(0).toUpperCase() || '?'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.nombre}
                  {u.id === sesion.id && (
                    <span className="ml-2 text-xs font-normal text-tinta-suave">vos</span>
                  )}
                </p>
                <p className="truncate text-xs text-tinta-suave">{u.email}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(u.roles ?? []).length > 0 ? (
                  (u.roles ?? []).map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-fondo px-2 py-0.5 text-xs text-tinta-suave"
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-aviso-suave px-2 py-0.5 text-xs text-aviso">
                    Sin rol
                  </span>
                )}
              </div>

              <span className="w-24 shrink-0 text-right text-xs text-tinta-suave">
                {u.ultimo_acceso ? haceCuanto(u.ultimo_acceso) : 'nunca entró'}
              </span>

              {!u.activo && (
                <span className="shrink-0 rounded-full bg-alerta-suave px-2 py-0.5 text-xs text-alerta">
                  Desactivado
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {usuarios && usuarios.length === 0 && !error && (
        <p className="tarjeta mt-4 p-6 text-sm text-tinta-suave">
          Todavía no hay nadie más que vos.
        </p>
      )}

      <p className="mt-4 text-xs text-tinta-suave">
        Las cuentas se crean en Supabase (Authentication → Add user). La persona aparece
        en esta lista apenas se crea la cuenta, sin ningún rol: el rol se lo das acá.
      </p>
    </div>
  )
}
