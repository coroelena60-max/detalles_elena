import type { Metadata } from 'next'
import AvisoError from '@/components/AvisoError'
import {
  obtenerCategoriasExtra,
  obtenerEnvoltorios,
  obtenerExtras,
} from '@/lib/consultas'
import ArmadoPersonalizado from './ArmadoPersonalizado'

export const metadata: Metadata = { title: 'Armá tu ramo' }
export const revalidate = 300

export default async function PaginaPersonalizado() {
  let envoltorios, extras, categorias
  try {
    ;[envoltorios, extras, categorias] = await Promise.all([
      obtenerEnvoltorios(),
      obtenerExtras(),
      obtenerCategoriasExtra(),
    ])
  } catch (e) {
    return (
      <div className="contenedor py-10">
        <AvisoError
          titulo="No pudimos cargar el armador"
          detalle={e instanceof Error ? e.message : undefined}
        />
      </div>
    )
  }

  // crear_pedido() solo acepta extras 'activo' o 'temporada': no ofrecer otros
  const disponibles = extras.filter(
    (x) => x.estado === 'activo' || x.estado === 'temporada',
  )

  if (envoltorios.length === 0 || disponibles.length === 0) {
    return (
      <div className="contenedor py-10">
        <AvisoError
          titulo="El armador todavía no está disponible"
          detalle="Faltan envoltorios o flores publicadas en el catálogo."
        />
      </div>
    )
  }

  return (
    <ArmadoPersonalizado
      envoltorios={envoltorios}
      extras={disponibles}
      categorias={categorias}
    />
  )
}
