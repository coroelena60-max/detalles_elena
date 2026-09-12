import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BotonAgregar from '@/components/BotonAgregar'
import ImagenCatalogo from '@/components/ImagenCatalogo'
import TarjetaProducto from '@/components/TarjetaProducto'
import {
  obtenerComposicion,
  obtenerImagenesProducto,
  obtenerProductoPorSlug,
  obtenerProductos,
} from '@/lib/consultas'
import { bs, plazoEntrega, precioProducto } from '@/lib/formato'
import { enlaceConsultaWhatsapp } from '@/lib/whatsapp'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const producto = await obtenerProductoPorSlug(slug)
    if (!producto) return { title: 'Producto no encontrado' }
    return {
      title: producto.nombre,
      description:
        producto.descripcion ??
        `${producto.nombre} · ${precioProducto(producto.precio, producto.precio_desde)}`,
    }
  } catch {
    return { title: 'Producto' }
  }
}

export default async function PaginaProducto({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const producto = await obtenerProductoPorSlug(slug)
  if (!producto) notFound()

  const [imagenes, composicion, mismaCategoria] = await Promise.all([
    obtenerImagenesProducto(producto.id),
    obtenerComposicion(producto.id),
    obtenerProductos(producto.categoria_slug),
  ])

  const galeria =
    imagenes.length > 0
      ? imagenes
      : [{ id: 0, url: producto.imagen_principal ?? '', alt: producto.nombre, orden: 1, es_principal: true }]

  const relacionados = mismaCategoria.filter((p) => p.id !== producto.id).slice(0, 4)
  const plazo = plazoEntrega(producto.lead_time_dias)
  const agotado = producto.estado === 'agotado'

  return (
    <div className="contenedor py-8">
      <nav aria-label="Migas de pan" className="text-xs text-tinta-suave">
        <Link href="/productos" className="hover:text-rosa-700">Productos</Link>
        <span aria-hidden> / </span>
        <Link
          href={`/productos?categoria=${producto.categoria_slug}`}
          className="hover:text-rosa-700"
        >
          {producto.categoria_nombre}
        </Link>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        {/* Galería */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-rosa-200 bg-white">
            <ImagenCatalogo
              src={galeria[0]?.url || null}
              alt={producto.nombre}
              sizes="(max-width: 1024px) 100vw, 520px"
              prioridad
              className="size-full"
            />
          </div>
          {galeria.length > 1 && (
            <ul className="mt-3 grid grid-cols-4 gap-2">
              {galeria.slice(1).map((img) => (
                <li
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-rosa-200 bg-white"
                >
                  <ImagenCatalogo
                    src={img.url || null}
                    alt={img.alt ?? producto.nombre}
                    sizes="120px"
                    className="size-full"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ficha */}
        <div>
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            {producto.categoria_nombre}
            {producto.estilo_nombre ? ` · ${producto.estilo_nombre}` : ''}
            {producto.tamano_nombre ? ` · ${producto.tamano_nombre}` : ''}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">
            {producto.nombre}
          </h1>
          <p className="mt-3 text-2xl font-semibold text-rosa-700">
            {precioProducto(producto.precio, producto.precio_desde)}
          </p>

          {producto.descripcion && (
            <p className="mt-4 text-sm leading-relaxed text-tinta-suave">
              {producto.descripcion}
            </p>
          )}

          {composicion.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold">Qué incluye</h2>
              <ul className="mt-2 space-y-1 text-sm text-tinta-suave">
                {composicion.map((c, i) => (
                  <li key={c.extra?.id ?? i}>
                    {Number(c.cantidad)} × {c.extra?.nombre ?? 'extra'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="mt-6 grid gap-2 text-sm">
            {plazo && (
              <div className="flex gap-2">
                <dt className="text-tinta-suave">Entrega:</dt>
                <dd>{plazo}</dd>
              </div>
            )}
            {producto.espacios_capacidad !== null && (
              <div className="flex gap-2">
                <dt className="text-tinta-suave">Capacidad del envoltorio:</dt>
                <dd>{Number(producto.espacios_capacidad)} espacios de flores</dd>
              </div>
            )}
          </dl>

          <div className="mt-7">
            <BotonAgregar
              tipo="producto"
              referenciaId={producto.id}
              nombre={producto.nombre}
              precio={producto.precio}
              imagen={producto.imagen_principal}
              agotado={agotado}
            />
            <p className="mt-3 text-xs text-tinta-suave">
              El precio no incluye el envío: se cotiza por WhatsApp según la zona.
            </p>
            <a
              href={enlaceConsultaWhatsapp(producto.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-rosa-700 hover:underline"
            >
              ¿Querés cambiar colores o cantidades? Escribinos
            </a>
          </div>
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold">Más de {producto.categoria_nombre}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {relacionados.map((p) => (
              <TarjetaProducto key={p.id} producto={p} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-tinta-suave">
        Referencia interna: {producto.codigo} · {bs(producto.precio)}
      </p>
    </div>
  )
}
