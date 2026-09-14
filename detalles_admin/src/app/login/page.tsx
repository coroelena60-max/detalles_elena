import type { Metadata } from 'next'
import { destinoSeguro } from '@/lib/destinoSeguro'
import FormularioLogin from './FormularioLogin'

export const metadata: Metadata = { title: 'Entrar' }

const AVISOS: Record<string, string> = {
  inactividad: 'Tu sesión se cerró porque pasó un buen rato sin usar el panel. Volvé a entrar.',
  vencida: 'Tu sesión venció. Por seguridad hay que volver a entrar cada día.',
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string; motivo?: string }>
}) {
  const { volver, motivo } = await searchParams
  const destino = destinoSeguro(volver)

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <FormularioLogin volver={destino} aviso={motivo ? AVISOS[motivo] : undefined} />
    </div>
  )
}
