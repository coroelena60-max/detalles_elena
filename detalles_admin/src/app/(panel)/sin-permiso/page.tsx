import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Sin permiso' }

export default async function PaginaSinPermiso({
  searchParams,
}: {
  searchParams: Promise<{ permiso?: string }>
}) {
  const { permiso } = await searchParams

  return (
    <div className="tarjeta p-6">
      <h1 className="text-base font-semibold">Esta sección no es para tu rol</h1>
      <p className="mt-2 text-sm text-tinta-suave">
        Tu cuenta no tiene el permiso que hace falta
        {permiso ? (
          <>
            {' '}
            (<code className="font-mono text-xs">{permiso}</code>)
          </>
        ) : null}
        . Si lo necesitás para trabajar, pedíselo a la administradora.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700"
      >
        Volver al tablero
      </Link>
    </div>
  )
}
