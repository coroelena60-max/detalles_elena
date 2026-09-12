import Link from 'next/link'
import AvisoError from '@/components/AvisoError'
import TarjetaExtra from '@/components/TarjetaExtra'
import TarjetaProducto from '@/components/TarjetaProducto'
import {
  obtenerCategorias,
  obtenerDestacados,
  obtenerExtras,
} from '@/lib/consultas'
import { enlaceConsultaWhatsapp } from '@/lib/whatsapp'

export const revalidate = 300

export default async function PaginaInicio() {
  let destacados, categorias, extras
  try {
    ;[destacados, categorias, extras] = await Promise.all([
      obtenerDestacados(6),
      obtenerCategorias(),
      obtenerExtras(),
    ])
  } catch (e) {
    return (
      <div className="contenedor py-10">
        <AvisoError detalle={e instanceof Error ? e.message : undefined} />
      </div>
    )
  }

  const extrasVisibles = extras.filter((x) => x.estado !== 'borrador').slice(0, 8)

  return (
    <>
      {/* Bienvenida */}
      <section className="border-b border-rosa-200 bg-white">
        <div className="contenedor grid gap-6 py-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-rosa-600">
              Cotoca · Santa Cruz de la Sierra
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Ramos y detalles con flores hechas a mano
            </h1>
            <p className="mt-4 text-base text-tinta-suave">
              Elegí los productos que te gusten, armá tu pedido y lo terminamos de
              coordinar por WhatsApp. Cada flor está hecha una por una, así que
              podemos adaptar tamaños, colores y extras a tu gusto.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/productos"
                className="rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-rosa-600"
              >
                Ver el catálogo
              </Link>
              <Link
                href="/pedido/personalizado"
                className="rounded-full border border-rosa-300 px-6 py-3 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50"
              >
                Armá tu ramo
              </Link>
            </div>
            <p className="mt-3 text-sm text-tinta-suave">
              ¿Querés algo que no está en el catálogo?{' '}
              <a
                href={enlaceConsultaWhatsapp('un pedido personalizado')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rosa-700 underline"
              >
                Consultanos por WhatsApp
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Más pedidos */}
      {destacados.length > 0 && (
        <section className="contenedor py-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold">Los más pedidos</h2>
            <Link href="/productos" className="text-sm text-rosa-700 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {destacados.map((p, i) => (
              <TarjetaProducto key={p.id} producto={p} prioridad={i < 2} />
            ))}
          </div>
        </section>
      )}

      {/* Categorías */}
      {categorias.length > 0 && (
        <section className="contenedor py-6">
          <h2 className="text-xl font-semibold">Categorías</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categorias.map((c) => (
              <Link
                key={c.id}
                href={`/productos?categoria=${c.slug}`}
                className="rounded-2xl border border-rosa-200 bg-white p-4 transition hover:border-rosa-300"
              >
                <h3 className="text-sm font-semibold">{c.nombre}</h3>
                {c.descripcion && (
                  <p className="mt-1 text-xs text-tinta-suave">{c.descripcion}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Extras */}
      {extrasVisibles.length > 0 && (
        <section className="contenedor py-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Flores y extras sueltos</h2>
              <p className="mt-1 text-sm text-tinta-suave">
                También se venden por unidad, o los sumás a cualquier ramo.
              </p>
            </div>
            <Link href="/extras" className="text-sm text-rosa-700 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extrasVisibles.map((x) => (
              <TarjetaExtra key={x.id} extra={x} />
            ))}
          </div>
        </section>
      )}

      {/* Armá tu ramo */}
      <section className="contenedor py-6">
        <div className="rounded-2xl border border-rosa-300 bg-white p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">¿Preferís armarlo vos?</h2>
            <p className="mt-2 text-sm text-tinta-suave">
              Elegí el envoltorio y ponele las flores, peluches y detalles que quieras.
              El armador te muestra cuánto espacio queda en cada tamaño.
            </p>
          </div>
          <Link
            href="/pedido/personalizado"
            className="mt-4 inline-block rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-rosa-600 sm:mt-0 sm:shrink-0"
          >
            Armá tu ramo
          </Link>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="contenedor pb-12">
        <div className="rounded-2xl border border-rosa-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Cómo funciona</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ['1', 'Armá tu pedido', 'Agregá los ramos y extras que quieras al pedido.'],
              ['2', 'Dejanos tus datos', 'Tu nombre, tu WhatsApp y, si querés envío, la dirección.'],
              ['3', 'Lo cerramos por WhatsApp', 'Te llega un código de pedido y coordinamos la entrega y el pago.'],
            ].map(([n, titulo, texto]) => (
              <li key={n} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rosa-100 text-sm font-semibold text-rosa-700">
                  {n}
                </span>
                <span>
                  <strong className="block text-sm font-medium">{titulo}</strong>
                  <span className="text-sm text-tinta-suave">{texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-tinta-suave">
            El costo del envío no está incluido en los precios: se cotiza por WhatsApp
            según la zona.
          </p>
        </div>
      </section>
    </>
  )
}
