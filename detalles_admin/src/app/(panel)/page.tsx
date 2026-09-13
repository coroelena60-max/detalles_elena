import Link from 'next/link'
import { bs, haceCuanto } from '@/lib/formato'
import { ESTADOS } from '@/lib/estados'
import { exigirSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

function Numerito({
  etiqueta,
  valor,
  detalle,
  destacado = false,
}: {
  etiqueta: string
  valor: string
  detalle?: string
  destacado?: boolean
}) {
  return (
    <div className={`tarjeta p-4 ${destacado ? 'border-rosa-300 bg-rosa-50' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-tinta-suave">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  )
}

export default async function PaginaTablero() {
  const sesion = await exigirSesion()
  const sb = await clienteServidor()

  const [{ data: tablero }, { data: ultimos }] = await Promise.all([
    sb.from('v_tablero_admin').select('*').maybeSingle(),
    sb
      .from('pedido')
      .select('codigo, estado, total, canal, created_at, cliente:cliente_id (nombre)')
      .neq('canal', 'mostrador')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const puedeVerVentas = sesion.permisos.has('pedido.ver')

  return (
    <div>
      <h1 className="text-xl font-semibold">Hola, {sesion.nombre}</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Esto es lo que hay hoy en la tienda.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numerito
          etiqueta="Por atender"
          valor={String(tablero?.pedidos_por_atender ?? 0)}
          detalle="pedidos nuevos"
          destacado={(tablero?.pedidos_por_atender ?? 0) > 0}
        />
        <Numerito
          etiqueta="En curso"
          valor={String(tablero?.pedidos_en_curso ?? 0)}
          detalle="confirmados o en taller"
        />
        <Numerito etiqueta="Vendido hoy" valor={bs(tablero?.vendido_hoy ?? 0)} />
        <Numerito etiqueta="Vendido este mes" valor={bs(tablero?.vendido_mes ?? 0)} />
        <Numerito
          etiqueta="Por cobrar"
          valor={bs(tablero?.por_cobrar ?? 0)}
          detalle="pedidos con saldo"
        />
        <Numerito
          etiqueta="Alertas de stock"
          valor={String(tablero?.alertas_stock ?? 0)}
          detalle="ítems bajo el mínimo"
        />
        <Numerito
          etiqueta="A pérdida"
          valor={String(tablero?.productos_a_perdida ?? 0)}
          detalle="productos bajo su costo"
        />
      </div>

      {puedeVerVentas && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-base font-semibold">Últimos pedidos</h2>
            <Link href="/pedidos" className="text-sm text-rosa-700 hover:underline">
              Ver todos
            </Link>
          </div>

          {ultimos && ultimos.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {ultimos.map((p) => {
                const estado = ESTADOS[p.estado]
                const cliente = p.cliente as { nombre: string } | null
                return (
                  <li key={p.codigo}>
                    <Link
                      href={`/pedidos/${p.codigo}`}
                      className="tarjeta flex items-center gap-3 p-3 transition hover:border-rosa-300"
                    >
                      <span className="font-mono text-xs text-tinta-suave">
                        {p.codigo}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {cliente?.nombre ?? 'Sin cliente'}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${estado.clase}`}
                      >
                        {estado.etiqueta}
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {bs(p.total)}
                      </span>
                      <span className="hidden shrink-0 text-xs text-tinta-suave sm:inline">
                        {haceCuanto(p.created_at)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="tarjeta mt-3 p-5 text-sm text-tinta-suave">
              Todavía no entró ningún pedido.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
