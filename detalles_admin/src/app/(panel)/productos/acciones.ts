'use server'

import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'
import { clienteServidor } from '@/lib/supabase/servidor'

type EstadoPublicacion = Database['public']['Enums']['estado_publicacion']

export type Resultado =
  | { ok: true; id: number; mensaje: string }
  | { ok: false; mensaje: string }

export interface DatosProducto {
  id?: number
  nombre: string
  descripcion: string
  categoriaId: number
  envoltorioId: number | null
  precio: number
  precioDesde: boolean
  estado: EstadoPublicacion
  destacado: boolean
  orden: number
  leadTimeDias: number | null
  minutosArmado: number | null
  stockMinimo: number
}

function validar(d: DatosProducto): string | null {
  if (d.nombre.trim().length < 3) return 'El nombre es muy corto.'
  if (!Number.isFinite(d.precio) || d.precio < 0) return 'Revisá el precio.'
  if (!d.categoriaId) return 'Elegí una categoría.'
  return null
}

/**
 * Alta y edición del producto que sale en el catálogo web.
 *
 * El `codigo` (AB-M-003) y el `slug` los genera la base: se mandan vacíos a
 * propósito y los triggers de la migración 0017 los completan. Al editar no se
 * tocan, porque el slug es la URL pública y ya circula.
 */
export async function guardarProducto(d: DatosProducto): Promise<Resultado> {
  const error = validar(d)
  if (error) return { ok: false, mensaje: error }

  const sb = await clienteServidor()

  const campos = {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim() || null,
    categoria_id: d.categoriaId,
    envoltorio_id: d.envoltorioId,
    precio: d.precio,
    precio_desde: d.precioDesde,
    estado: d.estado,
    destacado: d.destacado,
    orden: d.orden,
    lead_time_dias: d.leadTimeDias,
    minutos_armado: d.minutosArmado,
    stock_minimo: d.stockMinimo,
  }

  if (d.id) {
    const { error: e } = await sb.from('producto').update(campos).eq('id', d.id)
    if (e) return { ok: false, mensaje: e.message }
    revalidatePath('/productos')
    revalidatePath(`/productos/${d.id}`)
    return { ok: true, id: d.id, mensaje: 'Producto actualizado.' }
  }

  const { data, error: e } = await sb
    .from('producto')
    .insert({ ...campos, codigo: '', slug: '' })
    .select('id')
    .single()

  if (e) return { ok: false, mensaje: e.message }
  revalidatePath('/productos')
  return { ok: true, id: data.id, mensaje: 'Producto creado.' }
}

/**
 * Un producto no se borra si ya se vendió: los pedidos viejos lo referencian.
 * Para sacarlo del catálogo se usa estado 'inactivo'.
 */
export async function archivarProducto(id: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb
    .from('producto')
    .update({ estado: 'inactivo', destacado: false })
    .eq('id', id)
  if (error) return { ok: false, mensaje: error.message }
  revalidatePath('/productos')
  revalidatePath(`/productos/${id}`)
  return { ok: true, id, mensaje: 'El producto ya no sale en el catálogo.' }
}

// ---------------------------------------------------------------------------
// Composición: qué flores lleva el ramo
// ---------------------------------------------------------------------------

export async function guardarComposicion(
  productoId: number,
  extraId: number,
  cantidad: number,
): Promise<Resultado> {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, mensaje: 'La cantidad tiene que ser mayor a cero.' }
  }
  const sb = await clienteServidor()
  const { error } = await sb
    .from('producto_extra')
    .upsert(
      { producto_id: productoId, extra_id: extraId, cantidad },
      { onConflict: 'producto_id,extra_id' },
    )
  if (error) return { ok: false, mensaje: error.message }
  revalidatePath(`/productos/${productoId}`)
  return { ok: true, id: productoId, mensaje: 'Composición actualizada.' }
}

export async function quitarDeComposicion(
  productoId: number,
  extraId: number,
): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb
    .from('producto_extra')
    .delete()
    .eq('producto_id', productoId)
    .eq('extra_id', extraId)
  if (error) return { ok: false, mensaje: error.message }
  revalidatePath(`/productos/${productoId}`)
  return { ok: true, id: productoId, mensaje: 'Se quitó del ramo.' }
}

// ---------------------------------------------------------------------------
// Fotos. El archivo lo sube el navegador directo al Storage; acá solo se
// registra la fila y se mantiene el orden.
// ---------------------------------------------------------------------------

export async function registrarFoto(
  productoId: number,
  storagePath: string,
  url: string,
  alt: string,
): Promise<Resultado> {
  const sb = await clienteServidor()

  const { count } = await sb
    .from('producto_imagen')
    .select('id', { count: 'exact', head: true })
    .eq('producto_id', productoId)

  const { error } = await sb.from('producto_imagen').insert({
    producto_id: productoId,
    storage_path: storagePath,
    url,
    alt: alt.trim() || null,
    orden: (count ?? 0) + 1,
    // la primera foto que se sube queda como principal
    es_principal: (count ?? 0) === 0,
  })

  if (error) return { ok: false, mensaje: error.message }
  revalidatePath(`/productos/${productoId}`)
  revalidatePath('/productos')
  return { ok: true, id: productoId, mensaje: 'Foto agregada.' }
}

export async function marcarFotoPrincipal(
  productoId: number,
  imagenId: number,
): Promise<Resultado> {
  const sb = await clienteServidor()
  // el trigger de la 0017 desmarca sola la anterior
  const { error } = await sb
    .from('producto_imagen')
    .update({ es_principal: true })
    .eq('id', imagenId)
  if (error) return { ok: false, mensaje: error.message }
  revalidatePath(`/productos/${productoId}`)
  revalidatePath('/productos')
  return { ok: true, id: productoId, mensaje: 'Foto principal cambiada.' }
}

export async function borrarFoto(
  productoId: number,
  imagenId: number,
  storagePath: string | null,
): Promise<Resultado> {
  const sb = await clienteServidor()

  const { error } = await sb.from('producto_imagen').delete().eq('id', imagenId)
  if (error) return { ok: false, mensaje: error.message }

  // si la fila tenía archivo propio, se borra también del bucket
  if (storagePath) {
    await sb.storage.from('catalogo').remove([storagePath])
  }

  revalidatePath(`/productos/${productoId}`)
  revalidatePath('/productos')
  return { ok: true, id: productoId, mensaje: 'Foto borrada.' }
}
