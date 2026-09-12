/**
 * Tipos del esquema de Supabase (ver ../../supabase/migrations).
 * Escritos a mano para no depender de la generación automática mientras
 * la base no esté aplicada. Cuando lo esté:
 *   pnpm dlx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type EstadoPublicacion =
  | 'borrador'
  | 'activo'
  | 'agotado'
  | 'temporada'
  | 'inactivo'

export type EstadoPedido =
  | 'nuevo'
  | 'enviado_whatsapp'
  | 'confirmado'
  | 'en_produccion'
  | 'listo'
  | 'entregado'
  | 'cancelado'

export type TipoEntrega = 'recojo_tienda' | 'envio'
export type TipoItemPedido = 'producto' | 'extra' | 'personalizado'

/** Fila de la vista v_catalogo_producto */
export interface CatalogoProducto {
  id: number
  codigo: string
  nombre: string
  slug: string
  descripcion: string | null
  precio: number
  precio_desde: boolean
  destacado: boolean
  lead_time_dias: number | null
  estado: EstadoPublicacion
  orden: number
  categoria_id: number
  categoria_nombre: string
  categoria_slug: string
  estilo_nombre: string | null
  tamano_codigo: string | null
  tamano_nombre: string | null
  espacios_capacidad: number | null
  imagen_principal: string | null
}

export interface Categoria {
  id: number
  nombre: string
  slug: string
  descripcion: string | null
  imagen_url: string | null
  orden: number
}

export interface Extra {
  id: number
  nombre: string
  slug: string
  descripcion: string | null
  precio: number
  espacios: number
  unidad: string
  imagen_url: string | null
  estado: EstadoPublicacion
  orden: number
  extra_categoria_id: number | null
}

export interface ExtraCategoria {
  id: number
  nombre: string
  slug: string
  orden: number
}

export interface ProductoImagen {
  id: number
  url: string
  alt: string | null
  orden: number
  es_principal: boolean
}

export interface ComposicionProducto {
  cantidad: number
  extra: Pick<Extra, 'id' | 'nombre' | 'slug' | 'precio' | 'espacios' | 'imagen_url'> | null
}

/**
 * Envoltorio publicado (estilo × tamaño) para el armado personalizado.
 * Plano: la consulta aplana los joins con estilo y tamano.
 */
export interface Envoltorio {
  id: number
  precio_base: number
  /** capacidad en "espacios"; null = sin límite declarado */
  espacios: number | null
  estilo_nombre: string
  estilo_slug: string
  estilo_orden: number
  tamano_codigo: string
  tamano_nombre: string
  tamano_orden: number
}

export interface ZonaEnvio {
  id: number
  nombre: string
  costo_referencia: number | null
}

/** Payload de la función crear_pedido() */
export interface ItemPedidoRpc {
  tipo: TipoItemPedido
  producto_id?: number
  extra_id?: number
  envoltorio_id?: number
  cantidad: number
  dedicatoria?: string
  nota?: string
  extras?: { extra_id: number; cantidad: number }[]
}

export interface RespuestaCrearPedido {
  id: number
  codigo: string
  subtotal: number
  total: number
  estado: EstadoPedido
}
