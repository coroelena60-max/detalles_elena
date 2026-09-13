'use server'

import { clienteServidor } from '@/lib/supabase/server'
import type { ItemPedidoRpc, RespuestaCrearPedido } from '@/types/database'

export interface ItemFormulario {
  tipo: 'producto' | 'extra' | 'personalizado'
  /** id del producto, del extra o del envoltorio según el tipo */
  referenciaId: number
  cantidad: number
  dedicatoria?: string
  /** solo en líneas personalizadas */
  extras?: { extraId: number; cantidad: number }[]
}

export interface DatosPedido {
  nombre: string
  telefono: string
  email?: string
  tipoEntrega: 'recojo_tienda' | 'envio'
  // solo si es envío
  direccion?: string
  referencia?: string
  destinatario?: string
  telefonoEntrega?: string
  zonaEnvioId?: number | null
  fechaEntrega?: string
  instrucciones?: string
  nota?: string
  /** casilla de términos y privacidad (consentimiento del DS 1793, art. 56) */
  aceptaCondiciones: boolean
  items: ItemFormulario[]
}

export type ResultadoPedido =
  | { ok: true; codigo: string; total: number }
  | { ok: false; mensaje: string }

const soloDigitos = (v: string) => v.replace(/[^0-9]/g, '')

/**
 * Crea el pedido llamando a la función crear_pedido() de la base.
 * Acá NO se calculan montos: la base recalcula todo desde sus propios precios.
 */
export async function crearPedido(datos: DatosPedido): Promise<ResultadoPedido> {
  const nombre = datos.nombre?.trim() ?? ''
  const telefono = soloDigitos(datos.telefono ?? '')

  if (nombre.length < 2) {
    return { ok: false, mensaje: 'Escribí tu nombre completo.' }
  }
  if (telefono.length < 7 || telefono.length > 15) {
    return { ok: false, mensaje: 'Revisá tu número de WhatsApp.' }
  }
  if (datos.aceptaCondiciones !== true) {
    return {
      ok: false,
      mensaje: 'Para confirmar, aceptá los términos y la política de privacidad.',
    }
  }
  if (!Array.isArray(datos.items) || datos.items.length === 0) {
    return { ok: false, mensaje: 'Tu pedido está vacío.' }
  }
  if (datos.items.length > 50) {
    return { ok: false, mensaje: 'Demasiados artículos en un solo pedido.' }
  }
  if (
    datos.items.some(
      (i) => i.tipo === 'personalizado' && (i.extras ?? []).length === 0,
    )
  ) {
    return { ok: false, mensaje: 'Tu ramo armado quedó sin flores ni detalles.' }
  }
  if (
    datos.tipoEntrega === 'envio' &&
    (datos.direccion ?? '').trim().length < 5
  ) {
    return { ok: false, mensaje: 'Para envío necesitamos la dirección.' }
  }

  const referencia = (i: ItemFormulario) => {
    if (i.tipo === 'producto') return { producto_id: i.referenciaId }
    if (i.tipo === 'extra') return { extra_id: i.referenciaId }
    return { envoltorio_id: i.referenciaId }
  }

  const items: ItemPedidoRpc[] = datos.items.map((i) => ({
    tipo: i.tipo,
    ...referencia(i),
    cantidad: Math.max(1, Math.min(99, Math.trunc(i.cantidad))),
    ...(i.dedicatoria ? { dedicatoria: i.dedicatoria.slice(0, 300) } : {}),
    // el ramo armado manda solo ids y cantidades: los precios y la regla de
    // espacios los resuelve crear_pedido()
    ...(i.extras && i.extras.length > 0
      ? {
          extras: i.extras.map((e) => ({
            extra_id: e.extraId,
            cantidad: Math.max(1, Math.min(200, Math.trunc(e.cantidad))),
          })),
        }
      : {}),
  }))

  const entrega =
    datos.tipoEntrega === 'envio'
      ? {
          tipo: 'envio',
          direccion: datos.direccion?.trim(),
          referencia: datos.referencia?.trim() || null,
          destinatario: datos.destinatario?.trim() || null,
          telefono: datos.telefonoEntrega ? soloDigitos(datos.telefonoEntrega) : null,
          zona_envio_id: datos.zonaEnvioId ? String(datos.zonaEnvioId) : null,
          fecha_entrega: datos.fechaEntrega || null,
          instrucciones: datos.instrucciones?.trim() || null,
        }
      : { tipo: 'recojo_tienda' }

  const sb = clienteServidor()
  const { data, error } = await sb.rpc('crear_pedido', {
    p_cliente: { nombre, telefono, email: datos.email?.trim() || null },
    p_items: items,
    p_entrega: entrega,
    p_nota: datos.nota?.trim() || null,
  })

  if (error) {
    return {
      ok: false,
      mensaje:
        error.message ||
        'No pudimos registrar el pedido. Probá de nuevo en un momento.',
    }
  }

  const pedido = data as RespuestaCrearPedido | null
  if (!pedido?.codigo) {
    return { ok: false, mensaje: 'La base no devolvió el código del pedido.' }
  }

  return { ok: true, codigo: pedido.codigo, total: Number(pedido.total) }
}

/** Marca que el cliente efectivamente abrió WhatsApp (métrica de conversión). */
export async function marcarEnviadoWhatsapp(codigo: string): Promise<void> {
  const sb = clienteServidor()
  await sb.rpc('marcar_pedido_enviado_whatsapp', { p_codigo: codigo })
}
