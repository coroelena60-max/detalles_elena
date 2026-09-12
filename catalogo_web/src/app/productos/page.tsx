import Link from 'next/link'
import type { Metadata } from 'next'
import AvisoError from '@/components/AvisoError'
import TarjetaProducto from '@/components/TarjetaProducto'
import { obtenerCategorias, obtenerProductos } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Productos' }
export const revalidate = 300

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams

  let categorias, productos
  try {
    ;[categorias, productos] = await Promise.all([
      obtenerCategorias(),
      obtenerProductos(categoria),
    ])
  } catch (e) {
    return (
      <div className="contenedor py-10">
        <AvisoError detalle={e instanceof Error ? e.message : undefined} />
      </div>
    )
  }

  const actual = categorias.find((c) => c.slug === categoria)

  return (
    <div className="contenedor py-8">
      <h1 className="text-2xl font-semibold">
        {actual ? actual.nombre : 'Todos los productos'}
      </h1>
      {actual?.descripcion && (
        <p className="mt-2 text-sm text-tinta-suave">{actual.descripcion}</p>
      )}

      <nav aria-label="Filtrar por categoría" className="mt-5">
        <ul className="flex gap-2 overflow-x-auto pb-2">
          <li>
            <Link
              href="/productos"
              aria-current={!categoria ? 'page' : undefined}
              className={`inline-block whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                !categoria
                  ? 'bg-rosa-500 font-medium text-white'
                  : 'border border-rosa-200 bg-white text-tinta-suave hover:border-rosa-300'
              }`}
            >
              Todos
            </Link>
          </li>
          {categorias.map((c) => (
            <li key={c.id}>
              <Link
                href={`/productos?categoria=${c.slug}`}
                aria-current={categoria === c.slug ? 'page' : undefined}
                className={`inline-block whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                  categoria === c.slug
                    ? 'bg-rosa-500 font-medium text-white'
                    : 'border border-rosa-200 bg-white text-tinta-suave hover:border-rosa-300'
                }`}
              >
                {c.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {productos.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-rosa-200 bg-white p-6 text-sm text-tinta-suave">
          Todavía no hay productos publicados en esta categoría.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {productos.map((p, i) => (
            <TarjetaProducto key={p.id} producto={p} prioridad={i < 4} />
          ))}
        </div>
      )}
    </div>
  )
}
