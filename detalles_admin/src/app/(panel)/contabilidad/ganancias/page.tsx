import type { Metadata } from 'next'
import BotonExcel from '@/components/BotonExcel'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Barras, Cifra, Columnas, ErrorCarga } from '@/components/ui'
import { describirRango, mesCorto, rangoDeParams } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Ganancias' }
export const dynamic = 'force-dynamic'

interface Reporte {
  ventas: number
  compras: number
  utilidad_bruta: number
  gastos: number
  ganancia: number
  margen_pct: number | null
  gastos_por_categoria: { categoria: string; gastos: number; total: number }[]
  por_mes: { mes: string; ventas: number; compras: number; gastos: number; ganancia: number }[]
}

function Linea({
  etiqueta,
  valor,
  signo,
  fuerte = false,
  ayuda,
}: {
  etiqueta: string
  valor: number
  signo?: '+' | '−' | '='
  fuerte?: boolean
  ayuda?: string
}) {
  const negativo = valor < 0
  return (
    <div
      className={`flex items-baseline gap-3 py-2.5 ${fuerte ? 'border-t-2 border-tinta/20 text-base font-semibold' : 'text-sm'}`}
    >
      <span className="w-4 text-center text-tinta-suave">{signo}</span>
      <span className="min-w-0 flex-1">
        {etiqueta}
        {ayuda && <span className="block text-xs font-normal text-tinta-suave">{ayuda}</span>}
      </span>
      <span className={`tabular-nums ${fuerte && negativo ? 'text-alerta' : fuerte ? 'text-ok' : ''}`}>
        {bs(valor)}
      </span>
    </div>
  )
}

export default async function PaginaGanancias({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const sesion = await exigirPermiso('contabilidad.ver')
  const { desde, hasta } = rangoDeParams(await searchParams)
  const sb = await clienteServidor()

  const { data, error } = await sb.rpc('reporte_ganancias', { p_desde: desde, p_hasta: hasta })
  const r = data as unknown as Reporte | null
  const ganancia = Number(r?.ganancia ?? 0)

  return (
    <div>
      <Encabezado
        titulo="Ganancias"
        descripcion="Cuánto dejó la tienda: lo vendido, menos lo que se compró para producir, menos los gastos."
        modulo="contabilidad"
        permisos={sesion.permisos}
      >
        <BotonExcel tipo="ganancias" desde={desde} hasta={hasta} />
      </Encabezado>

      <FiltroFechas ruta="/contabilidad/ganancias" desde={desde} hasta={hasta} />

      {error && <ErrorCarga que="las ganancias" mensaje={error.message} />}

      {r && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              etiqueta={ganancia < 0 ? 'Pérdida' : 'Ganancia'}
              valor={bs(ganancia)}
              tono={ganancia < 0 ? 'alerta' : 'ok'}
              detalle={r.margen_pct != null ? `${numero(r.margen_pct)}% de lo vendido` : undefined}
            />
            <Cifra etiqueta="Vendido" valor={bs(r.ventas)} />
            <Cifra etiqueta="Compras" valor={bs(r.compras)} />
            <Cifra etiqueta="Gastos" valor={bs(r.gastos)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
            <section className="tarjeta p-5">
              <h2 className="text-sm font-semibold">
                Estado de resultados · {describirRango(desde, hasta)}
              </h2>
              <div className="mt-3">
                <Linea
                  signo="+"
                  etiqueta="Ventas confirmadas"
                  ayuda="Pedidos confirmados, en producción, listos o entregados."
                  valor={Number(r.ventas)}
                />
                <Linea
                  signo="−"
                  etiqueta="Compras de insumos"
                  ayuda="Compras recibidas: papel, cinta, peluches, cajas…"
                  valor={Number(r.compras)}
                />
                <Linea signo="=" etiqueta="Utilidad bruta" valor={Number(r.utilidad_bruta)} />
                <Linea
                  signo="−"
                  etiqueta="Gastos"
                  ayuda="Alquiler, servicios, delivery, publicidad…"
                  valor={Number(r.gastos)}
                />
                <Linea
                  signo="="
                  etiqueta={ganancia < 0 ? 'Pérdida neta' : 'Ganancia neta'}
                  valor={ganancia}
                  fuerte
                />
              </div>
              <p className="mt-4 rounded-lg bg-fondo px-3 py-2 text-xs text-tinta-suave">
                Es una cuenta de caja simple: resta las compras del período completas, aunque
                parte de ese material todavía esté guardado sin usar. Un mes con una compra
                grande puede verse flojo y el siguiente, mejor de lo que fue.
              </p>
            </section>

            <section className="tarjeta h-fit p-4">
              <h2 className="text-sm font-semibold">En qué se fueron los gastos</h2>
              <Barras
                filas={r.gastos_por_categoria.map((g) => ({
                  etiqueta: g.categoria,
                  valor: Number(g.total),
                  detalle: `(${g.gastos})`,
                }))}
                formato={bs}
                vacio="No hay gastos en este rango."
              />
            </section>
          </div>

          {r.por_mes.length > 1 && (
            <section className="tarjeta mt-4 p-4">
              <h2 className="text-sm font-semibold">Mes a mes</h2>
              <Columnas
                filas={r.por_mes.map((m) => ({ etiqueta: mesCorto(m.mes), valor: Number(m.ganancia) }))}
                formato={bs}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="border-b border-linea text-left text-xs uppercase tracking-wide text-tinta-suave">
                    <tr>
                      <th className="py-2 font-medium">Mes</th>
                      <th className="py-2 text-right font-medium">Ventas</th>
                      <th className="py-2 text-right font-medium">Compras</th>
                      <th className="py-2 text-right font-medium">Gastos</th>
                      <th className="py-2 text-right font-medium">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {r.por_mes.map((m) => (
                      <tr key={m.mes}>
                        <td className="py-2">{mesCorto(m.mes)}</td>
                        <td className="py-2 text-right tabular-nums">{bs(m.ventas)}</td>
                        <td className="py-2 text-right tabular-nums">{bs(m.compras)}</td>
                        <td className="py-2 text-right tabular-nums">{bs(m.gastos)}</td>
                        <td
                          className={`py-2 text-right font-medium tabular-nums ${Number(m.ganancia) < 0 ? 'text-alerta' : ''}`}
                        >
                          {bs(m.ganancia)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
