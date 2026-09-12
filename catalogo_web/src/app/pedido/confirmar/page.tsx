import type { Metadata } from 'next'
import { obtenerZonasEnvio } from '@/lib/consultas'
import type { ZonaEnvio } from '@/types/database'
import FormularioPedido from './FormularioPedido'

export const metadata: Metadata = { title: 'Confirmar el pedido' }

export default async function PaginaConfirmar() {
  let zonas: ZonaEnvio[] = []
  try {
    zonas = await obtenerZonasEnvio()
  } catch {
    zonas = []
  }
  return <FormularioPedido zonas={zonas} />
}
