import Link from 'next/link'
import type { Metadata } from 'next'
import BotonWhatsapp from './BotonWhatsapp'

export const metadata: Metadata = { title: 'Pedido generado' }

export default async function PaginaPedidoGenerado({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>
  searchParams: Promise<{ n?: string; t?: string }>
}) {
  const { codigo } = await params
  const { n, t } = await searchParams
  const nombre = n ?? ''
  const total = Number(t ?? 0)

  return (
    <div className="contenedor py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-rosa-200 bg-white p-7 text-center">
        <span
          aria-hidden
          className="mx-auto grid size-14 place-items-center rounded-full bg-rosa-100 text-2xl text-rosa-600"
        >
          ❀
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Tu pedido quedó registrado</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Guardá este código. Es el que usamos en la tienda para ver tu pedido completo.
        </p>

        <p className="mt-5 rounded-xl bg-rosa-50 px-4 py-3 text-2xl font-semibold tracking-wider text-rosa-700">
          {codigo.toUpperCase()}
        </p>

        <p className="mt-5 text-sm text-tinta-suave">
          Falta un paso: mandanos el código por WhatsApp para confirmar la entrega y
          el pago. El envío se cotiza ahí.
        </p>

        <BotonWhatsapp codigo={codigo.toUpperCase()} nombre={nombre} total={total} />

        <Link
          href="/productos"
          className="mt-4 inline-block text-sm text-rosa-700 hover:underline"
        >
          Volver al catálogo
        </Link>
      </div>
    </div>
  )
}
