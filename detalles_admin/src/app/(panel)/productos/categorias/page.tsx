import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import { ErrorCarga } from '@/components/ui'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import EditorCategorias from './EditorCategorias'

export const metadata: Metadata = { title: 'Categorías' }
export const dynamic = 'force-dynamic'

const PUBLICADOS = ['activo', 'agotado', 'temporada']

export default async function PaginaCategorias() {
  const sesion = await exigirPermiso('maestro.ver')
  const sb = await clienteServidor()

  const [{ data, error }, { data: productos }] = await Promise.all([
    sb.from('categoria').select('id, nombre, slug, descripcion, orden, activa').order('orden'),
    sb.from('producto').select('categoria_id, estado'),
  ])

  const total = new Map<number, number>()
  const publicados = new Map<number, number>()
  for (const p of productos ?? []) {
    total.set(p.categoria_id, (total.get(p.categoria_id) ?? 0) + 1)
    if (PUBLICADOS.includes(p.estado)) publicados.set(p.categoria_id, (publicados.get(p.categoria_id) ?? 0) + 1)
  }

  return (
    <div>
      <Encabezado
        titulo="Categorías"
        descripcion="Cómo se agrupan los ramos en el catálogo. El orden es el de las pestañas que ve el cliente."
        modulo="maestro"
        permisos={sesion.permisos}
      />
      {error && <ErrorCarga que="las categorías" mensaje={error.message} />}
      <EditorCategorias
        puedeEditar={sesion.permisos.has('maestro.editar')}
        categorias={(data ?? []).map((c) => ({
          ...c,
          productos: total.get(c.id) ?? 0,
          publicados: publicados.get(c.id) ?? 0,
        }))}
      />
      <p className="mt-3 text-xs text-tinta-suave">
        Renombrar una categoría no le cambia la dirección (/ramos-cono): los enlaces que ya
        circulan siguen funcionando. Una categoría con productos no se borra, se oculta.
      </p>
    </div>
  )
}
