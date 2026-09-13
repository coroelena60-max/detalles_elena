import type { Metadata } from 'next'
import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Barras, Cifra, Columnas, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { ESTADOS, ESTADO_PAGO, METODOS_PAGO, type EstadoPedido, type MetodoPago } from '@/lib/estados'
import { diaCorto, rangoDeParams } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Ventas confirmadas' }
export const dynamic = 'force-dynamic'

interface Reporte {
  resumen: {
    ventas: number
    total: number
    cobrado: number
    por_cobrar: number
    entregadas: number
    descuentos: number
  }
  cobros_por_metodo: { metodo: MetodoPago; pagos: number; total: number }[]
  por_dia: { dia: string; ventas: number; total: number }[]
  ventas: {
    codigo: string
    dia: string
    cliente: string | null
    estado: EstadoPedido
    canal: string
    total: number
    pagado: number
    saldo: number
    estado_pago: string
  }[]
}

export default async function PaginaVentasConfirmadas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const sesion = await exigirPermiso('contabilidad.ver')
  const { desde, hasta } = rangoDeParams(await searchParams)
  const sb = await clienteServidor()

  const { data, error } = await sb.rpc('reporte_ventas_confirmadas', {
    p_desde: desde,
    p_hasta: hasta,
  })
  const r = data as unknown as Reporte | null
  const verVentas = sesion.permisos.has('venta.ver')

  return (
    <div>
      <Encabezado
        titulo="Ventas confirmadas"
        descripcion="Los pedidos que ya son plata comprometida: confirmados, en producción, listos o entregados. Los nuevos sin confirmar y los cancelados no cuentan."
        modulo="contabilidad"
        permisos={sesion.permisos}
      />

      <FiltroFechas ruta="/contabilidad/ventas" desde={desde} hasta={hasta} />

      {error && <ErrorCarga que="las ventas" mensaje={error.message} />}

      {r && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              etiqueta="Vendido"
              valor={bs(r.resumen.total)}
              detalle={`${numero(r.resumen.ventas)} venta${r.resumen.ventas === 1 ? '' : 's'}`}
              tono="destacado"
            />
            <Cifra etiqueta="Cobrado" valor={bs(r.resumen.cobrado)} tono="ok" />
            <Cifra
              etiqueta="Por cobrar"
              valor={bs(r.resumen.por_cobrar)}
              tono={r.resumen.por_cobrar > 0 ? 'alerta' : 'normal'}
            />
            <Cifra
              etiqueta="Entregadas"
              valor={`${numero(r.resumen.entregadas)} de ${numero(r.resumen.ventas)}`}
              detalle={r.resumen.descuentos > 0 ? `descuentos: ${bs(r.resumen.descuentos)}` : undefined}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Vendido por día</h2>
              <Columnas
                filas={r.por_dia.map((d) => ({ etiqueta: diaCorto(d.dia), valor: Number(d.total) }))}
                formato={bs}
              />
            </section>
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Plata que entró, por medio</h2>
              <p className="mt-1 text-xs text-tinta-suave">Cobros hechos dentro del rango.</p>
              <Barras
                filas={r.cobros_por_metodo.map((c) => ({
                  etiqueta: METODOS_PAGO[c.metodo] ?? c.metodo,
                  valor: Number(c.total),
                  detalle: `(${c.pagos})`,
                }))}
                formato={bs}
                vacio="No se registraron cobros en este rango."
              />
            </section>
          </div>

          {r.ventas.length === 0 ? (
            <Vacio>No hay ventas confirmadas en este rango.</Vacio>
          ) : (
            <section className="tarjeta mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-linea bg-fondo text-left text-xs uppercase tracking-wide text-tinta-suave">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Pedido</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Cobrado</th>
                    <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {r.ventas.map((v) => {
                    const pago = ESTADO_PAGO[v.estado_pago]
                    return (
                      <tr key={v.codigo}>
                        <td className="px-3 py-2 text-tinta-suave">{diaCorto(v.dia)}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {verVentas ? (
                            <Link href={`/ventas/${v.codigo}`} className="text-rosa-700 hover:underline">
                              {v.codigo}
                            </Link>
                          ) : (
                            v.codigo
                          )}
                          {v.canal === 'mostrador' && (
                            <span className="ml-1 text-tinta-suave">· mostrador</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{v.cliente ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Etiqueta clase={ESTADOS[v.estado]?.clase}>
                            {ESTADOS[v.estado]?.etiqueta ?? v.estado}
                          </Etiqueta>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{bs(v.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{bs(v.pagado)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(v.saldo) > 0 ? (
                            <Etiqueta clase={pago?.clase}>{bs(v.saldo)}</Etiqueta>
                          ) : (
                            <span className="text-ok">Pagado</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t border-linea bg-fondo font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={4}>
                      Total del rango
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{bs(r.resumen.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {bs(r.ventas.reduce((s, v) => s + Number(v.pagado), 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{bs(r.resumen.por_cobrar)}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  )
}
