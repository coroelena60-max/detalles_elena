'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoPedido, MetodoPago } from '@/lib/estados'
import { clienteServidor } from '@/lib/supabase/servidor'

export type Resultado = { ok: boolean; mensaje: string }

/**
 * Las dos acciones pasan por funciones de la base (cambiar_estado_pedido y
 * registrar_pago): ahí viven las reglas —descuento de inventario al entregar,
 * bitácora, cálculo del saldo— y ahí se revisan los permisos vía RLS.
 * El panel no escribe montos ni estados a mano.
 */

export async function cambiarEstado(
  codigo: string,
  pedidoId: number,
  estado: EstadoPedido,
  nota?: string,
): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.rpc('cambiar_estado_pedido', {
    p_pedido_id: pedidoId,
    p_estado: estado,
    p_nota: nota?.trim() || undefined,
  })

  if (error) {
    return { ok: false, mensaje: error.message }
  }

  revalidatePath(`/ventas/${codigo}`)
  revalidatePath('/ventas')
  revalidatePath('/')
  return { ok: true, mensaje: 'Estado actualizado.' }
}

export async function registrarPago(
  codigo: string,
  pedidoId: number,
  monto: number,
  metodo: MetodoPago,
  referencia?: string,
): Promise<Resultado> {
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: 'El monto tiene que ser mayor a cero.' }
  }

  const sb = await clienteServidor()
  const { error } = await sb.rpc('registrar_pago', {
    p_pedido_id: pedidoId,
    p_monto: monto,
    p_metodo: metodo,
    p_referencia: referencia?.trim() || undefined,
  })

  if (error) {
    return { ok: false, mensaje: error.message }
  }

  revalidatePath(`/ventas/${codigo}`)
  revalidatePath('/ventas')
  revalidatePath('/')
  return { ok: true, mensaje: 'Pago registrado.' }
}
