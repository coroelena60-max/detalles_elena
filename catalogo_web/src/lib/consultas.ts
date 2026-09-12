import { clienteServidor } from '@/lib/supabase/server'
import type {
  CatalogoProducto,
  Categoria,
  ComposicionProducto,
  Envoltorio,
  Extra,
  ExtraCategoria,
  ProductoImagen,
  ZonaEnvio,
} from '@/types/database'

/** Todas las categorías activas, ordenadas. */
export async function obtenerCategorias(): Promise<Categoria[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('categoria')
    .select('id, nombre, slug, descripcion, imagen_url, orden')
    .order('orden')
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`)
  return (data ?? []) as Categoria[]
}

/** Catálogo publicado. Filtra por categoría si se pasa el slug. */
export async function obtenerProductos(
  categoriaSlug?: string,
): Promise<CatalogoProducto[]> {
  const sb = clienteServidor()
  let q = sb.from('v_catalogo_producto').select('*').order('orden')
  if (categoriaSlug) q = q.eq('categoria_slug', categoriaSlug)
  const { data, error } = await q
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`)
  return (data ?? []) as CatalogoProducto[]
}

/** Los destacados de la portada ("más vendidos"). */
export async function obtenerDestacados(limite = 6): Promise<CatalogoProducto[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('v_catalogo_producto')
    .select('*')
    .eq('destacado', true)
    .order('orden')
    .limit(limite)
  if (error) throw new Error(`No se pudieron cargar los destacados: ${error.message}`)
  return (data ?? []) as CatalogoProducto[]
}

export async function obtenerProductoPorSlug(
  slug: string,
): Promise<CatalogoProducto | null> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('v_catalogo_producto')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`)
  return (data as CatalogoProducto) ?? null
}

export async function obtenerImagenesProducto(
  productoId: number,
): Promise<ProductoImagen[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('producto_imagen')
    .select('id, url, alt, orden, es_principal')
    .eq('producto_id', productoId)
    .order('es_principal', { ascending: false })
    .order('orden')
  if (error) return []
  return (data ?? []) as ProductoImagen[]
}

/** Qué lleva el ramo: "3 rosas, 2 Hot Wheels". */
export async function obtenerComposicion(
  productoId: number,
): Promise<ComposicionProducto[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('producto_extra')
    .select('cantidad, extra:extra_id (id, nombre, slug, precio, espacios, imagen_url)')
    .eq('producto_id', productoId)
  if (error) return []
  return (data ?? []) as unknown as ComposicionProducto[]
}

/** Extras publicados, para la portada y para sumar al pedido. */
export async function obtenerExtras(): Promise<Extra[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('extra')
    .select(
      'id, nombre, slug, descripcion, precio, espacios, unidad, imagen_url, estado, orden, extra_categoria_id',
    )
    .order('orden')
  if (error) throw new Error(`No se pudieron cargar los extras: ${error.message}`)
  return (data ?? []) as Extra[]
}

export async function obtenerCategoriasExtra(): Promise<ExtraCategoria[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('extra_categoria')
    .select('id, nombre, slug, orden')
    .order('orden')
  if (error) return []
  return (data ?? []) as ExtraCategoria[]
}

/** Envoltorios activos para el armado personalizado (estilo × tamaño). */
export async function obtenerEnvoltorios(): Promise<Envoltorio[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('envoltorio')
    .select(
      'id, precio_base, espacios, estilo:estilo_id (nombre, slug, orden), tamano:tamano_id (codigo, nombre, orden)',
    )
    .order('precio_base')
  if (error)
    throw new Error(`No se pudieron cargar los envoltorios: ${error.message}`)

  type Fila = {
    id: number
    precio_base: number
    espacios: number | null
    estilo: { nombre: string; slug: string; orden: number } | null
    tamano: { codigo: string; nombre: string; orden: number } | null
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((f) => f.estilo !== null && f.tamano !== null)
    .map((f) => ({
      id: f.id,
      precio_base: Number(f.precio_base),
      espacios: f.espacios === null ? null : Number(f.espacios),
      estilo_nombre: f.estilo!.nombre,
      estilo_slug: f.estilo!.slug,
      estilo_orden: f.estilo!.orden,
      tamano_codigo: f.tamano!.codigo,
      tamano_nombre: f.tamano!.nombre,
      tamano_orden: f.tamano!.orden,
    }))
    .sort(
      (a, b) =>
        a.estilo_orden - b.estilo_orden || a.tamano_orden - b.tamano_orden,
    )
}

export async function obtenerZonasEnvio(): Promise<ZonaEnvio[]> {
  const sb = clienteServidor()
  const { data, error } = await sb
    .from('zona_envio')
    .select('id, nombre, costo_referencia')
    .order('nombre')
  if (error) return []
  return (data ?? []) as ZonaEnvio[]
}
