import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import { ErrorCarga } from '@/components/ui'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import EditorProveedores from './EditorProveedores'

export const metadata: Metadata = { title: 'Proveedores' }
export const dynamic = 'force-dynamic'

export default async function PaginaProveedores() {
  const sesion = await exigirPermiso('proveedor.ver')
  const sb = await clienteServidor()

  const [{ data, error }, { data: insumos }, { data: compras }] = await Promise.all([
    sb.from('proveedor').select('*').order('activo', { ascending: false }).order('nombre'),
    sb.from('insumo').select('proveedor_id'),
    sb.from('compra').select('proveedor_id').eq('estado', 'recibida'),
  ])

  const contar = (filas: { proveedor_id: number | null }[] | null) => {
    const m = new Map<number, number>()
    for (const f of filas ?? []) if (f.proveedor_id) m.set(f.proveedor_id, (m.get(f.proveedor_id) ?? 0) + 1)
    return m
  }
  const porInsumo = contar(insumos)
  const porCompra = contar(compras)

  return (
    <div>
      <Encabezado
        titulo="Proveedores"
        descripcion="A quién se le compran los insumos."
        modulo="compra"
        permisos={sesion.permisos}
      />
      {error && <ErrorCarga que="los proveedores" mensaje={error.message} />}
      <EditorProveedores
        puedeEditar={sesion.permisos.has('proveedor.editar')}
        proveedores={(data ?? []).map((p) => ({
          ...p,
          insumos: porInsumo.get(p.id) ?? 0,
          compras: porCompra.get(p.id) ?? 0,
        }))}
      />
    </div>
  )
}
