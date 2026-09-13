import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import Calculadora from '../Calculadora'
import { cargarOpciones } from '../datos'

export const metadata: Metadata = { title: 'Cotización' }
export const dynamic = 'force-dynamic'

export default async function PaginaCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso('cotizacion.ver')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const sb = await clienteServidor()

  const [{ data: c }, { data: mats }, { data: exts }, opciones] = await Promise.all([
    sb.from('cotizacion').select('*').eq('id', id).maybeSingle(),
    sb.from('cotizacion_material').select('*').eq('cotizacion_id', id).order('orden'),
    sb.from('cotizacion_extra').select('*').eq('cotizacion_id', id).order('orden'),
    cargarOpciones(sesion),
  ])
  if (!c) notFound()

  return (
    <div>
      <Link href="/cotizacion" className="text-sm text-rosa-700 hover:underline">
        ← Cotizaciones
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{c.nombre}</h1>
      <Calculadora
        key={c.updated_at}
        opciones={opciones}
        inicial={{
          id: c.id,
          codigo: c.codigo ?? '',
          productoId: c.producto_id,
          datos: {
            id: c.id,
            nombre: c.nombre,
            descripcion: c.descripcion ?? '',
            minutos: c.minutos,
            costoHora: Number(c.costo_hora),
            otrosPct: Number(c.otros_pct),
            otrosMonto: Number(c.otros_monto),
            margenPct: Number(c.margen_pct),
            precioFinal: c.precio_final === null ? null : Number(c.precio_final),
            materiales: (mats ?? []).map((m) => ({
              insumoId: m.insumo_id,
              nombre: m.nombre,
              unidad: m.unidad,
              cantidadCompra: Number(m.cantidad_compra),
              factor: Number(m.factor),
              precioCompra: Number(m.precio_compra),
              cantidadUsada: Number(m.cantidad_usada),
              crearInsumo: false,
            })),
            extras: (exts ?? [])
              .filter((e) => e.extra_id !== null)
              .map((e) => ({
                extraId: e.extra_id as number,
                cantidad: Number(e.cantidad),
                costoUnitario: Number(e.costo_unitario),
              })),
          },
        }}
      />
    </div>
  )
}
