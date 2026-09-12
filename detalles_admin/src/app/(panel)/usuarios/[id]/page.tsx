import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fecha, fechaHora } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { ETIQUETA_MODULO, ordenarModulos } from '../modulos'
import DatosPersona from './DatosPersona'
import RolesDePersona, { type RolElegible } from './RolesDePersona'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Usuario' }

export default async function PaginaUsuario({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await exigirPermiso('usuario.ver')
  const { id } = await params
  const sb = await clienteServidor()

  const [{ data: persona }, { data: roles }, { data: asignados }] = await Promise.all([
    sb.from('v_usuario_admin').select('*').eq('id', id).maybeSingle(),
    sb.from('rol').select('id, nombre, descripcion, slug, activo').order('nombre'),
    sb.from('usuario_rol').select('rol_id').eq('perfil_id', id),
  ])

  if (!persona) notFound()

  const puedeEditar = sesion.permisos.has('usuario.editar')
  const verRoles = sesion.permisos.has('rol.ver')
  const esYo = persona.id === sesion.id

  const tiene = new Set((asignados ?? []).map((a) => a.rol_id))
  const elegibles: RolElegible[] = (roles ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    slug: r.slug,
    activo: r.activo,
    asignado: tiene.has(r.id),
  }))

  // Lo que esos roles le habilitan de verdad, agrupado por módulo.
  const rolesDe = elegibles.filter((r) => r.asignado && r.activo).map((r) => r.id)
  const { data: permisos } = rolesDe.length
    ? await sb
        .from('rol_permiso')
        .select('permiso:permiso_id (codigo, modulo, descripcion)')
        .in('rol_id', rolesDe)
    : { data: [] }

  const porModulo = new Map<string, { codigo: string; descripcion: string | null }[]>()
  for (const fila of (permisos ?? []) as unknown as {
    permiso: { codigo: string; modulo: string; descripcion: string | null } | null
  }[]) {
    if (!fila.permiso) continue
    const lista = porModulo.get(fila.permiso.modulo) ?? []
    if (!lista.some((p) => p.codigo === fila.permiso!.codigo)) {
      lista.push({ codigo: fila.permiso.codigo, descripcion: fila.permiso.descripcion })
    }
    porModulo.set(fila.permiso.modulo, lista)
  }

  return (
    <div>
      <Link href="/usuarios" className="text-sm text-rosa-700 hover:underline">
        ← Usuarios
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{persona.nombre}</h1>
        <span className="text-sm text-tinta-suave">{persona.email}</span>
        {!persona.activo && (
          <span className="rounded-full bg-alerta-suave px-2 py-0.5 text-xs text-alerta">
            Desactivado
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <DatosPersona
            id={persona.id!}
            nombre={persona.nombre ?? ''}
            telefono={persona.telefono ?? ''}
            activo={persona.activo ?? true}
            esYo={esYo}
            puedeEditar={puedeEditar}
          />

          <RolesDePersona
            perfilId={persona.id!}
            roles={elegibles}
            esYo={esYo}
            puedeEditar={puedeEditar}
            verRoles={verRoles}
          />
        </div>

        <div className="space-y-4">
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">La cuenta</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Alta</dt>
                <dd>{fecha(persona.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Última entrada</dt>
                <dd>{persona.ultimo_acceso ? fechaHora(persona.ultimo_acceso) : 'Nunca'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Correo confirmado</dt>
                <dd>{persona.confirmado ? 'Sí' : 'No'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Permisos</dt>
                <dd>{persona.permisos ?? 0}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-tinta-suave">
              La contraseña la maneja Supabase: desde el panel no se ve ni se cambia. Si la
              perdió, se le manda un correo de recuperación desde el login.
            </p>
          </section>

          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">Qué puede hacer</h2>
            {porModulo.size === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">
                {verRoles
                  ? 'Nada todavía: no tiene ningún rol activo.'
                  : 'Necesitás permiso de roles para ver el detalle.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ordenarModulos([...porModulo.keys()]).map((modulo) => (
                  <li key={modulo}>
                    <p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
                      {ETIQUETA_MODULO[modulo] ?? modulo}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {(porModulo.get(modulo) ?? []).map((p) => (
                        <li key={p.codigo} className="text-sm">
                          {p.descripcion ?? p.codigo}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
