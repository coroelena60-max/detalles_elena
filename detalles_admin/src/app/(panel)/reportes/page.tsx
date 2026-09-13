import type { Metadata } from 'next'
import BotonExcel from '@/components/BotonExcel'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Barras, Cifra, Columnas, ErrorCarga } from '@/components/ui'
import { ESTADOS, type EstadoPedido } from '@/lib/estados'
import { diaCorto, rangoDeParams } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Reporte de ventas' }
export const dynamic = 'force-dynamic'

interface Reporte {
  resumen: {
    pedidos: number
    confirmados: number
    sin_confirmar: number
    cancelados: number
    vendido: number
    descuentos: number
    ticket_promedio: number
    conversion_pct: number
  }
  por_dia: { dia: string; pedidos: number; total: number }[]
  por_canal: { canal: string; pedidos: number; total: number }[]
  por_estado: { estado: EstadoPedido; pedidos: number; total: number }[]
  productos: { nombre: string; unidades: number; vendido: number }[]
  personalizados: { unidades: number; vendido: number }
  extras: { nombre: string; unidades: number; vendido: number }[]
}

const CANALES: Record<string, string> = {
  catalogo_web: 'Catálogo web',
  mostrador: 'Mostrador',
}

export default async function PaginaReporteVentas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const sesion = await exigirPermiso('reporte.ver')
  const { desde, hasta } = rangoDeParams(await searchParams)
  const sb = await clienteServidor()

  const { data, error } = await sb.rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta })
  const r = data as unknown as Reporte | null

  return (
    <div>
      <Encabezado
        titulo="Reporte de ventas"
        descripcion="Qué se vende, cuándo y por dónde entra. Cuenta como vendido solo lo confirmado; lo que quedó sin confirmar aparece aparte."
        modulo="reporte"
        permisos={sesion.permisos}
      >
        <BotonExcel tipo="ventas" desde={desde} hasta={hasta} />
      </Encabezado>

      <FiltroFechas ruta="/reportes" desde={desde} hasta={hasta} />

      {error && <ErrorCarga que="el reporte" mensaje={error.message} />}

      {r && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              etiqueta="Vendido"
              valor={bs(r.resumen.vendido)}
              detalle={`${numero(r.resumen.confirmados)} pedido${r.resumen.confirmados === 1 ? '' : 's'} confirmado${r.resumen.confirmados === 1 ? '' : 's'}`}
              tono="destacado"
            />
            <Cifra etiqueta="Ticket promedio" valor={bs(r.resumen.ticket_promedio)} />
            <Cifra
              etiqueta="Se concretaron"
              valor={`${numero(r.resumen.conversion_pct)}%`}
              detalle={`${numero(r.resumen.confirmados)} de ${numero(r.resumen.pedidos)} pedidos armados`}
            />
            <Cifra
              etiqueta="Sin confirmar"
              valor={numero(r.resumen.sin_confirmar)}
              detalle={`${numero(r.resumen.cancelados)} cancelado${r.resumen.cancelados === 1 ? '' : 's'}`}
              tono={r.resumen.sin_confirmar > 0 ? 'alerta' : 'normal'}
            />
          </div>

          <section className="tarjeta mt-4 p-4">
            <h2 className="text-sm font-semibold">Vendido por día</h2>
            <Columnas
              filas={r.por_dia.map((d) => ({ etiqueta: diaCorto(d.dia), valor: Number(d.total) }))}
              formato={bs}
            />
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Productos más vendidos</h2>
              <Barras
                filas={r.productos.map((p) => ({
                  etiqueta: p.nombre,
                  valor: Number(p.vendido),
                  detalle: `· ${numero(p.unidades)} u.`,
                }))}
                formato={bs}
                vacio="No se vendieron productos del catálogo en este rango."
              />
              {Number(r.personalizados.unidades) > 0 && (
                <p className="mt-3 border-t border-linea pt-2 text-sm">
                  Ramos personalizados: <strong>{numero(r.personalizados.unidades)}</strong> por{' '}
                  <strong>{bs(r.personalizados.vendido)}</strong>
                </p>
              )}
            </section>

            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Extras que más salen</h2>
              <p className="mt-1 text-xs text-tinta-suave">Sueltos y dentro de los ramos.</p>
              <Barras
                filas={r.extras.map((e) => ({
                  etiqueta: e.nombre,
                  valor: Number(e.unidades),
                  detalle: `· ${bs(e.vendido)}`,
                }))}
                formato={(n) => `${numero(n)} u.`}
                vacio="No salieron extras en este rango."
              />
            </section>

            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Por canal</h2>
              <Barras
                filas={r.por_canal.map((c) => ({
                  etiqueta: CANALES[c.canal] ?? c.canal,
                  valor: Number(c.total),
                  detalle: `(${c.pedidos})`,
                }))}
                formato={bs}
              />
            </section>

            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Todos los pedidos, por estado</h2>
              <Barras
                filas={[...r.por_estado]
                  .sort((a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9))
                  .map((e) => ({
                    etiqueta: ESTADOS[e.estado]?.etiqueta ?? e.estado,
                    valor: Number(e.pedidos),
                    detalle: `· ${bs(e.total)}`,
                  }))}
                formato={(n) => `${numero(n)}`}
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}
