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

/**
 * Devolver un cobro (migración 0027): el cobro queda a la vista marcado como
 * devuelto, con quién y por qué, y deja de sumar en lo cobrado. No se deshace.
 */
export async function devolverCobro(codigo: string, pagoId: number, motivo: string): Promise<Resultado> {
  if (motivo.trim().length < 3) return { ok: false, mensaje: 'Escribí por qué se devuelve.' }
  const sb = await clienteServidor()
  const { error } = await sb.rpc('devolver_cobro', { p_pago_id: pagoId, p_motivo: motivo.trim() })
  if (error) return { ok: false, mensaje: traducirError(error.message) }

  revalidatePath(`/ventas/${codigo}`)
  revalidatePath(`/pedidos/${codigo}`)
  revalidatePath('/ventas')
  revalidatePath('/pedidos')
  revalidatePath('/')
  return { ok: true, mensaje: 'Cobro devuelto.' }
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
  /** precio por unidad si se rebajó o se cobró de más; vacío = el de lista */
  precio?: number | null
  /** lo que se agrega escrito a mano (un globo, un chocolate): suma al precio */
  extrasLibres?: ExtraLibre[]
}

/** `type` y no `interface`: así se le puede pasar tal cual a la base como jsonb. */
export type ExtraLibre = {
  nombre: string
  precio: number
}

/**
 * Precio y extras escritos a mano. La base los vuelve a revisar (y es la que
 * manda), pero conviene frenar acá para avisar en lenguaje de tienda.
 */
function revisarAjuste(precio: number | null | undefined, extras: ExtraLibre[]): string | null {
  if (precio !== null && precio !== undefined) {
    if (!Number.isFinite(precio) || precio < 0) return 'Revisá el precio: tiene que ser un número de 0 para arriba.'
    if (precio > 100000) return 'Ese precio es demasiado alto. Revisalo.'
  }
  if (extras.length > 10) return 'Son demasiados extras para una sola línea.'
  for (const e of extras) {
    const nombre = e.nombre.trim()
    if (nombre.length < 2 || nombre.length > 80) return 'Escribí qué es el extra (entre 2 y 80 letras).'
    if (!Number.isFinite(e.precio) || e.precio < 0) return `Revisá el precio de "${nombre}".`
    if (e.precio > 100000) return `El precio de "${nombre}" es demasiado alto.`
  }
  return null
}

/** Los extras escritos a mano que de verdad tienen algo escrito. */
function limpiarExtras(extras: ExtraLibre[] | null | undefined): ExtraLibre[] {
  return (extras ?? [])
    .filter((e) => e.nombre.trim() !== '')
    .map((e) => ({ nombre: e.nombre.trim(), precio: e.precio }))
}

/**
 * Cambiar el precio de una línea de una venta o de un pedido ya registrado, y
 * sus extras escritos a mano. La base pide el permiso que corresponde al canal
 * (venta.editar o pedido.editar), no deja tocar lo entregado y deja bitácora.
 */
export async function ajustarPrecioItem(
  codigo: string,
  itemId: number,
  precio: number | null,
  extras: ExtraLibre[] | null,
): Promise<Resultado> {
  const limpios = limpiarExtras(extras)
  const problema = revisarAjuste(precio, limpios)
  if (problema) return { ok: false, mensaje: problema }

  const sb = await clienteServidor()
  const { error } = await sb.rpc('ajustar_item_venta', {
    p_item_id: itemId,
    p_precio: precio ?? undefined,
    // null no alcanza: la base distingue "no toques los extras" de "dejalos en ninguno"
    p_extras: extras === null ? undefined : limpios,
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }

  revalidatePath(`/ventas/${codigo}`)
  revalidatePath(`/pedidos/${codigo}`)
  revalidatePath('/ventas')
  revalidatePath('/pedidos')
  revalidatePath('/')
  return { ok: true, mensaje: 'Precio actualizado.' }
}

export async function crearVentaMostrador(
  cliente: { nombre: string; telefono: string; email: string } | null,
  lineas: LineaMostrador[],
  nota: string,
): Promise<Resultado & { codigo?: string; id?: number; total?: number }> {
  // null = venta sin cliente: la base la cuelga del cliente genérico S/N
  const telefono = cliente?.telefono.replace(/\D/g, '') ?? ''
  if (cliente) {
    if (cliente.nombre.trim().length < 2) return { ok: false, mensaje: 'Escribí el nombre del cliente.' }
    if (telefono.length < 7 || telefono.length > 15) {
      return { ok: false, mensaje: 'El teléfono tiene que tener entre 7 y 15 dígitos.' }
    }
  }
  const enJuego = lineas.filter((l) => l.cantidad > 0)
  for (const l of enJuego) {
    const problema = revisarAjuste(l.precio, limpiarExtras(l.extrasLibres))
    if (problema) return { ok: false, mensaje: problema }
  }

  const items = enJuego.map((l) => {
    const dedicatoria = l.dedicatoria?.trim() || undefined
    // lo que la vendedora cambió a mano; sin esto, la base cobra el precio de lista
    const libres = limpiarExtras(l.extrasLibres)
    const ajuste = {
      ...(typeof l.precio === 'number' ? { precio_unitario: l.precio } : {}),
      ...(libres.length > 0 ? { extras_libres: libres } : {}),
    }
    if (l.tipo === 'producto') {
      return { tipo: 'producto', producto_id: l.id, cantidad: l.cantidad, dedicatoria, ...ajuste }
    }
    if (l.tipo === 'cotizacion') {
      return { tipo: 'cotizacion', cotizacion_id: l.id, cantidad: l.cantidad, dedicatoria, ...ajuste }
    }
    if (l.tipo === 'personalizado') {
      return {
        tipo: 'personalizado',
        envoltorio_id: l.id,
        cantidad: l.cantidad,
        dedicatoria,
        extras: (l.extras ?? []).filter((e) => e.cantidad > 0),
        ...ajuste,
      }
    }
    return { tipo: 'extra', extra_id: l.id, cantidad: l.cantidad, ...ajuste }
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

  const venta = data as { id?: number; codigo?: string; total?: number } | null
  const codigo = venta?.codigo
  revalidatePath('/ventas')
  revalidatePath('/')
  return { ok: true, codigo, id: venta?.id, total: venta?.total, mensaje: `Venta ${codigo ?? ''} registrada.` }
}

/**
 * La venta de mostrador de un solo botón: registra la venta y, según lo que se
 * eligió, cobra el total y la da por entregada. Son las mismas tres funciones
 * de la base de siempre, una detrás de otra (el total lo pone la base, no el
 * navegador). Si falla un paso después de crear la venta, la venta queda
 * hecha y se avisa qué faltó, para terminarlo desde su ficha.
 */
export async function venderEnMostrador(
  cliente: { nombre: string; telefono: string; email: string } | null,
  lineas: LineaMostrador[],
  nota: string,
  opciones: { metodo: MetodoPago | null; entregar: boolean },
): Promise<Resultado & { codigo?: string; total?: number }> {
  const creada = await crearVentaMostrador(cliente, lineas, nota)
  if (!creada.ok || !creada.id || !creada.codigo) return creada

  const { codigo, id, total } = creada
  const sb = await clienteServidor()
  const faltas: string[] = []

  if (opciones.metodo && Number(total) > 0) {
    const { error } = await sb.rpc('registrar_pago', {
      p_pedido_id: id,
      p_monto: Number(total),
      p_metodo: opciones.metodo,
    })
    if (error) faltas.push(`no se pudo anotar el cobro (${traducirError(error.message)})`)
  }

  if (opciones.entregar) {
    const { error } = await sb.rpc('cambiar_estado_pedido', { p_pedido_id: id, p_estado: 'entregado' })
    if (error) faltas.push(`no se pudo marcar como entregada (${traducirError(error.message)})`)
  }

  revalidatePath('/ventas')
  revalidatePath(`/ventas/${codigo}`)
  revalidatePath('/')
  if (faltas.length > 0) {
    return { ok: false, codigo, total, mensaje: `La venta ${codigo} quedó registrada, pero ${faltas.join(' y ')}. Abrila para terminar.` }
  }
  return { ok: true, codigo, total, mensaje: `Venta ${codigo} registrada.` }
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

// ---------------------------------------------------------------------------
// Agenda: el día en que el pedido tiene que estar listo
// ---------------------------------------------------------------------------

export async function programarPedido(codigo: string, pedidoId: number, fecha: string | null): Promise<Resultado> {
  if (fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, mensaje: 'Revisá la fecha.' }
  const sb = await clienteServidor()
  const { error } = await sb.rpc('programar_pedido', { p_pedido_id: pedidoId, p_fecha: fecha as string })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/ventas/${codigo}`)
  revalidatePath(`/pedidos/${codigo}`)
  revalidatePath('/pedidos/agenda')
  return { ok: true, mensaje: fecha ? 'Fecha guardada.' : 'Quitado de la agenda.' }
}
