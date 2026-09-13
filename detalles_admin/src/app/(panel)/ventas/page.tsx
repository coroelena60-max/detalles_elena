import type { Metadata } from 'next'
import ListaPedidos from './ListaPedidos'

export const metadata: Metadata = { title: 'Ventas' }
export const dynamic = 'force-dynamic'

export default function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string }>
}) {
  return <ListaPedidos tipo="ventas" searchParams={searchParams} />
}
