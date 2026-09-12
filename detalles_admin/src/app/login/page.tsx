import type { Metadata } from 'next'
import FormularioLogin from './FormularioLogin'

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  const { volver } = await searchParams
  const destino = volver && volver.startsWith('/') ? volver : '/'

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <FormularioLogin volver={destino} />
    </div>
  )
}
