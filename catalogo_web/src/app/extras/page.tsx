import type { Metadata } from 'next'
import AvisoError from '@/components/AvisoError'
import TarjetaExtra from '@/components/TarjetaExtra'
import { obtenerCategoriasExtra, obtenerExtras } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Flores y extras' }
export const revalidate = 300

export default async function PaginaExtras() {
  let extras, categorias
  try {
    ;[extras, categorias] = await Promise.all([
      obtenerExtras(),
      obtenerCategoriasExtra(),
    ])
  } catch (e) {
    return (
      <div className="contenedor py-10">
        <AvisoError detalle={e instanceof Error ? e.message : undefined} />
      </div>
    )
  }

  const visibles = extras.filter((x) => x.estado !== 'borrador')
  const grupos = categorias
    .map((c) => ({
      categoria: c,
      items: visibles.filter((x) => x.extra_categoria_id === c.id),
    }))
    .filter((g) => g.items.length > 0)

  const sinCategoria = visibles.filter((x) => x.extra_categoria_id === null)

  return (
    <div className="contenedor py-8">
      <h1 className="text-2xl font-semibold">Flores y extras</h1>
      <p className="mt-2 max-w-2xl text-sm text-tinta-suave">
        Todas las flores están hechas a mano, una por una. Podés pedirlas por unidad
        o sumarlas a cualquier ramo del catálogo.
      </p>

      {grupos.map((g) => (
        <section key={g.categoria.id} className="mt-8">
          <h2 className="text-lg font-semibold">{g.categoria.nombre}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((x) => (
              <TarjetaExtra key={x.id} extra={x} />
            ))}
          </div>
        </section>
      ))}

      {sinCategoria.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Otros</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sinCategoria.map((x) => (
              <TarjetaExtra key={x.id} extra={x} />
            ))}
          </div>
        </section>
      )}

      {visibles.length === 0 && (
        <p className="mt-10 rounded-2xl border border-rosa-200 bg-white p-6 text-sm text-tinta-suave">
          Todavía no hay extras publicados.
        </p>
      )}
    </div>
  )
}
