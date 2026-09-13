import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Etiqueta } from '@/components/ui'
import { ESTADOS_COMPRA } from '@/lib/estados'
import { fechaHora } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import EditorCompra, { type ItemCompra } from './EditorCompra'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  return { title: (await params).codigo }
}

export default async function PaginaCompra({ params }: { params: Promise<{ codigo: string }> }) {
  const sesion = await exigirPermiso('compra.ver')
  const codigo = decodeURIComponent((await params).codigo).toUpperCase()
  if (!/^COM-\d{5,}$/.test(codigo)) notFound()
  const sb = await clienteServidor()

  const { data: compra } = await sb
    .from('compra')
    .select(
      'id, codigo, estado, proveedor_id, fecha, documento, nota, subtotal, descuento, total, recibida_at, created_at, registrado:registrado_por (nombre), items:compra_item (id, cantidad, costo_unitario, subtotal, insumo:insumo_id (nombre, unidad))',
    )
    .eq('codigo', codigo)
    .maybeSingle()

  if (!compra) notFound()

  const [{ data: insumos }, { data: proveedores }] = await Promise.all([
    sb.from('insumo').select('id, nombre, unidad, costo_unitario').eq('activo', true).order('nombre'),
    sb.from('proveedor').select('id, nombre').order('nombre'),
  ])

  const items: ItemCompra[] = (
    (compra.items ?? []) as unknown as {
      id: number
      cantidad: number
      costo_unitario: number
      subtotal: number
      insumo: { nombre: string; unidad: ItemCompra['unidad'] } | null
    }[]
  ).map((i) => ({
    id: i.id,
    insumo: i.insumo?.nombre ?? '—',
    unidad: i.insumo?.unidad ?? 'unidad',
    cantidad: Number(i.cantidad),
    costo: Number(i.costo_unitario),
    subtotal: Number(i.subtotal),
  }))

  const est = ESTADOS_COMPRA[compra.estado]
  const registrado = compra.registrado as { nombre: string } | null

  return (
    <div>
      <Link href="/compras" className="text-sm text-rosa-700 hover:underline">
        ← Compras
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{compra.codigo}</h1>
        <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>
        <span className="text-xs text-tinta-suave">
          creada {fechaHora(compra.created_at)}
          {registrado?.nombre ? ` por ${registrado.nombre}` : ''}
          {compra.recibida_at ? ` · recibida ${fechaHora(compra.recibida_at)}` : ''}
        </span>
      </div>

      <div className="mt-5">
        <EditorCompra
          compra={{
            id: compra.id,
            codigo: compra.codigo ?? codigo,
            estado: compra.estado,
            proveedorId: compra.proveedor_id,
            fecha: compra.fecha,
            documento: compra.documento ?? '',
            nota: compra.nota ?? '',
            subtotal: Number(compra.subtotal),
            descuento: Number(compra.descuento),
            total: Number(compra.total),
          }}
          items={items}
          insumos={(insumos ?? []).map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, costo: Number(i.costo_unitario) }))}
          proveedores={proveedores ?? []}
          puedeEditar={sesion.permisos.has('compra.editar')}
        />
      </div>
    </div>
  )
}
