import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cifra, Etiqueta } from '@/components/ui'
import { ESTADOS, ESTADO_PAGO } from '@/lib/estados'
import { bs, fecha, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FormularioCliente from './FormularioCliente'

export const metadata: Metadata = { title: 'Cliente' }
export const dynamic = 'force-dynamic'

export default async function PaginaCliente({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso('cliente.ver')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const sb = await clienteServidor()
  const verVentas = sesion.permisos.has('venta.ver')

  const [{ data: c }, { data: pedidos }] = await Promise.all([
    sb.from('v_cliente_resumen').select('*').eq('id', id).maybeSingle(),
    verVentas
      ? sb
          .from('pedido')
          .select('id, codigo, estado, total, canal, created_at, items:pedido_item (nombre, cantidad)')
          .eq('cliente_id', id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ])
  if (!c) notFound()

  const { data: saldos } = verVentas
    ? await sb.from('v_pedido_saldo').select('id, saldo, estado_pago').in('id', (pedidos ?? []).map((p) => p.id))
    : { data: [] }
  const saldoDe = new Map((saldos ?? []).map((s) => [s.id, s]))

  // lo que más le gusta: los productos que más pidió
  const favoritos = new Map<string, number>()
  for (const p of pedidos ?? []) {
    if (p.estado === 'cancelado') continue
    for (const i of (p.items as { nombre: string; cantidad: number }[] | null) ?? []) {
      favoritos.set(i.nombre, (favoritos.get(i.nombre) ?? 0) + i.cantidad)
    }
  }
  const top = [...favoritos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const tel = (c.telefono ?? '').replace(/\D/g, '')
  const whatsapp = tel.length === 8 ? `591${tel}` : tel

  return (
    <div>
      <Link href="/ventas/clientes" className="text-sm text-rosa-700 hover:underline">
        ← Clientes
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{c.nombre}</h1>
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="text-sm text-rosa-700 hover:underline">
          Escribir por WhatsApp
        </a>
        <span className="text-xs text-tinta-suave">cliente desde {fecha(c.created_at)}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra etiqueta="Compró" valor={bs(c.total_comprado)} tono="destacado" />
        <Cifra etiqueta="Compras" valor={numero(c.pedidos_confirmados)} detalle={`${numero(c.pedidos)} pedidos armados`} />
        <Cifra
          etiqueta="Ticket promedio"
          valor={bs(Number(c.pedidos_confirmados) ? Number(c.total_comprado) / Number(c.pedidos_confirmados) : 0)}
        />
        <Cifra etiqueta="Debe" valor={bs(c.saldo_pendiente)} tono={Number(c.saldo_pendiente) > 0 ? 'alerta' : 'normal'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <FormularioCliente
            id={id}
            puedeEditar={sesion.permisos.has('cliente.editar')}
            inicial={{ nombre: c.nombre ?? '', telefono: c.telefono ?? '', email: c.email ?? '', notas: c.notas ?? '' }}
          />

          {verVentas && (
            <section className="tarjeta">
              <h2 className="px-4 pt-4 text-sm font-semibold">Pedidos</h2>
              {(pedidos ?? []).length === 0 ? (
                <p className="px-4 pb-4 pt-2 text-sm text-tinta-suave">Todavía no hizo pedidos.</p>
              ) : (
                <ul className="mt-2 divide-y divide-linea">
                  {(pedidos ?? []).map((p) => {
                    const est = ESTADOS[p.estado]
                    const s = saldoDe.get(p.id)
                    const pago = s ? ESTADO_PAGO[s.estado_pago ?? 'pendiente'] : null
                    const items = (p.items as { nombre: string; cantidad: number }[] | null) ?? []
                    return (
                      <li key={p.id}>
                        <Link href={`/ventas/${p.codigo}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition hover:bg-rosa-50/50">
                          <span className="w-20 text-xs text-tinta-suave">{fecha(p.created_at)}</span>
                          <span className="font-mono text-xs">{p.codigo}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-tinta-suave">
                            {items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}
                          </span>
                          <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>
                          {pago && p.estado !== 'cancelado' && <Etiqueta clase={pago.clase}>{pago.etiqueta}</Etiqueta>}
                          <span className="w-20 text-right text-sm font-medium tabular-nums">{bs(p.total)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}
        </div>

        <section className="tarjeta h-fit p-4">
          <h2 className="text-sm font-semibold">Lo que más pide</h2>
          {top.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">Sin datos todavía.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {top.map(([nombre, cant]) => (
                <li key={nombre} className="flex justify-between gap-2">
                  <span className="truncate">{nombre}</span>
                  <span className="tabular-nums text-tinta-suave">×{numero(cant)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
