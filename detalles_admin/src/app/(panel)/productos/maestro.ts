'use server'

import { revalidatePath } from 'next/cache'
import { numeroDe, traducirError } from '@/lib/acciones'
import type { EstadoPublicacion } from '@/lib/estados'
import { clienteServidor } from '@/lib/supabase/servidor'

/**
 * Acciones del maestro que no son el producto en sí: categorías, extras,
 * recetas, envoltorios y el cotizador. Todo pasa por RLS con maestro.editar.
 */
type Resultado = { ok: boolean; mensaje: string }

function refrescarCatalogo() {
  revalidatePath('/productos/personalizado')
  revalidatePath('/inventario/extras')
}

// ===========================================================================
// Categorías
// ===========================================================================

export interface DatosCategoria {
  id?: number
  nombre: string
  descripcion: string
  orden: string
  activa: boolean
}

export async function guardarCategoria(d: DatosCategoria): Promise<Resultado> {
  if (d.nombre.trim().length < 3) return { ok: false, mensaje: 'El nombre es muy corto.' }
  const orden = d.orden.trim() === '' ? 0 : Math.trunc(numeroDe(d.orden))
  if (!Number.isFinite(orden)) return { ok: false, mensaje: 'Revisá el orden.' }

  const campos = { nombre: d.nombre.trim(), descripcion: d.descripcion.trim() || null, orden, activa: d.activa }
  const sb = await clienteServidor()
  // al crear se manda slug vacío y la base lo arma; al editar no se toca (es la URL pública)
  const { error } = d.id
    ? await sb.from('categoria').update(campos).eq('id', d.id)
    : await sb.from('categoria').insert({ ...campos, slug: '' })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/productos/categorias')
  revalidatePath('/productos')
  return { ok: true, mensaje: d.id ? 'Categoría actualizada.' : 'Categoría creada.' }
}

export async function borrarCategoria(id: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { count } = await sb.from('producto').select('id', { count: 'exact', head: true }).eq('categoria_id', id)
  if (count) {
    return {
      ok: false,
      mensaje: `Tiene ${count} producto${count === 1 ? '' : 's'}: movelos a otra categoría o desactivala.`,
    }
  }
  const { error } = await sb.from('categoria').delete().eq('id', id)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/productos/categorias')
  return { ok: true, mensaje: 'Categoría borrada.' }
}

// ===========================================================================
// Extras
// ===========================================================================

export interface DatosExtra {
  id?: number
  nombre: string
  descripcion: string
  categoriaId: number | null
  precio: string
  espacios: string
  unidad: string
  estado: EstadoPublicacion
  orden: string
  stockMinimo: string
  minutosArmado: string
}

export async function guardarExtra(d: DatosExtra): Promise<Resultado & { id?: number }> {
  if (d.nombre.trim().length < 2) return { ok: false, mensaje: 'El nombre es muy corto.' }
  const precio = numeroDe(d.precio)
  const espacios = d.espacios.trim() === '' ? 0 : numeroDe(d.espacios)
  const orden = d.orden.trim() === '' ? 0 : Math.trunc(numeroDe(d.orden))
  const minimo = d.stockMinimo.trim() === '' ? 0 : numeroDe(d.stockMinimo)
  const minutos = d.minutosArmado.trim() === '' ? null : Math.trunc(numeroDe(d.minutosArmado))
  if (!Number.isFinite(precio) || precio < 0) return { ok: false, mensaje: 'Revisá el precio.' }
  if (!Number.isFinite(espacios) || espacios < 0) return { ok: false, mensaje: 'Revisá los espacios.' }
  if (minutos !== null && (!Number.isFinite(minutos) || minutos <= 0)) {
    return { ok: false, mensaje: 'Los minutos de armado tienen que ser mayores a cero.' }
  }

  const campos = {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim() || null,
    extra_categoria_id: d.categoriaId,
    precio,
    espacios,
    unidad: d.unidad.trim() || 'unidad',
    estado: d.estado,
    orden: Number.isFinite(orden) ? orden : 0,
    stock_minimo: Number.isFinite(minimo) ? minimo : 0,
    minutos_armado: minutos,
  }

  const sb = await clienteServidor()
  if (d.id) {
    const { error } = await sb.from('extra').update(campos).eq('id', d.id)
    if (error) return { ok: false, mensaje: traducirError(error.message) }
    refrescarCatalogo()
    revalidatePath(`/productos/personalizado/extras/${d.id}`)
    return { ok: true, id: d.id, mensaje: 'Extra actualizado.' }
  }
  const { data, error } = await sb.from('extra').insert({ ...campos, slug: '' }).select('id').single()
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescarCatalogo()
  return { ok: true, id: data.id, mensaje: 'Extra creado.' }
}

export async function guardarFotoExtra(id: number, url: string | null, rutaAnterior: string | null): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.from('extra').update({ imagen_url: url }).eq('id', id)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  // si la foto vieja la subió el panel, se borra del bucket para no dejar basura
  if (rutaAnterior?.startsWith('extras/panel-')) {
    await sb.storage.from('catalogo').remove([rutaAnterior])
  }
  refrescarCatalogo()
  revalidatePath(`/productos/personalizado/extras/${id}`)
  return { ok: true, mensaje: url ? 'Foto actualizada.' : 'Foto quitada.' }
}

// ---------------------------------------------------------------------------
// Receta: qué insumos lleva cada flor
// ---------------------------------------------------------------------------

export async function guardarIngrediente(extraId: number, insumoId: number, cantidad: string): Promise<Resultado> {
  const c = numeroDe(cantidad)
  if (!insumoId) return { ok: false, mensaje: 'Elegí un insumo.' }
  if (!Number.isFinite(c) || c <= 0) return { ok: false, mensaje: 'La cantidad tiene que ser mayor a cero.' }
  const sb = await clienteServidor()
  const { error } = await sb
    .from('extra_insumo')
    .upsert({ extra_id: extraId, insumo_id: insumoId, cantidad: c }, { onConflict: 'extra_id,insumo_id' })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/productos/personalizado/extras/${extraId}`)
  refrescarCatalogo()
  return { ok: true, mensaje: 'Receta actualizada.' }
}

export async function quitarIngrediente(extraId: number, insumoId: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.from('extra_insumo').delete().eq('extra_id', extraId).eq('insumo_id', insumoId)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath(`/productos/personalizado/extras/${extraId}`)
  refrescarCatalogo()
  return { ok: true, mensaje: 'Quitado de la receta.' }
}

// ===========================================================================
// Envoltorios
// ===========================================================================

export async function guardarEnvoltorio(
  id: number,
  d: { precio: string; espacios: string; minutos: string; activo: boolean },
): Promise<Resultado> {
  const precio = numeroDe(d.precio)
  const espacios = d.espacios.trim() === '' ? null : numeroDe(d.espacios)
  const minutos = d.minutos.trim() === '' ? null : Math.trunc(numeroDe(d.minutos))
  if (!Number.isFinite(precio) || precio < 0) return { ok: false, mensaje: 'Revisá el precio.' }
  if (espacios !== null && (!Number.isFinite(espacios) || espacios <= 0)) {
    return { ok: false, mensaje: 'La capacidad tiene que ser mayor a cero.' }
  }
  if (minutos !== null && (!Number.isFinite(minutos) || minutos <= 0)) {
    return { ok: false, mensaje: 'Los minutos tienen que ser mayores a cero.' }
  }
  const sb = await clienteServidor()
  const { error } = await sb
    .from('envoltorio')
    .update({ precio_base: precio, espacios, minutos_armado: minutos, activo: d.activo })
    .eq('id', id)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescarCatalogo()
  return { ok: true, mensaje: 'Envoltorio guardado.' }
}

// ===========================================================================
// Cotizador: el mismo motor que el "armá tu ramo" del catálogo, visto por dentro
// ===========================================================================

export interface Cotizacion {
  envoltorio: string
  espacios_usados: number
  espacios_capacidad: number | null
  cabe: boolean
  costo_materiales: number
  minutos: number
  costo_mano_obra: number
  costo_total: number
  precio_sugerido: number
  detalle: { extra_id: number; nombre: string; cantidad: number; costo_unitario: number; costo_linea: number }[]
}

export async function cotizar(
  envoltorioId: number,
  extras: { extra_id: number; cantidad: number }[],
): Promise<{ ok: true; mensaje: string; dato: Cotizacion } | { ok: false; mensaje: string }> {
  if (!envoltorioId) return { ok: false, mensaje: 'Elegí un envoltorio.' }
  const sb = await clienteServidor()
  const { data, error } = await sb.rpc('costear_configuracion', {
    p_envoltorio_id: envoltorioId,
    p_extras: extras.filter((e) => e.cantidad > 0),
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  return { ok: true, mensaje: '', dato: data as unknown as Cotizacion }
}
