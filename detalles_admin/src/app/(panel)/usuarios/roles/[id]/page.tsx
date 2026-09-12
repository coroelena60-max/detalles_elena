import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { ordenarModulos } from '../../modulos'
import DatosRol from './DatosRol'
import MatrizPermisos, { type GrupoPermisos } from './MatrizPermisos'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Rol' }

export default async function PaginaRol({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await exigirPermiso('rol.ver')
  const { id: crudo } = await params
  const id = Number(crudo)
  if (!Number.isInteger(id)) notFound()

  const sb = await clienteServidor()

  const [{ data: rol }, { data: filas }] = await Promise.all([
    sb.from('v_rol_admin').select('*').eq('id', id).maybeSingle(),
    sb
      .from('v_rol_permiso')
      .select('codigo, modulo, descripcion, asignado')
      .eq('rol_id', id)
      .order('codigo'),
  ])

  if (!rol) notFound()

  const puedeEditar = sesion.permisos.has('rol.editar')
  // los dos roles que siempre tienen todo: la matriz es de solo lectura
  const esCompleto = rol.slug === 'admin' || rol.slug === 'superadmin'

  const mapa = new Map<string, GrupoPermisos['permisos']>()
  for (const f of filas ?? []) {
    if (!f.codigo || !f.modulo) continue
    const lista = mapa.get(f.modulo) ?? []
    lista.push({
      codigo: f.codigo,
      descripcion: f.descripcion ?? f.codigo,
      asignado: f.asignado ?? false,
    })
    mapa.set(f.modulo, lista)
  }

  const grupos: GrupoPermisos[] = ordenarModulos([...mapa.keys()]).map((modulo) => ({
    modulo,
    permisos: mapa.get(modulo) ?? [],
  }))

  return (
    <div>
      <Link href="/usuarios/roles" className="text-sm text-rosa-700 hover:underline">
        ← Roles
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{rol.nombre}</h1>
        <span className="text-sm text-tinta-suave">
          {rol.usuarios === 0
            ? 'nadie lo tiene'
            : `${rol.usuarios} persona${rol.usuarios === 1 ? '' : 's'}`}
        </span>
        {rol.es_sistema && (
          <span className="rounded-full bg-fondo px-2 py-0.5 text-xs text-tinta-suave">
            de sistema
          </span>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <DatosRol
          id={id}
          nombre={rol.nombre ?? ''}
          descripcion={rol.descripcion ?? ''}
          activo={rol.activo ?? true}
          esSistema={rol.es_sistema ?? false}
          usuarios={rol.usuarios ?? 0}
          puedeEditar={puedeEditar}
        />

        <MatrizPermisos
          rolId={id}
          grupos={grupos}
          esCompleto={esCompleto}
          puedeEditar={puedeEditar}
        />
      </div>
    </div>
  )
}
