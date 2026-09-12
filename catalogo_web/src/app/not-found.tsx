import Link from 'next/link'

export default function NoEncontrado() {
  return (
    <div className="contenedor py-16 text-center">
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-tinta-suave">
        Puede que el producto ya no esté publicado.
      </p>
      <Link
        href="/productos"
        className="mt-6 inline-block rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white"
      >
        Ver el catálogo
      </Link>
    </div>
  )
}
