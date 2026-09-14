import Link from 'next/link'
import Icono, { type NombreIcono } from '@/components/Icono'
import { Cifra } from '@/components/ui'
import { bs, haceCuanto } from '@/lib/formato'
import { ESTADOS } from '@/lib/estados'
import { exigirSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

function Atajo({
  href,
  icono,
  titulo,
  detalle,
  destacado = false,
  contador = 0,
}: {
  href: string
  icono: NombreIcono
  titulo: string
  detalle: string
  destacado?: boolean
  contador?: number
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-4 rounded-2xl border-2 p-5 transition ${
        destacado
          ? 'border-rosa-600 bg-rosa-600 text-white hover:bg-rosa-700'
          : 'border-linea bg-white hover:border-rosa-300'
      }`}
    >
      <span
        className={`grid size-14 shrink-0 place-items-center rounded-2xl ${
          destacado ? 'bg-white/20' : 'bg-rosa-100 text-rosa-700'
        }`}
      >
        <Icono nombre={icono} className="size-8" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold">{titulo}</span>
        <span className={`block text-sm ${destacado ? 'text-white/85' : 'text-tinta-suave'}`}>{detalle}</span>
      </span>
      {contador > 0 && (
        <span className="absolute right-4 top-4 grid min-w-8 place-items-center rounded-full bg-alerta px-2 py-0.5 text-base font-semibold text-white">
          {contador}
        </span>
      )}
    </Link>
  )
}

export default async function PaginaInicio() {
  const sesion = await exigirSesion()
  const sb = await clienteServidor()
  const p = sesion.permisos
  const verPedidos = p.has('pedido.ver')

  const [{ data: tablero }, { data: ultimos }] = await Promise.all([
    sb.from('v_tablero_admin').select('*').maybeSingle(),
    verPedidos
      ? sb
          .from('pedido')
          .select('codigo, estado, total, created_at, cliente:cliente_id (nombre)')
          .neq('canal', 'mostrador')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ])

  const porAtender = tablero?.pedidos_por_atender ?? 0
  const verNegocio = p.has('contabilidad.ver')
  const verCaja = p.has('venta.ver') || verPedidos

  return (
    <div>
      <h1 className="text-2xl font-semibold">Hola, {sesion.nombre}</h1>

      {/* ---------- Lo que se hace todos los días ---------- */}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {p.has('venta.editar') && (
          <Atajo href="/ventas/nueva" icono="vender" titulo="Vender" detalle="Venta en la tienda" destacado />
        )}
        {verPedidos && (
          <Atajo
            href="/pedidos"
            icono="pedidos"
            titulo="Pedidos"
            detalle={porAtender > 0 ? `${porAtender} por atender` : 'Del catálogo web'}
            contador={porAtender}
          />
        )}
        {p.has('maestro.editar') && (
          <Atajo href="/productos/nuevo" icono="camara" titulo="Nuevo producto" detalle="Subir un ramo al catálogo" />
        )}
      </div>

      {/* ---------- Números del día ---------- */}
      {verCaja && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Cifra etiqueta="Vendido hoy" valor={bs(tablero?.vendido_hoy ?? 0)} />
          <Cifra
            etiqueta="Falta cobrar"
            valor={bs(tablero?.por_cobrar ?? 0)}
            tono={(tablero?.por_cobrar ?? 0) > 0 ? 'destacado' : 'normal'}
          />
        </div>
      )}

      {verNegocio && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">El negocio</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra etiqueta="Vendido este mes" valor={bs(tablero?.vendido_mes ?? 0)} />
            <Cifra etiqueta="Pedidos en curso" valor={String(tablero?.pedidos_en_curso ?? 0)} />
            <Cifra
              etiqueta="Poco stock"
              valor={String(tablero?.alertas_stock ?? 0)}
              tono={(tablero?.alertas_stock ?? 0) > 0 ? 'alerta' : 'normal'}
            />
            <Cifra
              etiqueta="Se venden a pérdida"
              valor={String(tablero?.productos_a_perdida ?? 0)}
              tono={(tablero?.productos_a_perdida ?? 0) > 0 ? 'alerta' : 'normal'}
            />
          </div>
        </section>
      )}

      {verPedidos && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold">Últimos pedidos</h2>
            <Link href="/pedidos" className="text-sm text-rosa-700 hover:underline">
              Ver todos
            </Link>
          </div>

          {ultimos && ultimos.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {ultimos.map((pedido) => {
                const estado = ESTADOS[pedido.estado]
                const cliente = pedido.cliente as { nombre: string } | null
                return (
                  <li key={pedido.codigo}>
                    <Link
                      href={`/pedidos/${pedido.codigo}`}
                      className="tarjeta flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 p-3 transition hover:border-rosa-300"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{cliente?.nombre ?? 'Sin nombre'}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm ${estado.clase}`}>
                        {estado.etiqueta}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{bs(pedido.total)}</span>
                      <span className="hidden shrink-0 text-sm text-tinta-suave sm:inline">
                        {haceCuanto(pedido.created_at)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="tarjeta mt-3 p-5 text-tinta-suave">Todavía no entró ningún pedido.</p>
          )}
        </section>
      )}
    </div>
  )
}
