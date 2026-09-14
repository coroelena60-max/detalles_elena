import type { Metadata } from 'next'
import Link from 'next/link'
import Icono from '@/components/Icono'
import { fotoPrincipal } from '@/lib/estados'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Envoltorio, ExtraArmado } from './ArmarRamo'
import VentaMostrador, { type Vendible } from './VentaMostrador'

export const metadata: Metadata = { title: 'Vender' }
export const dynamic = 'force-dynamic'

export default async function PaginaNuevaVenta({
  searchParams,
}: {
  searchParams: Promise<{ cotizacion?: string }>
}) {
  const sesion = await exigirPermiso('venta.editar')
  const { cotizacion } = await searchParams
  const verCotizaciones = sesion.permisos.has('cotizacion.ver')
  const sb = await clienteServidor()

  // lo mismo que se puede comprar en el catálogo: publicado y no agotado
  const [{ data: productos }, { data: extras }, { data: envoltorios }, { data: cotizaciones }] = await Promise.all([
    sb
      .from('producto')
      .select('id, codigo, nombre, precio, imagenes:producto_imagen (url, es_principal, orden)')
      .in('estado', ['activo', 'temporada'])
      .order('nombre'),
    sb
      .from('extra')
      .select('id, nombre, precio, espacios, imagen_url, orden')
      .in('estado', ['activo', 'temporada'])
      .order('orden'),
    sb
      .from('envoltorio')
      .select('id, precio_base, espacios, estilo:estilo_id (nombre, orden), tamano:tamano_id (codigo, orden)')
      .eq('activo', true),
    verCotizaciones
      ? sb.from('v_cotizacion').select('id, codigo, nombre, precio').order('updated_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as { id: number | null; codigo: string | null; nombre: string | null; precio: number | null }[] }),
  ])

  const vendibles: Vendible[] = [
    ...(productos ?? []).map((p) => ({
      clave: `p${p.id}`,
      tipo: 'producto' as const,
      id: p.id,
      nombre: p.nombre,
      precio: Number(p.precio),
      detalle: p.codigo,
      imagen: fotoPrincipal(p.imagenes),
    })),
    ...(extras ?? [])
      .map((e) => ({
        clave: `e${e.id}`,
        tipo: 'extra' as const,
        id: e.id,
        nombre: e.nombre,
        precio: Number(e.precio),
        detalle: 'extra',
        imagen: e.imagen_url,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  ]

  const listaEnvoltorios: Envoltorio[] = (envoltorios ?? [])
    .map((v) => {
      const estilo = v.estilo as { nombre: string; orden: number } | null
      const tamano = v.tamano as { codigo: string; orden: number } | null
      return {
        id: v.id,
        estilo: estilo?.nombre ?? 'Envoltorio',
        tamano: tamano?.codigo ?? '',
        precio: Number(v.precio_base),
        capacidad: v.espacios === null ? null : Number(v.espacios),
        orden: (estilo?.orden ?? 0) * 100 + (tamano?.orden ?? 0),
      }
    })
    .sort((a, b) => a.orden - b.orden)

  const extrasArmado: ExtraArmado[] = (extras ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    precio: Number(e.precio),
    espacios: Number(e.espacios),
    imagen: e.imagen_url,
  }))

  return (
    <div>
      <Link href="/ventas" className="inline-flex items-center gap-1 text-sm text-rosa-700 hover:underline">
        <Icono nombre="atras" className="size-4" />
        Ventas
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Vender</h1>
      <VentaMostrador
        vendibles={vendibles}
        envoltorios={listaEnvoltorios}
        extras={extrasArmado}
        cotizaciones={(cotizaciones ?? []).map((c) => ({
          id: c.id as number,
          codigo: c.codigo ?? '',
          nombre: c.nombre ?? '',
          precio: Number(c.precio),
        }))}
        cotizacionInicial={cotizacion ? Number(cotizacion) : null}
        puedeCobrar={sesion.permisos.has('pago.registrar')}
      />
    </div>
  )
}
