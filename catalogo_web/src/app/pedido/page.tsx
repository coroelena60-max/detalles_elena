import type { Metadata } from 'next'
import VistaCarrito from './VistaCarrito'

export const metadata: Metadata = { title: 'Mi pedido' }

export default function PaginaPedido() {
  return <VistaCarrito />
}
