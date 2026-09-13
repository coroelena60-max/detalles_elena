import type { Metadata } from 'next'
import ListaPedidos from '../ventas/ListaPedidos'

export const metadata: Metadata = { title: 'Pedidos' }
export const dynamic = 'force-dynamic'

export default function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string }>
}) {
  return <ListaPedidos tipo="pedidos" searchParams={searchParams} />
}
