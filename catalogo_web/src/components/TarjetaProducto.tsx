import Link from 'next/link'
import BotonAgregar from '@/components/BotonAgregar'
import ImagenCatalogo from '@/components/ImagenCatalogo'
import { precioProducto } from '@/lib/formato'
import type { CatalogoProducto } from '@/types/database'

export default function TarjetaProducto({
  producto,
  prioridad = false,
}: {
  producto: CatalogoProducto
  prioridad?: boolean
}) {
  const agotado = producto.estado === 'agotado'

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-rosa-200 bg-white transition hover:border-rosa-300">
      <Link
        href={`/productos/${producto.slug}`}
        className="relative block aspect-square overflow-hidden"
      >
        <ImagenCatalogo
          src={producto.imagen_principal}
          alt={producto.nombre}
          prioridad={prioridad}
          className="size-full"
        />
        {agotado && (
          <span className="absolute left-2 top-2 rounded-full bg-tinta/80 px-2 py-1 text-[11px] font-medium text-white">
            Agotado
          </span>
        )}
        {producto.estado === 'temporada' && (
          <span className="absolute left-2 top-2 rounded-full bg-rosa-600 px-2 py-1 text-[11px] font-medium text-white">
            Por temporada
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-[11px] uppercase tracking-wide text-tinta-suave">
          {producto.categoria_nombre}
          {producto.tamano_codigo ? ` · ${producto.tamano_codigo}` : ''}
        </p>
        <h3 className="text-sm font-medium leading-snug">
          <Link href={`/productos/${producto.slug}`} className="hover:text-rosa-700">
            {producto.nombre}
          </Link>
        </h3>
        <p className="mt-auto text-base font-semibold text-rosa-700">
          {precioProducto(producto.precio, producto.precio_desde)}
        </p>
        <BotonAgregar
          tipo="producto"
          referenciaId={producto.id}
          nombre={producto.nombre}
          precio={producto.precio}
          imagen={producto.imagen_principal}
          agotado={agotado}
          variante="compacto"
        />
      </div>
    </article>
  )
}
