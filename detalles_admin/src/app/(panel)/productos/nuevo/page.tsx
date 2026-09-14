import type { Metadata } from 'next'
import Link from 'next/link'
import Icono from '@/components/Icono'
import { exigirPermiso } from '@/lib/sesion'
import { obtenerOpciones } from '../opciones'
import AsistenteProducto from './AsistenteProducto'

export const metadata: Metadata = { title: 'Nuevo producto' }
export const dynamic = 'force-dynamic'

export default async function PaginaNuevoProducto() {
  await exigirPermiso('maestro.editar')
  const opciones = await obtenerOpciones()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/productos" className="inline-flex items-center gap-1 text-sm text-rosa-700 hover:underline">
        <Icono nombre="atras" className="size-4" />
        Productos
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Nuevo producto</h1>
      <AsistenteProducto opciones={opciones} />
    </div>
  )
}
