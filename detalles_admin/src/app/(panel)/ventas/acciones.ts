'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoPedido, MetodoPago } from '@/lib/estados'
import { traducirError } from '@/lib/acciones'
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
  revalidatePath(`/pedidos/${codigo}`)
  revalidatePath('/pedidos')
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
  revalidatePath(`/pedidos/${codigo}`)
  revalidatePath('/pedidos')
  revalidatePath('/ventas')
  revalidatePath('/')
  return { ok: true, mensaje: 'Pago registrado.' }
}

// ---------------------------------------------------------------------------
// Venta de mostrador: misma función de la base que el catálogo (los precios
// los pone la base), pero nace confirmada y con canal "mostrador".
// ---------------------------------------------------------------------------

export interface LineaMostrador {
  tipo: 'producto' | 'extra' | 'personalizado' | 'cotizacion'
  /** producto_id, extra_id, envoltorio_id (ramo personalizado) o cotizacion_id */
  id: number
  cantidad: number
  dedicatoria?: string
  extras?: { extra_id: number; cantidad: number }[]
}

export async function crearVentaMostrador(
  cliente: { nombre: string; telefono: string; email: string } | null,
  lineas: LineaMostrador[],
  nota: string,
): Promise<Resultado & { codigo?: string }> {
  // null = venta sin cliente: la base la cuelga del cliente genérico S/N
  const telefono = cliente?.telefono.replace(/\D/g, '') ?? ''
  if (cliente) {
    if (cliente.nombre.trim().length < 2) return { ok: false, mensaje: 'Escribí el nombre del cliente.' }
    if (telefono.length < 7 || telefono.length > 15) {
      return { ok: false, mensaje: 'El teléfono tiene que tener entre 7 y 15 dígitos.' }
    }
  }
  const items = lineas
    .filter((l) => l.cantidad > 0)
    .map((l) => {
      const dedicatoria = l.dedicatoria?.trim() || undefined
      if (l.tipo === 'producto') return { tipo: 'producto', producto_id: l.id, cantidad: l.cantidad, dedicatoria }
      if (l.tipo === 'cotizacion') return { tipo: 'cotizacion', cotizacion_id: l.id, cantidad: l.cantidad, dedicatoria }
      if (l.tipo === 'personalizado') {
        return {
          tipo: 'personalizado',
          envoltorio_id: l.id,
          cantidad: l.cantidad,
          dedicatoria,
          extras: (l.extras ?? []).filter((e) => e.cantidad > 0),
        }
      }
      return { tipo: 'extra', extra_id: l.id, cantidad: l.cantidad }
    })
  if (items.length === 0) return { ok: false, mensaje: 'Agregá al menos un producto o extra.' }

  const sb = await clienteServidor()
  const { data, error } = await sb.rpc('crear_venta_mostrador', {
    p_cliente: cliente
      ? { nombre: cliente.nombre.trim(), telefono, email: cliente.email.trim() || undefined }
      : { sin_cliente: true },
    p_items: items,
    p_nota: nota.trim() || undefined,
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }

  const codigo = (data as { codigo?: string } | null)?.codigo
  revalidatePath('/ventas')
  revalidatePath('/')
  return { ok: true, codigo, mensaje: `Venta ${codigo ?? ''} registrada.` }
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export async function guardarCliente(
  id: number,
  d: { nombre: string; telefono: string; email: string; notas: string },
): Promise<Resultado> {
  if (d.nombre.trim().length < 2) return { ok: false, mensaje: 'El nombre es muy corto.' }
  const telefono = d.telefono.replace(/\D/g, '')
  const sb = await clienteServidor()
  const { error } = await sb
    .from('cliente')
    .update({ nombre: d.nombre.trim(), telefono, email: d.email.trim() || null, notas: d.notas.trim() || null })
    .eq('id', id)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/ventas/clientes')
  revalidatePath(`/ventas/clientes/${id}`)
  return { ok: true, mensaje: 'Cliente actualizado.' }
}
