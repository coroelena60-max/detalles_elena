import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { METODOS_PAGO, nombreCliente, rutaPedido } from '@/lib/estados'
import { bs, fechaHora, numero } from '@/lib/formato'
import { exigirSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import BotonesComprobante from './BotonesComprobante'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  return { title: `Comprobante ${(await params).codigo.toUpperCase()}` }
}

/**
 * Comprobante simple para imprimir, guardar en PDF o mandar por WhatsApp.
 * No es una factura: es la constancia de lo que se vendió y lo cobrado.
 * Vive fuera del layout del panel para imprimirse limpio.
 */
export default async function PaginaComprobante({ params }: { params: Promise<{ codigo: string }> }) {
  await exigirSesion()
  const codigo = (await params).codigo.toUpperCase()
  const sb = await clienteServidor()

  const { data: p } = await sb
    .from('pedido')
    .select(
      `id, codigo, canal, created_at, subtotal, descuento, costo_envio, total, tipo_entrega, fecha_compromiso,
       cliente:cliente_id (nombre, telefono),
       items:pedido_item (id, nombre, cantidad, precio_unitario, subtotal, dedicatoria,
                          extras:pedido_item_extra (nombre, cantidad))`,
    )
    .eq('codigo', codigo)
    .maybeSingle()
  if (!p) notFound()

  const [{ data: saldo }, { data: pagos }] = await Promise.all([
    sb.from('v_pedido_saldo').select('total_cobrar, pagado, saldo').eq('id', p.id).maybeSingle(),
    sb.from('pago').select('monto, metodo, fecha').eq('pedido_id', p.id).order('fecha'),
  ])

  const cliente = p.cliente as { nombre: string; telefono: string } | null
  const esSinCliente = !cliente || cliente.nombre === 'S/N'
  const items = (p.items ?? []).slice().sort((a, b) => a.id - b.id)
  const total = Number(saldo?.total_cobrar ?? p.total)
  const pagado = Number(saldo?.pagado ?? 0)
  const debe = Number(saldo?.saldo ?? 0)

  // mensaje corto: WhatsApp degrada los enlaces muy largos
  const lineas = items.slice(0, 8).map((i) => `• ${i.cantidad}× ${i.nombre} — ${bs(i.subtotal)}`)
  if (items.length > 8) lineas.push(`• …y ${items.length - 8} más`)
  const texto = [
    `🌸 *Detalles Elena* — comprobante ${p.codigo}`,
    ...lineas,
    `*Total: ${bs(total)}*`,
    pagado > 0 ? `Pagado: ${bs(pagado)}${debe > 0 ? ` · Saldo: ${bs(debe)}` : ''}` : `Saldo: ${bs(debe)}`,
    '¡Gracias por tu compra!',
  ].join('\n')
  const telefono = esSinCliente ? '' : (cliente?.telefono ?? '').replace(/\D/g, '')
  const whatsapp = `https://wa.me/${telefono.length === 8 ? `591${telefono}` : telefono}?text=${encodeURIComponent(texto)}`

  return (
    <div className="min-h-dvh bg-fondo px-4 py-6 print:bg-white print:p-0">
      <BotonesComprobante volver={rutaPedido(p.codigo, p.canal)} whatsapp={whatsapp} texto={texto} />

      <article className="mx-auto mt-4 max-w-md rounded-2xl bg-white p-6 shadow-sm print:mt-0 print:max-w-none print:rounded-none print:shadow-none">
        <header className="text-center">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-rosa-100 text-2xl text-rosa-700">❀</span>
          <h1 className="mt-2 text-lg font-semibold">Detalles Elena</h1>
          <p className="text-xs text-tinta-suave">Flores y detalles hechos a mano · Cotoca, Santa Cruz</p>
          <p className="mt-3 font-mono text-base font-semibold">{p.codigo}</p>
          <p className="text-xs text-tinta-suave">
            {fechaHora(p.created_at)} · {p.canal === 'mostrador' ? 'Venta en tienda' : 'Pedido por catálogo'}
          </p>
        </header>

        <p className="mt-4 border-t border-dashed border-linea pt-3 text-sm">
          <span className="text-tinta-suave">Cliente: </span>
          {nombreCliente(cliente)}
          {!esSinCliente && cliente?.telefono && <span className="text-tinta-suave"> · {cliente.telefono}</span>}
        </p>
        {p.fecha_compromiso && (
          <p className="text-sm">
            <span className="text-tinta-suave">{p.tipo_entrega === 'envio' ? 'Entrega' : 'Retira'}: </span>
            {p.fecha_compromiso}
          </p>
        )}

        <table className="mt-3 w-full border-t border-dashed border-linea text-sm">
          <tbody>
            {items.map((i) => {
              const extras = (i.extras ?? []) as { nombre: string; cantidad: number }[]
              return (
                <tr key={i.id} className="align-top">
                  <td className="py-2 pr-2 tabular-nums text-tinta-suave">{i.cantidad}×</td>
                  <td className="py-2">
                    {i.nombre}
                    {extras.length > 0 && (
                      <span className="block text-xs text-tinta-suave">{extras.map((e) => `${numero(e.cantidad)}× ${e.nombre}`).join(', ')}</span>
                    )}
                    {i.dedicatoria && <span className="block text-xs italic text-tinta-suave">«{i.dedicatoria}»</span>}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">{bs(i.subtotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <dl className="mt-2 space-y-1 border-t border-dashed border-linea pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-tinta-suave">Subtotal</dt><dd className="tabular-nums">{bs(p.subtotal)}</dd></div>
          {Number(p.descuento) > 0 && (
            <div className="flex justify-between"><dt className="text-tinta-suave">Descuento</dt><dd className="tabular-nums">− {bs(p.descuento)}</dd></div>
          )}
          {Number(p.costo_envio) > 0 && (
            <div className="flex justify-between"><dt className="text-tinta-suave">Envío</dt><dd className="tabular-nums">{bs(p.costo_envio)}</dd></div>
          )}
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{bs(total)}</dd></div>
          {(pagos ?? []).map((g, idx) => (
            <div key={idx} className="flex justify-between text-xs text-tinta-suave">
              <dt>Pago {METODOS_PAGO[g.metodo]} · {fechaHora(g.fecha)}</dt>
              <dd className="tabular-nums">{bs(g.monto)}</dd>
            </div>
          ))}
          <div className="flex justify-between font-medium">
            <dt>{debe > 0 ? 'Saldo pendiente' : 'Estado'}</dt>
            <dd className="tabular-nums">{debe > 0 ? bs(debe) : 'Pagado ✓'}</dd>
          </div>
        </dl>

        <footer className="mt-5 border-t border-dashed border-linea pt-3 text-center text-xs text-tinta-suave">
          ¡Gracias por elegirnos! · TikTok @detalles_elenac
          <span className="block">Comprobante interno, no válido como factura.</span>
        </footer>
      </article>
    </div>
  )
}
