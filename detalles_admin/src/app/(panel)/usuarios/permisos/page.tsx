import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import Encabezado from '@/components/Encabezado'
import { ETIQUETA_MODULO, ordenarModulos } from '../modulos'

export const metadata: Metadata = { title: 'Permisos' }
export const dynamic = 'force-dynamic'

/**
 * El catálogo de permisos es FIJO: no se crea ni se borra desde el panel
 * (la base ni siquiera lo permite). Esta pantalla es de consulta: qué
 * permisos existen y qué rol tiene cada uno.
 */
export default async function PaginaPermisos() {
  const sesion = await exigirPermiso('rol.ver')
  const sb = await clienteServidor()

  const [{ data: permisos, error }, { data: roles }, { data: asignados }] =
    await Promise.all([
      sb.from('permiso').select('id, codigo, modulo, descripcion').order('codigo'),
      sb.from('rol').select('id, nombre, slug').order('nombre'),
      sb.from('rol_permiso').select('rol_id, permiso_id'),
    ])

  // permiso -> los roles que lo tienen
  const porPermiso = new Map<number, string[]>()
  const nombreDeRol = new Map((roles ?? []).map((r) => [r.id, r.nombre]))
  for (const a of asignados ?? []) {
    const nombre = nombreDeRol.get(a.rol_id)
    if (!nombre) continue
    porPermiso.set(a.permiso_id, [...(porPermiso.get(a.permiso_id) ?? []), nombre])
  }

  const porModulo = new Map<string, typeof permisos>()
  for (const p of permisos ?? []) {
    porModulo.set(p.modulo, [...(porModulo.get(p.modulo) ?? []), p])
  }

  return (
    <div>
      <Encabezado
        titulo="Permisos"
        descripcion="Qué se puede hacer en el panel. Se reparten con los roles."
        modulo="administracion"
        permisos={sesion.permisos}
      />

      {error && (
        <p className="tarjeta mt-4 border-alerta bg-alerta-suave p-4 text-sm text-alerta">
          No pudimos cargar los permisos: {error.message}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {ordenarModulos([...porModulo.keys()]).map((modulo) => (
          <section key={modulo} className="tarjeta p-4">
            <h2 className="text-sm font-semibold">
              {ETIQUETA_MODULO[modulo] ?? modulo}
            </h2>
            <ul className="mt-2 divide-y divide-linea">
              {(porModulo.get(modulo) ?? []).map((p) => {
                const quienes = porPermiso.get(p.id) ?? []
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
                  >
                    <span className="min-w-0 flex-1 text-sm">
                      {p.descripcion ?? p.codigo}
                      <span className="ml-2 font-mono text-xs text-tinta-suave">
                        {p.codigo}
                      </span>
                    </span>
                    <span className="text-xs text-tinta-suave">
                      {quienes.length === 0 ? 'ningún rol' : quienes.join(' · ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-4 text-sm text-tinta-suave">
        Para dar o quitar permisos se cambia el{' '}
        <Link href="/usuarios/roles" className="text-rosa-700 hover:underline">
          rol
        </Link>
         de la persona.
      </p>
    </div>
  )
}
