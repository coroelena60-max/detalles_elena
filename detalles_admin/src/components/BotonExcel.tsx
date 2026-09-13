import { BOTON_SECUNDARIO } from './ui'

/** Descarga el reporte del rango elegido como archivo para Excel (CSV). */
export default function BotonExcel({
  tipo,
  desde,
  hasta,
}: {
  tipo: 'gastos' | 'ventas-confirmadas' | 'ganancias' | 'ventas' | 'compras'
  desde: string
  hasta: string
}) {
  return (
    <a
      href={`/api/exportar/${tipo}?desde=${desde}&hasta=${hasta}`}
      className={BOTON_SECUNDARIO}
      title="Descarga un archivo que se abre en Excel"
    >
      ⬇ Descargar Excel
    </a>
  )
}
