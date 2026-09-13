import type { Metadata } from 'next'
import Link from 'next/link'
import { fotoPrincipal } from '@/lib/estados'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Envoltorio, ExtraArmado } from './ArmarRamo'
import VentaMostrador, { type Vendible } from './VentaMostrador'

export const metadata: Metadata = { title: 'Nueva venta' }
export const dynamic = 'force-dynamic'

export default async function PaginaNuevaVenta() {
  await exigirPermiso('venta.editar')
  const sb = await clienteServidor()

  // lo mismo que se puede comprar en el catálogo: publicado y no agotado
  const [{ data: productos }, { data: extras }, { data: envoltorios }] = await Promise.all([
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
        detalle: 'extra suelto',
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
      <Link href="/ventas" className="text-sm text-rosa-700 hover:underline">
        ← Ventas
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Nueva venta de mostrador</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Para lo que se vende en la tienda o se cierra por teléfono sin pasar por el catálogo.
        Podés vender productos ya armados, extras sueltos o armar un ramo personalizado.
      </p>
      <VentaMostrador vendibles={vendibles} envoltorios={listaEnvoltorios} extras={extrasArmado} />
    </div>
  )
}
