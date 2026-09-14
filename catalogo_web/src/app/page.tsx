import Image from 'next/image'
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
      <section className="overflow-hidden border-b border-rosa-200 bg-white">
        {/* Celular: el ramo al lado del título y los botones abajo a lo ancho.
            Desde md: texto a la izquierda y el ramo ocupando toda la altura a la derecha. */}
        <div className="contenedor grid grid-cols-[1fr_8rem] items-center gap-x-3 py-8 [grid-template-areas:'lugar_lugar'_'texto_ramo'_'acciones_acciones'] sm:grid-cols-[1fr_10rem] sm:py-14 md:grid-cols-[1.15fr_0.85fr] md:grid-rows-[1fr_auto_auto_auto_1fr] md:gap-x-8 md:[grid-template-areas:'._ramo'_'lugar_ramo'_'texto_ramo'_'acciones_ramo'_'._ramo']">
          <p className="text-xs uppercase tracking-[0.2em] text-rosa-600 [grid-area:lugar]">
            Cotoca · Santa Cruz de la Sierra
          </p>
          <div className="max-w-2xl [grid-area:texto]">
            <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-4xl">
              Ramos y detalles con flores hechas a mano
            </h1>
            <p className="mt-3 text-sm text-tinta-suave sm:text-base">
              Elegí, pedí y lo coordinamos por WhatsApp.
            </p>
          </div>
          <div className="[grid-area:acciones]">
            <div className="mt-5 flex flex-wrap gap-3 md:mt-6">
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
            <a
              href={enlaceConsultaWhatsapp('un pedido personalizado')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-rosa-700 underline"
            >
              ¿Otra idea? Escribinos
            </a>
          </div>

          {/* Ramo recortado (fondo transparente) flotando sobre una mancha rosa */}
          <div className="relative mt-3 w-full [grid-area:ramo] md:mx-auto md:mt-0 md:max-w-sm">
            <div
              aria-hidden
              className="absolute inset-x-[-12%] top-[8%] bottom-[12%] rounded-full bg-radial from-rosa-200 via-rosa-100 to-transparent blur-xl md:blur-2xl"
            />
            <div
              aria-hidden
              className="absolute bottom-0 left-1/2 h-2.5 w-3/5 -translate-x-1/2 rounded-full bg-rosa-700/40 blur-sm motion-safe:animate-sombra-flotar md:h-5 md:blur-md"
            />
            <Image
              src="/portada-ramo-rosas.webp"
              alt="Ramo abanico con rosas rosadas hechas a mano"
              width={800}
              height={1052}
              priority
              sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, 384px"
              className="relative mb-3 h-auto w-full drop-shadow-xl drop-shadow-rosa-700/25 motion-safe:animate-flotar md:mb-6 md:drop-shadow-2xl"
            />
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
              <p className="mt-1 text-sm text-tinta-suave">Por unidad o en tu ramo.</p>
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
            <p className="mt-1 text-sm text-tinta-suave">
              Elegí el envoltorio y ponele lo que quieras.
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
              ['1', 'Elegí tus flores'],
              ['2', 'Dejá tus datos'],
              ['3', 'Confirmamos por WhatsApp'],
            ].map(([n, titulo]) => (
              <li key={n} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rosa-100 text-sm font-semibold text-rosa-700">
                  {n}
                </span>
                <span className="text-sm font-medium">{titulo}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-tinta-suave">El envío se cotiza aparte.</p>
        </div>
      </section>
    </>
  )
}
