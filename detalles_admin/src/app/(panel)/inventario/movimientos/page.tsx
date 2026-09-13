import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Cifra, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { TIPOS_MOVIMIENTO, type TipoMovimiento } from '@/lib/estados'
import { diaCorto, rangoDeParams } from '@/lib/fechas'
import { numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Movimientos de stock' }
export const dynamic = 'force-dynamic'

const ITEMS = { producto: 'Productos', extra: 'Extras', insumo: 'Insumos' } as const

export default async function PaginaMovimientos({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; item?: string; tipo?: string }>
}) {
  const sesion = await exigirPermiso('inventario.ver')
  const params = await searchParams
  const { desde, hasta } = rangoDeParams(params)
  const item = params.item && params.item in ITEMS ? (params.item as keyof typeof ITEMS) : undefined
  const tipo =
    params.tipo && params.tipo in TIPOS_MOVIMIENTO ? (params.tipo as TipoMovimiento) : undefined
  const sb = await clienteServidor()

  // límites en hora de Bolivia (UTC−4): del primer instante de "desde" al último de "hasta"
  let consulta = sb
    .from('v_kardex')
    .select('*')
    .gte('created_at', `${desde}T00:00:00-04:00`)
    .lte('created_at', `${hasta}T23:59:59.999-04:00`)
    .order('created_at', { ascending: false })
    .limit(500)
  if (item) consulta = consulta.eq('tipo_item', item)
  if (tipo) consulta = consulta.eq('tipo', tipo)

  const { data, error } = await consulta
  const filas = data ?? []

  const entradas = filas.filter((f) => Number(f.cantidad) > 0).length
  const salidas = filas.length - entradas

  return (
    <div>
      <Encabezado
        titulo="Movimientos de stock"
        descripcion="Cada unidad que entró o salió, con quién y por qué. El stock de las otras pantallas es la suma de esta lista."
        modulo="inventario"
        permisos={sesion.permisos}
      />

      <FiltroFechas
        ruta="/inventario/movimientos"
        desde={desde}
        hasta={hasta}
        extras={{ item, tipo }}
      >
        <div>
          <label htmlFor="item" className="block text-xs font-medium text-tinta-suave">
            De qué
          </label>
          <select id="item" name="item" defaultValue={item ?? ''} className="campo mt-1 w-36 focus:campo-foco">
            <option value="">Todo</option>
            {Object.entries(ITEMS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tipo" className="block text-xs font-medium text-tinta-suave">
            Movimiento
          </label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ''} className="campo mt-1 w-36 focus:campo-foco">
            <option value="">Todos</option>
            {Object.entries(TIPOS_MOVIMIENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </FiltroFechas>

      {error && <ErrorCarga que="los movimientos" mensaje={error.message} />}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra etiqueta="Movimientos" valor={numero(filas.length)} />
        <Cifra etiqueta="Entradas" valor={numero(entradas)} tono="ok" />
        <Cifra etiqueta="Salidas" valor={numero(salidas)} />
      </div>

      {filas.length === 0 && !error ? (
        <Vacio>No hubo movimientos con estos filtros.</Vacio>
      ) : (
        <section className="tarjeta mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-linea bg-fondo text-left text-xs uppercase tracking-wide text-tinta-suave">
              <tr>
                <th className="px-3 py-2 font-medium">Cuándo</th>
                <th className="px-3 py-2 font-medium">Qué</th>
                <th className="px-3 py-2 font-medium">Movimiento</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Quién</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => {
                const t = f.tipo ? TIPOS_MOVIMIENTO[f.tipo] : null
                const cant = Number(f.cantidad)
                const instante = f.created_at ? new Date(f.created_at) : null
                const dia = instante
                  ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(instante)
                  : ''
                return (
                  <tr key={f.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-tinta-suave">
                      {diaCorto(dia)}{' '}
                      {instante?.toLocaleTimeString('es-BO', {
                        timeZone: 'America/La_Paz',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      {f.item}
                      <span className="ml-1 text-xs text-tinta-suave">
                        {f.tipo_item === 'insumo' ? '· insumo' : f.tipo_item === 'extra' ? '· extra' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2">{t && <Etiqueta clase={t.clase}>{t.etiqueta}</Etiqueta>}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${cant < 0 ? 'text-alerta' : 'text-ok'}`}
                    >
                      {cant > 0 ? '+' : ''}
                      {numero(cant)}
                    </td>
                    <td className="px-3 py-2 text-xs text-tinta-suave">
                      {f.pedido ?? f.compra ?? f.nota ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-tinta-suave">{f.registrado_por ?? 'el sistema'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
