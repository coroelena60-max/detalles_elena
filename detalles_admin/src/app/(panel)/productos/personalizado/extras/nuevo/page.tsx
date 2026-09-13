import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FormularioExtra from '../FormularioExtra'

export const metadata: Metadata = { title: 'Nuevo extra' }
export const dynamic = 'force-dynamic'

export default async function PaginaNuevoExtra() {
  await exigirPermiso('maestro.editar')
  const sb = await clienteServidor()
  const { data: categorias } = await sb.from('extra_categoria').select('id, nombre').order('orden')

  return (
    <div>
      <Link href="/productos/personalizado" className="text-sm text-rosa-700 hover:underline">
        ← Producto personalizado
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Nuevo extra</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Arranca como borrador: no sale en el catálogo hasta que le pongas foto y lo actives. Después de
        crearlo le cargás la receta.
      </p>
      <div className="mt-5">
        <FormularioExtra categorias={categorias ?? []} puedeEditar />
      </div>
    </div>
  )
}
