'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCarrito } from '@/lib/carrito/CarritoProvider'
import { bs } from '@/lib/formato'

const ETIQUETA_TIPO = {
  producto: 'Producto',
  extra: 'Extra',
  personalizado: 'Armado por vos',
} as const

export default function VistaCarrito() {
  const { lineas, total, cambiarCantidad, quitar, vaciar, listo } = useCarrito()

  if (!listo) {
    return (
      <div className="contenedor py-10">
        <p className="text-sm text-tinta-suave">Cargando tu pedido…</p>
      </div>
    )
  }

  if (lineas.length === 0) {
    return (
      <div className="contenedor py-12">
        <h1 className="text-2xl font-semibold">Tu pedido está vacío</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Agregá ramos o flores desde el catálogo y volvé acá para confirmar.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/productos"
            className="inline-block rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-rosa-600"
          >
            Ver el catálogo
          </Link>
          <Link
            href="/pedido/personalizado"
            className="inline-block rounded-full border border-rosa-300 px-6 py-3 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50"
          >
            Armá tu ramo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="contenedor py-8">
      <h1 className="text-2xl font-semibold">Mi pedido</h1>

      <ul className="mt-6 space-y-3">
        {lineas.map((l) => (
          <li
            key={l.clave}
            className="rounded-2xl border border-rosa-200 bg-white p-3"
          >
            <div className="flex items-start gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-rosa-100">
                {l.imagen ? (
                  <Image
                    src={l.imagen}
                    alt={l.nombre}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-2xl text-rosa-300">
                    ❀
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{l.nombre}</p>
                <p className="text-xs text-tinta-suave">
                  {ETIQUETA_TIPO[l.tipo]} · {bs(l.precio)} c/u
                </p>
                {l.extras && l.extras.length > 0 && (
                  <p className="mt-0.5 text-xs text-tinta-suave">
                    {l.extras.map((e) => `${e.cantidad}× ${e.nombre}`).join(' · ')}
                  </p>
                )}
                {l.dedicatoria && (
                  <p className="mt-0.5 text-xs italic text-tinta-suave">
                    «{l.dedicatoria}»
                  </p>
                )}
              </div>

              <p className="shrink-0 text-right text-sm font-semibold">
                {bs(l.precio * l.cantidad)}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.clave, l.cantidad - 1)}
                  aria-label={`Quitar uno de ${l.nombre}`}
                  className="size-8 rounded-full border border-rosa-200 text-sm hover:bg-rosa-50"
                >
                  −
                </button>
                <span aria-live="polite" className="w-8 text-center text-sm font-medium">
                  {l.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.clave, l.cantidad + 1)}
                  aria-label={`Agregar uno de ${l.nombre}`}
                  className="size-8 rounded-full border border-rosa-200 text-sm hover:bg-rosa-50"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => quitar(l.clave)}
                aria-label={`Sacar ${l.nombre} del pedido`}
                className="text-xs text-tinta-suave hover:text-rosa-700"
              >
                Sacar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-rosa-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-tinta-suave">Subtotal</span>
          <strong className="text-xl">{bs(total)}</strong>
        </div>
        <p className="mt-2 text-xs text-tinta-suave">
          No incluye el envío. El costo se cotiza por WhatsApp según la zona, y el
          monto final lo confirmamos ahí.
        </p>
        <Link
          href="/pedido/confirmar"
          className="mt-5 block rounded-full bg-rosa-500 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-rosa-600"
        >
          Confirmar la compra
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="flex gap-3">
            <Link href="/productos" className="text-rosa-700 hover:underline">
              Seguir agregando
            </Link>
            <Link
              href="/pedido/personalizado"
              className="text-rosa-700 hover:underline"
            >
              Armá tu ramo
            </Link>
          </span>
          <button
            type="button"
            onClick={vaciar}
            className="text-tinta-suave hover:text-rosa-700"
          >
            Vaciar el pedido
          </button>
        </div>
      </div>
    </div>
  )
}
