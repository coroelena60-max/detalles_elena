'use server'

import { revalidatePath } from 'next/cache'
import { numeroDe, traducirError } from '@/lib/acciones'
import type { UnidadMedida } from '@/lib/estados'
import { esFechaValida } from '@/lib/fechas'
import { clienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: boolean; mensaje: string }

function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ===========================================================================
// Proveedores
// ===========================================================================

export interface DatosProveedor {
  id?: number
  nombre: string
  telefono: string
  email: string
  direccion: string
  notas: string
  activo: boolean
}

export async function guardarProveedor(d: DatosProveedor): Promise<Resultado> {
  if (d.nombre.trim().length < 2) return { ok: false, mensaje: 'El nombre es muy corto.' }
  const campos = {
    nombre: d.nombre.trim(),
    telefono: d.telefono.replace(/\D/g, '') || null,
    email: d.email.trim() || null,
    direccion: d.direccion.trim() || null,
    notas: d.notas.trim() || null,
    activo: d.activo,
  }
  const sb = await clienteServidor()
  const { error } = d.id
    ? await sb.from('proveedor').update(campos).eq('id', d.id)
    : await sb.from('proveedor').insert(campos)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/compras/proveedores')
  return { ok: true, mensaje: d.id ? 'Proveedor actualizado.' : 'Proveedor agregado.' }
}

// ===========================================================================
// Insumos
// ===========================================================================

export interface DatosInsumo {
  id?: number
  nombre: string
  descripcion: string
  unidad: UnidadMedida
  costo: string
  minimo: string
  proveedorId: number | null
  activo: boolean
}

export async function guardarInsumo(
  d: DatosInsumo,
): Promise<Resultado & { id?: number }> {
  if (d.nombre.trim().length < 2) return { ok: false, mensaje: 'El nombre es muy corto.' }
  const costo = d.costo.trim() === '' ? 0 : numeroDe(d.costo)
  const minimo = d.minimo.trim() === '' ? 0 : numeroDe(d.minimo)
  if (!Number.isFinite(costo) || costo < 0) return { ok: false, mensaje: 'Revisá el costo.' }
  if (!Number.isFinite(minimo) || minimo < 0) return { ok: false, mensaje: 'Revisá el stock mínimo.' }

  const campos = {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim() || null,
    unidad: d.unidad,
    costo_unitario: costo,
    stock_minimo: minimo,
    proveedor_id: d.proveedorId,
    activo: d.activo,
  }
  const sb = await clienteServidor()

  if (d.id) {
    const { error } = await sb.from('insumo').update(campos).eq('id', d.id)
    if (error) return { ok: false, mensaje: traducirError(error.message) }
    revalidatePath('/compras/insumos')
    revalidatePath(`/compras/insumos/${d.id}`)
    return { ok: true, id: d.id, mensaje: 'Insumo actualizado.' }
  }

  // el slug de insumo no tiene trigger: se arma acá y se desambigua si choca
  const base = slugificar(campos.nombre) || 'insumo'
  let slug = base
  for (let n = 2; n < 50; n++) {
    const { count } = await sb.from('insumo').select('id', { count: 'exact', head: true }).eq('slug', slug)
    if (!count) break
    slug = `${base}-${n}`
  }

  const { data, error } = await sb.from('insumo').insert({ ...campos, slug }).select('id').single()
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/compras/insumos')
  return { ok: true, id: data.id, mensaje: 'Insumo agregado.' }
}

// ===========================================================================
// Compras
//   borrador → se cargan insumos → recibir (entra al stock y ajusta costos)
// ===========================================================================

export interface DatosCompra {
  proveedorId: number | null
  fecha: string
  documento: string
  nota: string
}

export async function crearCompra(d: DatosCompra): Promise<Resultado & { codigo?: string }> {
  if (!esFechaValida(d.fecha)) return { ok: false, mensaje: 'Revisá la fecha.' }
  const sb = await clienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { data, error } = await sb
    .from('compra')
    .insert({
      proveedor_id: d.proveedorId,
      fecha: d.fecha,
      documento: d.documento.trim() || null,
      nota: d.nota.trim() || null,
      registrado_por: user?.id ?? null,
    })
    .select('codigo')
    .single()
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/compras')
  return { ok: true, codigo: data.codigo ?? undefined, mensaje: 'Compra creada. Cargá los insumos.' }
}

export async function actualizarCabecera(
  compraId: number,
  codigo: string,
  d: DatosCompra & { descuento: string },
): Promise<Resultado> {
  if (!esFechaValida(d.fecha)) return { ok: false, mensaje: 'Revisá la fecha.' }
  const descuento = d.descuento.trim() === '' ? 0 : numeroDe(d.descuento)
  if (!Number.isFinite(descuento) || descuento < 0) return { ok: false, mensaje: 'Revisá el descuento.' }

  const sb = await clienteServidor()
  const { error } = await sb
    .from('compra')
    .update({
      proveedor_id: d.proveedorId,
      fecha: d.fecha,
      documento: d.documento.trim() || null,
      nota: d.nota.trim() || null,
      descuento,
    })
    .eq('id', compraId)
    .eq('estado', 'borrador')
  if (error) return { ok: false, mensaje: traducirError(error.message) }

  // el total lo recalcula la base con el descuento nuevo
  await sb.rpc('recalcular_compra', { p_compra_id: compraId })
  revalidatePath(`/compras/${codigo}`)
  revalidatePath('/compras')
  return { ok: true, mensaje: 'Datos de la compra guardados.' }
}

export async function agregarItem(
  compraId: number,
  codigo: string,
  insumoId: number,
  cantidad: string,
  costo: string,
): Promise<Resultado> {
  const c = numeroDe(cantidad)
  const u = numeroDe(costo)
  if (!insumoId) return { ok: false, mensaje: 'Elegí un insumo.' }
  if (!Number.isFinite(c) || c <= 0) return { ok: false, mensaje: 'La cantidad tiene que ser mayor a cero.' }
  if (!Number.isFinite(u) || u < 0) return { ok: false, mensaje: 'Revisá el costo.' }

  const sb = await clienteServidor()
  const { error } = await sb
    .from('compra_item')
    .insert({ compra_id: compraId, insumo_id: insumoId, cantidad: c, costo_unitario: u })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/compras/${codigo}`)
  return { ok: true, mensaje: 'Insumo agregado a la compra.' }
}

export async function quitarItem(itemId: number, codigo: string): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.from('compra_item').delete().eq('id', itemId)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/compras/${codigo}`)
  return { ok: true, mensaje: 'Quitado.' }
}

export async function recibirCompra(compraId: number, codigo: string): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.rpc('recibir_compra', { p_compra_id: compraId })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/compras/${codigo}`)
  revalidatePath('/compras')
  revalidatePath('/compras/insumos')
  revalidatePath('/inventario/movimientos')
  return { ok: true, mensaje: 'Compra recibida: los insumos entraron al stock y se actualizó su costo.' }
}

export async function anularCompra(compraId: number, codigo: string, motivo: string): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.rpc('anular_compra', { p_compra_id: compraId, p_motivo: motivo })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/compras/${codigo}`)
  revalidatePath('/compras')
  return { ok: true, mensaje: 'Compra anulada.' }
}
