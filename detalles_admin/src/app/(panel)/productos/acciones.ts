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

  const { data: actuales } = await sb
    .from('producto_imagen')
    .select('orden, es_principal')
    .eq('producto_id', productoId)
  const lista = actuales ?? []

  const { error } = await sb.from('producto_imagen').insert({
    producto_id: productoId,
    storage_path: storagePath,
    url,
    alt: alt.trim() || null,
    orden: Math.max(0, ...lista.map((f) => f.orden)) + 1,
    // si el producto no tiene foto principal, la nueva pasa a serlo
    es_principal: !lista.some((f) => f.es_principal),
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
  const { data, error } = await sb
    .from('producto_imagen')
    .update({ es_principal: true })
    .eq('id', imagenId)
    .eq('producto_id', productoId)
    .select('id')
  if (error) return { ok: false, mensaje: error.message }
  // RLS no da error: si no tiene permiso simplemente no actualiza ninguna fila
  if (!data?.length) {
    return { ok: false, mensaje: 'No se pudo cambiar la foto principal (¿ya no existe o falta permiso?).' }
  }
  revalidatePath(`/productos/${productoId}`)
  revalidatePath('/productos')
  return { ok: true, id: productoId, mensaje: 'Foto principal cambiada.' }
}

export async function borrarFoto(
  productoId: number,
  imagenId: number,
): Promise<Resultado> {
  const sb = await clienteServidor()

  // la ruta del archivo sale de la fila borrada, no del navegador: así no se
  // puede borrar del bucket un archivo que no sea de esta foto
  const { data: borradas, error } = await sb
    .from('producto_imagen')
    .delete()
    .eq('id', imagenId)
    .eq('producto_id', productoId)
    .select('storage_path, es_principal')
  if (error) return { ok: false, mensaje: error.message }
  const borrada = borradas?.[0]
  if (!borrada) {
    return { ok: false, mensaje: 'No se pudo borrar la foto (¿ya no existe o falta permiso?).' }
  }

  // si era la principal, la siguiente en orden toma su lugar
  if (borrada.es_principal) {
    const { data: siguiente } = await sb
      .from('producto_imagen')
      .select('id')
      .eq('producto_id', productoId)
      .order('orden')
      .order('id')
      .limit(1)
      .maybeSingle()
    if (siguiente) {
      await sb.from('producto_imagen').update({ es_principal: true }).eq('id', siguiente.id)
    }
  }

  revalidatePath(`/productos/${productoId}`)
  revalidatePath('/productos')

  if (borrada.storage_path) {
    const { error: errorBucket } = await sb.storage
      .from('catalogo')
      .remove([borrada.storage_path])
    if (errorBucket) {
      return {
        ok: false,
        mensaje: `La foto se quitó del producto, pero el archivo quedó en el almacenamiento: ${errorBucket.message}`,
      }
    }
  }

  return { ok: true, id: productoId, mensaje: 'Foto borrada.' }
}
