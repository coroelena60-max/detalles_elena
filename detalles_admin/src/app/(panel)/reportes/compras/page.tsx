import type { Metadata } from 'next'
import Link from 'next/link'
import BotonExcel from '@/components/BotonExcel'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Barras, Cifra, Columnas, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { ESTADOS_COMPRA, type EstadoCompra } from '@/lib/estados'
import { diaCorto, mesCorto, rangoDeParams } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Reporte de compras' }
export const dynamic = 'force-dynamic'

interface Reporte {
  resumen: {
    recibidas: number
    borradores: number
    anuladas: number
    total: number
    pendiente: number
    promedio: number
  }
  por_proveedor: { proveedor: string; compras: number; total: number }[]
  por_insumo: {
    nombre: string
    unidad: string
    cantidad: number
    total: number
    costo_promedio: number
  }[]
  por_mes: { mes: string; compras: number; total: number }[]
  compras: {
    codigo: string
    fecha: string
    estado: EstadoCompra
    total: number
    documento: string | null
    proveedor: string | null
  }[]
}

export default async function PaginaReporteCompras({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const sesion = await exigirPermiso('reporte.ver')
  const { desde, hasta } = rangoDeParams(await searchParams)
  const sb = await clienteServidor()

  const { data, error } = await sb.rpc('reporte_compras', { p_desde: desde, p_hasta: hasta })
  const r = data as unknown as Reporte | null
  const verCompras = sesion.permisos.has('compra.ver')

  return (
    <div>
      <Encabezado
        titulo="Reporte de compras"
        descripcion="Cuánto se gastó en materiales. Solo compras recibidas."
        modulo="reporte"
        permisos={sesion.permisos}
      >
        <BotonExcel tipo="compras" desde={desde} hasta={hasta} />
      </Encabezado>

      <FiltroFechas ruta="/reportes/compras" desde={desde} hasta={hasta} />

      {error && <ErrorCarga que="el reporte" mensaje={error.message} />}

      {r && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              etiqueta="Comprado"
              valor={bs(r.resumen.total)}
              detalle={`${numero(r.resumen.recibidas)} compra${r.resumen.recibidas === 1 ? '' : 's'} recibida${r.resumen.recibidas === 1 ? '' : 's'}`}
              tono="destacado"
            />
            <Cifra etiqueta="Compra promedio" valor={bs(r.resumen.promedio)} />
            <Cifra
              etiqueta="Por recibir"
              valor={bs(r.resumen.pendiente)}
              detalle={`${numero(r.resumen.borradores)} en borrador`}
              tono={r.resumen.borradores > 0 ? 'alerta' : 'normal'}
            />
            <Cifra etiqueta="Anuladas" valor={numero(r.resumen.anuladas)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Por proveedor</h2>
              <Barras
                filas={r.por_proveedor.map((p) => ({
                  etiqueta: p.proveedor,
                  valor: Number(p.total),
                  detalle: `(${p.compras})`,
                }))}
                formato={bs}
                vacio="No hay compras recibidas en este rango."
              />
            </section>
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">
                {r.por_mes.length > 1 ? 'Mes a mes' : 'Materiales en los que más se gastó'}
              </h2>
              {r.por_mes.length > 1 ? (
                <Columnas
                  filas={r.por_mes.map((m) => ({ etiqueta: mesCorto(m.mes), valor: Number(m.total) }))}
                  formato={bs}
                />
              ) : (
                <Barras
                  filas={r.por_insumo.slice(0, 8).map((i) => ({ etiqueta: i.nombre, valor: Number(i.total) }))}
                  formato={bs}
                  vacio="No hay compras recibidas en este rango."
                />
              )}
            </section>
          </div>

          {r.por_insumo.length > 0 && (
            <section className="tarjeta mt-4 overflow-x-auto">
              <h2 className="px-4 pt-4 text-sm font-semibold">Qué se compró</h2>
              <table className="mt-2 w-full min-w-[560px] text-sm">
                <thead className="border-y border-linea bg-fondo text-left text-xs uppercase tracking-wide text-tinta-suave">
                  <tr>
                    <th className="px-4 py-2 font-medium">Material</th>
                    <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-4 py-2 text-right font-medium">Costo promedio</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {r.por_insumo.map((i) => (
                    <tr key={i.nombre}>
                      <td className="px-4 py-2">{i.nombre}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {numero(i.cantidad)} {i.unidad}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{bs(i.costo_promedio)}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{bs(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {r.compras.length === 0 ? (
            <Vacio>No hay compras en este rango.</Vacio>
          ) : (
            <section className="tarjeta mt-4">
              <h2 className="px-4 pt-4 text-sm font-semibold">Compras del rango</h2>
              <ul className="mt-2 divide-y divide-linea">
                {r.compras.map((c) => {
                  const est = ESTADOS_COMPRA[c.estado]
                  return (
                    <li key={c.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                      <span className="w-14 text-xs text-tinta-suave">{diaCorto(c.fecha)}</span>
                      <span className="font-mono text-xs">
                        {verCompras ? (
                          <Link href={`/compras/${c.codigo}`} className="text-rosa-700 hover:underline">
                            {c.codigo}
                          </Link>
                        ) : (
                          c.codigo
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {c.proveedor ?? 'Sin proveedor'}
                        {c.documento && (
                          <span className="ml-2 text-xs text-tinta-suave">Doc. {c.documento}</span>
                        )}
                      </span>
                      <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>
                      <span className="w-24 text-right font-medium tabular-nums">{bs(c.total)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
