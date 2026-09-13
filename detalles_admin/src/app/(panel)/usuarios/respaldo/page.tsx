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
        descripcion="Una copia de todos los datos de la tienda en un archivo, para guardarla donde quieras."
        modulo="administracion"
        permisos={sesion.permisos}
      />

      <section className="tarjeta mt-4 max-w-2xl p-5">
        <h2 className="text-base font-semibold">Descargar respaldo</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-tinta-suave">
          <li>Incluye productos, extras, pedidos, ventas, clientes, cobros, compras, inventario, gastos, cotizaciones, usuarios, roles y bitácora.</li>
          <li>No incluye las fotos (quedan en Supabase Storage) ni contraseñas.</li>
          <li>Es un archivo <strong>.json</strong>: sirve para recuperar datos o migrarlos, no para leerlo en Excel (para eso están las descargas de Contabilidad y Reportes).</li>
          <li>Guardalo en un lugar privado: tiene teléfonos de clientes.</li>
        </ul>
        {/* descarga directa: la ruta responde con el archivo */}
        <a href="/api/respaldo" className={`${BOTON} mt-5 inline-block`}>
          Descargar respaldo de hoy
        </a>
        <p className="mt-3 text-xs text-tinta-suave">
          Supabase además guarda sus propias copias automáticas del proyecto. Este archivo es tu copia personal: conviene bajar uno por semana.
        </p>
      </section>
    </div>
  )
}
