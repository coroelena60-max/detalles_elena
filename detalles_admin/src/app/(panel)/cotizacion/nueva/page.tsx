import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPermiso } from '@/lib/sesion'
import Calculadora from '../Calculadora'
import { cargarOpciones } from '../datos'

export const metadata: Metadata = { title: 'Nueva cotización' }
export const dynamic = 'force-dynamic'

export default async function PaginaNuevaCotizacion() {
  const sesion = await exigirPermiso('cotizacion.editar')
  const opciones = await cargarOpciones(sesion)

  return (
    <div>
      <Link href="/cotizacion" className="text-sm text-rosa-700 hover:underline">
        ← Cotizaciones
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Nueva cotización</h1>
      <Calculadora opciones={opciones} />
    </div>
  )
}
