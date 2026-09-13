import type { Metadata } from 'next'
import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import { Cifra, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { bs, haceCuanto, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Clientes' }
export const dynamic = 'force-dynamic'

const ORDENES = {
  recientes: { etiqueta: 'Últimos en comprar', campo: 'ultimo_pedido' },
  mejores: { etiqueta: 'Los que más compran', campo: 'total_comprado' },
  deben: { etiqueta: 'Con saldo', campo: 'saldo_pendiente' },
} as const

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orden?: string }>
}) {
  const sesion = await exigirPermiso('cliente.ver')
  const { q, orden: o } = await searchParams
  const orden = o && o in ORDENES ? (o as keyof typeof ORDENES) : 'recientes'
  const sb = await clienteServidor()

  let consulta = sb
    .from('v_cliente_resumen')
    .select('*')
    .order(ORDENES[orden].campo, { ascending: false, nullsFirst: false })
    .limit(200)
  const texto = q?.trim()
  if (texto) {
    const digitos = texto.replace(/\D/g, '')
    consulta = digitos.length >= 4
      ? consulta.ilike('telefono', `%${digitos}%`)
      : consulta.ilike('nombre', `%${texto}%`)
  }
  if (orden === 'deben') consulta = consulta.gt('saldo_pendiente', 0)

  const [{ data, error }, { data: todos }] = await Promise.all([
    consulta,
    sb.from('v_cliente_resumen').select('pedidos_confirmados, total_comprado, saldo_pendiente'),
  ])

  const clientes = data ?? []
  const base = todos ?? []
  const recurrentes = base.filter((c) => Number(c.pedidos_confirmados) > 1).length
  const deuda = base.reduce((s, c) => s + Number(c.saldo_pendiente ?? 0), 0)

  return (
    <div>
      <Encabezado
        titulo="Clientes"
        descripcion="Quiénes compran. Se crean solos con cada pedido: el teléfono es su llave."
        modulo="venta"
        permisos={sesion.permisos}
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra etiqueta="Clientes" valor={numero(base.length)} />
        <Cifra
          etiqueta="Volvieron a comprar"
          valor={numero(recurrentes)}
          detalle={base.length ? `${numero((recurrentes / base.length) * 100)}% del total` : undefined}
        />
        <Cifra etiqueta="Deben" valor={bs(deuda)} tono={deuda > 0 ? 'alerta' : 'normal'} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 overflow-x-auto">
          {Object.entries(ORDENES).map(([k, v]) => (
            <Link
              key={k}
              href={`/ventas/clientes?orden=${k}${texto ? `&q=${encodeURIComponent(texto)}` : ''}`}
              aria-current={orden === k ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                orden === k ? 'bg-rosa-100 font-medium text-rosa-700' : 'text-tinta-suave hover:bg-white'
              }`}
            >
              {v.etiqueta}
            </Link>
          ))}
        </nav>
        <form action="/ventas/clientes" className="flex gap-2">
          <input type="hidden" name="orden" value={orden} />
          <input name="q" defaultValue={q} placeholder="Nombre o teléfono" aria-label="Buscar cliente" className="campo w-48 focus:campo-foco" />
        </form>
      </div>

      {error && <ErrorCarga que="los clientes" mensaje={error.message} />}

      {clientes.length === 0 && !error ? (
        <Vacio>{texto ? 'Nadie con ese nombre o teléfono.' : 'Todavía no hay clientes.'}</Vacio>
      ) : (
        <ul className="tarjeta mt-4 divide-y divide-linea">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/ventas/clientes/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 transition hover:bg-rosa-50/50">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-rosa-100 text-sm font-medium text-rosa-700">
                  {(c.nombre ?? '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.nombre}</p>
                  <p className="text-xs text-tinta-suave">
                    {c.telefono} · {c.ultimo_pedido ? `compró ${haceCuanto(c.ultimo_pedido)}` : 'sin pedidos'}
                  </p>
                </div>
                {Number(c.pedidos_confirmados) > 1 && <Etiqueta clase="bg-ok-suave text-ok">Recurrente</Etiqueta>}
                {Number(c.saldo_pendiente) > 0 && (
                  <Etiqueta clase="bg-alerta-suave text-alerta">debe {bs(c.saldo_pendiente)}</Etiqueta>
                )}
                <div className="w-28 text-right">
                  <p className="text-sm font-semibold tabular-nums">{bs(c.total_comprado)}</p>
                  <p className="text-xs text-tinta-suave">
                    {numero(c.pedidos_confirmados)} compra{Number(c.pedidos_confirmados) === 1 ? '' : 's'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
