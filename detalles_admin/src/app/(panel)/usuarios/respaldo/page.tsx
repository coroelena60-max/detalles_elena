import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import { BOTON } from '@/components/ui'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Respaldo' }

export default async function PaginaRespaldo() {
  const sesion = await exigirPermiso('respaldo.descargar')

  return (
    <div>
      <Encabezado
        titulo="Respaldo"
        descripcion="Una copia de los datos de la tienda en un archivo."
        modulo="administracion"
        permisos={sesion.permisos}
      />

      <section className="tarjeta mt-4 max-w-2xl p-5">
        <h2 className="text-base font-semibold">Descargar respaldo</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-tinta-suave">
          <li>Todos los datos de la tienda, sin las fotos.</li>
          <li>Guardalo en un lugar privado: tiene teléfonos de clientes.</li>
        </ul>
        {/* descarga directa: la ruta responde con el archivo */}
        <a href="/api/respaldo" className={`${BOTON} mt-5 inline-block`}>
          Descargar respaldo de hoy
        </a>
        <p className="mt-3 text-sm text-tinta-suave">
          Conviene bajar uno por semana.
        </p>
      </section>
    </div>
  )
}
