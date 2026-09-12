import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPermiso } from '@/lib/sesion'
import FormularioProducto from '../FormularioProducto'
import { obtenerOpciones } from '../opciones'

export const metadata: Metadata = { title: 'Nuevo producto' }
export const dynamic = 'force-dynamic'

export default async function PaginaNuevoProducto() {
  await exigirPermiso('maestro.editar')
  const opciones = await obtenerOpciones()

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/productos" className="text-sm text-rosa-700 hover:underline">
        ← Productos
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Nuevo producto</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Guardalo primero y después cargale las fotos y las flores que lleva.
      </p>

      <div className="mt-5">
        <FormularioProducto inicial={{}} opciones={opciones} puedeEditar />
      </div>
    </div>
  )
}
