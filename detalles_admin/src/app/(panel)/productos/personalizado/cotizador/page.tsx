import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import Cotizador from './Cotizador'

export const metadata: Metadata = { title: 'Cotizador' }
export const dynamic = 'force-dynamic'

export default async function PaginaCotizador() {
  await exigirPermiso('maestro.ver')
  const sb = await clienteServidor()

  const [{ data: envs }, { data: extras }] = await Promise.all([
    sb
      .from('envoltorio')
      .select('id, precio_base, espacios, estilo:estilo_id (nombre, orden), tamano:tamano_id (codigo, orden)')
      .eq('activo', true),
    sb
      .from('extra')
      .select('id, nombre, precio, espacios, orden, categoria:extra_categoria_id (nombre, orden)')
      .neq('estado', 'inactivo')
      .order('orden'),
  ])

  const envoltorios = (envs ?? [])
    .map((e) => {
      const es = e.estilo as { nombre: string; orden: number } | null
      const tm = e.tamano as { codigo: string; orden: number } | null
      return {
        id: e.id,
        nombre: `${es?.nombre ?? ''} ${tm?.codigo ?? ''}`.trim(),
        precio: Number(e.precio_base),
        espacios: e.espacios == null ? null : Number(e.espacios),
        o1: es?.orden ?? 0,
        o2: tm?.orden ?? 0,
      }
    })
    .sort((a, b) => a.o1 - b.o1 || a.o2 - b.o2)

  const listaExtras = (extras ?? [])
    .map((x) => {
      const cat = x.categoria as { nombre: string; orden: number } | null
      return {
        id: x.id,
        nombre: x.nombre,
        precio: Number(x.precio),
        espacios: Number(x.espacios),
        grupo: cat?.nombre ?? 'Otros',
        orden: (cat?.orden ?? 99) * 1000 + x.orden,
      }
    })
    .sort((a, b) => a.orden - b.orden)

  return (
    <div>
      <Link href="/productos/personalizado" className="text-sm text-rosa-700 hover:underline">
        ← Producto personalizado
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Cotizador</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Armá el ramo y mirá cuánto cobrar.
      </p>
      <Cotizador envoltorios={envoltorios} extras={listaExtras} />
    </div>
  )
}
