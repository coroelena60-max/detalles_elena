import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AnularConMotivo from '@/components/AnularConMotivo'
import BotonExcel from '@/components/BotonExcel'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Barras, Cifra, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { METODOS_PAGO } from '@/lib/estados'
import { diaCorto, rangoDeParams } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { anularGasto } from './acciones'
import NuevoGasto from './NuevoGasto'
import TiposGasto from './TiposGasto'

export const metadata: Metadata = { title: 'Gastos' }
export const dynamic = 'force-dynamic'

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; tipo?: string; ver?: string }>
}) {
  const sesion = await exigirSesion()
  const puedeVer = sesion.permisos.has('contabilidad.ver')
  const puedeRegistrar = sesion.permisos.has('gasto.registrar')
  if (!puedeVer && !puedeRegistrar) redirect('/sin-permiso?permiso=contabilidad.ver')

  const params = await searchParams
  const { desde, hasta } = rangoDeParams(params)
  const tipo = Number(params.tipo) || 0
  const verAnulados = params.ver === 'anulados'
  const sb = await clienteServidor()

  let consulta = sb
    .from('gasto')
    .select(
      'id, codigo, fecha, descripcion, monto, metodo, comprobante, nota, estado, motivo_anulacion, categoria:categoria_gasto_id (id, nombre), registrado:registrado_por (nombre)',
    )
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .eq('estado', verAnulados ? 'anulado' : 'registrado')
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
  if (tipo) consulta = consulta.eq('categoria_gasto_id', tipo)

  const [{ data: gastos, error }, { data: tipos }] = await Promise.all([
    consulta,
    sb.from('categoria_gasto').select('id, nombre, descripcion, activa').order('orden'),
  ])

  const lista = (gastos ?? []).map((g) => ({
    ...g,
    categoria: g.categoria as { id: number; nombre: string } | null,
    registrado: g.registrado as { nombre: string } | null,
  }))
  const total = lista.reduce((s, g) => s + Number(g.monto), 0)

  const porTipo = new Map<string, number>()
  for (const g of lista) {
    const k = g.categoria?.nombre ?? 'Sin tipo'
    porTipo.set(k, (porTipo.get(k) ?? 0) + Number(g.monto))
  }
  const ranking = [...porTipo.entries()].sort((a, b) => b[1] - a[1])

  const dias = new Set(lista.map((g) => g.fecha)).size

  return (
    <div>
      <Encabezado
        titulo="Gastos"
        descripcion="Lo que sale y no vuelve como mercadería: alquiler, luz, delivery, publicidad. Las compras de insumos van en Compras."
        modulo="contabilidad"
        permisos={sesion.permisos}
      >
        {sesion.permisos.has('contabilidad.ver') && <BotonExcel tipo="gastos" desde={desde} hasta={hasta} />}
      </Encabezado>

      {puedeRegistrar && (
        <div className="mt-4">
          <NuevoGasto categorias={(tipos ?? []).filter((t) => t.activa)} />
        </div>
      )}

      <FiltroFechas
        ruta="/contabilidad"
        desde={desde}
        hasta={hasta}
        extras={{ tipo: tipo ? String(tipo) : undefined, ver: params.ver }}
      >
        <div>
          <label htmlFor="tipo" className="block text-xs font-medium text-tinta-suave">
            Tipo
          </label>
          <select id="tipo" name="tipo" defaultValue={tipo || ''} className="campo mt-1 w-52 focus:campo-foco">
            <option value="">Todos</option>
            {(tipos ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ver" className="block text-xs font-medium text-tinta-suave">
            Mostrar
          </label>
          <select id="ver" name="ver" defaultValue={params.ver ?? ''} className="campo mt-1 w-40 focus:campo-foco">
            <option value="">Vigentes</option>
            <option value="anulados">Anulados</option>
          </select>
        </div>
      </FiltroFechas>

      {error && <ErrorCarga que="los gastos" mensaje={error.message} />}

      {!verAnulados && (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cifra etiqueta="Total gastado" valor={bs(total)} tono="destacado" />
          <Cifra etiqueta="Gastos" valor={numero(lista.length)} detalle={`en ${dias} día${dias === 1 ? '' : 's'}`} />
          <Cifra
            etiqueta="Donde más se fue"
            valor={ranking[0]?.[0] ?? '—'}
            detalle={ranking[0] ? bs(ranking[0][1]) : undefined}
          />
          <Cifra
            etiqueta="Promedio por gasto"
            valor={bs(lista.length ? total / lista.length : 0)}
          />
        </div>
      )}

      <div className={`mt-4 grid gap-4 ${!verAnulados && ranking.length > 0 ? 'lg:grid-cols-[1fr_20rem]' : ''}`}>
        <div>
          {lista.length === 0 ? (
            !error && (
              <Vacio>
                {verAnulados
                  ? 'No hay gastos anulados en este rango.'
                  : 'No hay gastos registrados en este rango.'}
              </Vacio>
            )
          ) : (
            <ul className="tarjeta divide-y divide-linea">
              {lista.map((g) => (
                <li key={g.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-3">
                  <div className="w-14 shrink-0 text-xs text-tinta-suave">
                    {diaCorto(g.fecha)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{g.descripcion}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-tinta-suave">
                      <Etiqueta>{g.categoria?.nombre ?? 'Sin tipo'}</Etiqueta>
                      <span className="font-mono">{g.codigo}</span>
                      <span>{METODOS_PAGO[g.metodo]}</span>
                      {g.comprobante && <span>Comp. {g.comprobante}</span>}
                      {g.registrado?.nombre && <span>por {g.registrado.nombre}</span>}
                    </p>
                    {g.nota && <p className="mt-0.5 text-xs text-tinta-suave">{g.nota}</p>}
                    {g.motivo_anulacion && (
                      <p className="mt-1 text-xs text-alerta">Anulado: {g.motivo_anulacion}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`text-sm font-semibold tabular-nums ${verAnulados ? 'text-tinta-suave line-through' : ''}`}
                    >
                      {bs(g.monto)}
                    </span>
                    {puedeRegistrar && !verAnulados && (
                      <AnularConMotivo accion={anularGasto.bind(null, g.id)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!verAnulados && ranking.length > 0 && (
          <section className="tarjeta h-fit p-4">
            <h2 className="text-sm font-semibold">Por tipo</h2>
            <Barras
              filas={ranking.map(([etiqueta, valor]) => ({
                etiqueta,
                valor,
                detalle: total ? `${numero((valor / total) * 100)}%` : undefined,
              }))}
              formato={bs}
            />
          </section>
        )}
      </div>

      <TiposGasto tipos={tipos ?? []} puedeEditar={puedeRegistrar} />
    </div>
  )
}
