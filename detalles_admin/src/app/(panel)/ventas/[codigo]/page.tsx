import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Miniatura from '@/components/Miniatura'
import { ESTADOS, ESTADO_PAGO, METODOS_PAGO, fotoPrincipal, nombreCliente } from '@/lib/estados'
import { bs, fechaHora, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import AccionesPedido from './AccionesPedido'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>
}): Promise<Metadata> {
  const { codigo } = await params
  return { title: `Pedido ${codigo.toUpperCase()}` }
}

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const sesion = await exigirPermiso('venta.ver')
  const { codigo: crudo } = await params
  const codigo = crudo.toUpperCase()
  const sb = await clienteServidor()

  const { data: pedido } = await sb
    .from('pedido')
    .select(
      `id, codigo, estado, tipo_entrega, subtotal, costo_envio, descuento, total,
       nota_cliente, nota_interna, canal, created_at, enviado_whatsapp_at, entregado_at,
       cliente:cliente_id (nombre, telefono, email),
       entrega (direccion, referencia, destinatario, telefono, fecha_entrega, instrucciones,
                zona:zona_envio_id (nombre, costo_referencia)),
       items:pedido_item (id, tipo, nombre, precio_unitario, cantidad, subtotal, dedicatoria,
                          producto:producto_id (imagenes:producto_imagen (url, es_principal, orden)),
                          extra:extra_id (imagen_url),
                          extras:pedido_item_extra (id, nombre, cantidad, subtotal, extra:extra_id (imagen_url)))`,
    )
    .eq('codigo', codigo)
    .maybeSingle()

  if (!pedido) notFound()

  const [{ data: saldo }, { data: pagos }] = await Promise.all([
    sb.from('v_pedido_saldo').select('*').eq('id', pedido.id).maybeSingle(),
    sb
      .from('pago')
      .select('id, monto, metodo, referencia, fecha')
      .eq('pedido_id', pedido.id)
      .order('fecha'),
  ])

  const estado = ESTADOS[pedido.estado]
  const cliente = pedido.cliente as {
    nombre: string
    telefono: string
    email: string | null
  } | null
  const entrega = pedido.entrega as {
    direccion: string
    referencia: string | null
    destinatario: string | null
    telefono: string | null
    fecha_entrega: string | null
    instrucciones: string | null
    zona: { nombre: string; costo_referencia: number | null } | null
  } | null
  const pago = ESTADO_PAGO[saldo?.estado_pago ?? 'pendiente']
  const telefonoWhatsapp = cliente?.telefono?.replace(/[^0-9]/g, '')

  return (
    <div>
      <Link
        href={pedido.canal === 'mostrador' ? '/ventas' : '/pedidos'}
        className="text-sm text-rosa-700 hover:underline"
      >
        ← {pedido.canal === 'mostrador' ? 'Ventas' : 'Pedidos'}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{codigo}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${estado.clase}`}>
          {estado.etiqueta}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${pago.clase}`}>
          {pago.etiqueta}
        </span>
        <span className="text-xs text-tinta-suave">
          {pedido.canal === 'mostrador' ? 'Mostrador' : 'Catálogo web'} ·{' '}
          {fechaHora(pedido.created_at)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {/* ---------------- Qué pidió ---------------- */}
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">Qué pidió</h2>
            <ul className="mt-3 divide-y divide-linea">
              {(pedido.items ?? []).map((i) => {
                const extras = (i.extras ?? []) as {
                  id: number
                  nombre: string
                  cantidad: number
                  subtotal: number
                  extra: { imagen_url: string | null } | null
                }[]
                // producto → su foto principal; extra suelto → su foto;
                // armado personalizado → la del primer extra que tenga foto
                const foto =
                  fotoPrincipal(i.producto?.imagenes) ??
                  i.extra?.imagen_url ??
                  extras.find((e) => e.extra?.imagen_url)?.extra?.imagen_url
                return (
                  <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Miniatura url={foto} alt={i.nombre} className="size-16" />
                      <span className="text-sm text-tinta-suave">{i.cantidad}×</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{i.nombre}</p>
                        {extras.length > 0 && (
                          <p className="mt-0.5 text-xs text-tinta-suave">
                            {extras
                              .map((e) => `${numero(e.cantidad)}× ${e.nombre}`)
                              .join(' · ')}
                          </p>
                        )}
                        {i.dedicatoria && (
                          <p className="mt-1 rounded bg-rosa-50 px-2 py-1 text-xs italic">
                            «{i.dedicatoria}»
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {bs(i.subtotal)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            <dl className="mt-4 space-y-1 border-t border-linea pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Subtotal</dt>
                <dd>{bs(pedido.subtotal)}</dd>
              </div>
              {Number(pedido.descuento) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-tinta-suave">Descuento</dt>
                  <dd>− {bs(pedido.descuento)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Envío</dt>
                <dd>
                  {Number(pedido.costo_envio) > 0
                    ? bs(pedido.costo_envio)
                    : 'a cotizar'}
                </dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{bs(saldo?.total_cobrar ?? pedido.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Cobrado</dt>
                <dd>{bs(saldo?.pagado ?? 0)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Saldo</dt>
                <dd>{bs(saldo?.saldo ?? 0)}</dd>
              </div>
            </dl>

            {pedido.nota_cliente && (
              <p className="mt-4 rounded-lg bg-rosa-50 p-3 text-sm">
                <strong className="block text-xs uppercase tracking-wide text-tinta-suave">
                  Nota del cliente
                </strong>
                {pedido.nota_cliente}
              </p>
            )}
          </section>

          {/* ---------------- Cobros ---------------- */}
          {pagos && pagos.length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold">Cobros</h2>
              <ul className="mt-3 divide-y divide-linea text-sm">
                {pagos.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1">{METODOS_PAGO[g.metodo]}</span>
                    {g.referencia && (
                      <span className="text-xs text-tinta-suave">{g.referencia}</span>
                    )}
                    <span className="text-xs text-tinta-suave">
                      {fechaHora(g.fecha)}
                    </span>
                    <span className="font-semibold">{bs(g.monto)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---------------- Columna lateral ---------------- */}
        <div className="space-y-4">
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">Cliente</h2>
            <p className="mt-2 text-sm font-medium">{nombreCliente(cliente)}</p>
            {cliente?.telefono && cliente.nombre !== 'S/N' && (
              <p className="mt-1 text-sm">
                <a
                  href={`https://wa.me/${telefonoWhatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rosa-700 hover:underline"
                >
                  {cliente.telefono} · escribir por WhatsApp
                </a>
              </p>
            )}
            {cliente?.email && (
              <p className="mt-1 text-sm text-tinta-suave">{cliente.email}</p>
            )}
          </section>

          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">Entrega</h2>
            {pedido.tipo_entrega === 'envio' && entrega ? (
              <div className="mt-2 space-y-1 text-sm">
                <p>{entrega.direccion}</p>
                {entrega.referencia && (
                  <p className="text-tinta-suave">{entrega.referencia}</p>
                )}
                {entrega.zona?.nombre && (
                  <p className="text-tinta-suave">Zona: {entrega.zona.nombre}</p>
                )}
                {entrega.destinatario && (
                  <p className="text-tinta-suave">Para: {entrega.destinatario}</p>
                )}
                {entrega.telefono && (
                  <p className="text-tinta-suave">Tel: {entrega.telefono}</p>
                )}
                {entrega.fecha_entrega && (
                  <p className="text-tinta-suave">Fecha: {entrega.fecha_entrega}</p>
                )}
                {entrega.instrucciones && (
                  <p className="text-tinta-suave">{entrega.instrucciones}</p>
                )}
                <p className="pt-1 text-xs text-tinta-suave">
                  El envío se cotiza aparte; no está en el total.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm">Retira en la tienda.</p>
            )}
          </section>

          <AccionesPedido
            codigo={codigo}
            pedidoId={pedido.id}
            estado={pedido.estado}
            saldo={Number(saldo?.saldo ?? 0)}
            puedeEditar={sesion.permisos.has('venta.editar')}
            puedeCobrar={sesion.permisos.has('pago.registrar')}
          />

          {pedido.nota_interna && (
            <p className="tarjeta p-4 text-sm">
              <strong className="block text-xs uppercase tracking-wide text-tinta-suave">
                Nota interna
              </strong>
              {pedido.nota_interna}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
