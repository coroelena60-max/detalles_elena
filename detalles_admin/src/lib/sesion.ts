import { redirect } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/servidor'

export interface Sesion {
  id: string
  email: string
  nombre: string
  permisos: Set<string>
  modulos: Set<string>
}

/**
 * Quién entró y qué puede hacer.
 *
 * Los permisos salen de la función mis_permisos() de la base, que ya cruza
 * perfil → roles → permisos. Acá se usan SOLO para pintar o esconder la UI:
 * la que impide de verdad es RLS, así que ocultar un botón nunca es la
 * protección, es la cortesía.
 */
export async function obtenerSesion(): Promise<Sesion | null> {
  const sb = await clienteServidor()

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const [{ data: perfil }, { data: permisos }] = await Promise.all([
    sb.from('perfil').select('nombre, activo').eq('id', user.id).maybeSingle(),
    sb.rpc('mis_permisos'),
  ])

  const codigos = (permisos ?? []).map((p) => p.codigo)

  return {
    id: user.id,
    email: user.email ?? '',
    nombre: perfil?.nombre?.trim() || user.email?.split('@')[0] || 'Sin nombre',
    permisos: new Set(codigos),
    modulos: new Set((permisos ?? []).map((p) => p.modulo)),
  }
}

/** Para páginas del panel: si no hay sesión, al login. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/login')
  return sesion
}

/** Para páginas de un módulo: además del login, exige el permiso. */
export async function exigirPermiso(codigo: string): Promise<Sesion> {
  const sesion = await exigirSesion()
  if (!sesion.permisos.has(codigo)) {
    redirect(`/sin-permiso?permiso=${encodeURIComponent(codigo)}`)
  }
  return sesion
}
