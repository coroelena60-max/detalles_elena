import type { Database } from '@/types/database'

export type EstadoPedido = Database['public']['Enums']['estado_pedido']
export type MetodoPago = Database['public']['Enums']['metodo_pago']

/** Cómo se llama y cómo se ve cada estado en el panel. */
export const ESTADOS: Record<
  EstadoPedido,
  { etiqueta: string; clase: string; orden: number }
> = {
  nuevo: {
    etiqueta: 'Nuevo',
    clase: 'bg-rosa-100 text-rosa-700',
    orden: 1,
  },
  enviado_whatsapp: {
    etiqueta: 'Llegó por WhatsApp',
    clase: 'bg-rosa-100 text-rosa-700',
    orden: 2,
  },
  confirmado: {
    etiqueta: 'Confirmado',
    clase: 'bg-aviso-suave text-aviso',
    orden: 3,
  },
  en_produccion: {
    etiqueta: 'En producción',
    clase: 'bg-aviso-suave text-aviso',
    orden: 4,
  },
  listo: {
    etiqueta: 'Listo para entregar',
    clase: 'bg-ok-suave text-ok',
    orden: 5,
  },
  entregado: {
    etiqueta: 'Entregado',
    clase: 'bg-ok-suave text-ok',
    orden: 6,
  },
  cancelado: {
    etiqueta: 'Cancelado',
    clase: 'bg-alerta-suave text-alerta',
    orden: 7,
  },
}

/** Orden natural de trabajo: el botón sugiere el siguiente paso. */
export const SIGUIENTE_ESTADO: Partial<Record<EstadoPedido, EstadoPedido>> = {
  nuevo: 'confirmado',
  enviado_whatsapp: 'confirmado',
  confirmado: 'en_produccion',
  en_produccion: 'listo',
  listo: 'entregado',
}

export const METODOS_PAGO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
}

export const ESTADO_PAGO: Record<string, { etiqueta: string; clase: string }> = {
  pendiente: { etiqueta: 'Sin cobrar', clase: 'bg-alerta-suave text-alerta' },
  parcial: { etiqueta: 'Cobro parcial', clase: 'bg-aviso-suave text-aviso' },
  pagado: { etiqueta: 'Pagado', clase: 'bg-ok-suave text-ok' },
}

export type EstadoCompra = Database['public']['Enums']['estado_compra']
export type UnidadMedida = Database['public']['Enums']['unidad_medida']
export type TipoMovimiento = Database['public']['Enums']['tipo_movimiento']
export type EstadoPublicacion = Database['public']['Enums']['estado_publicacion']

export const ESTADOS_COMPRA: Record<EstadoCompra, { etiqueta: string; clase: string }> = {
  borrador: { etiqueta: 'Borrador', clase: 'bg-aviso-suave text-aviso' },
  recibida: { etiqueta: 'Recibida', clase: 'bg-ok-suave text-ok' },
  anulada: { etiqueta: 'Anulada', clase: 'bg-alerta-suave text-alerta' },
}

export const UNIDADES: Record<UnidadMedida, string> = {
  unidad: 'unidad',
  par: 'par',
  paquete: 'paquete',
  pliego: 'pliego',
  rollo: 'rollo',
  metro: 'metro',
  centimetro: 'cm',
  gramo: 'g',
  kilogramo: 'kg',
  litro: 'litro',
  mililitro: 'ml',
}

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { etiqueta: string; clase: string }> = {
  compra: { etiqueta: 'Compra', clase: 'bg-ok-suave text-ok' },
  produccion: { etiqueta: 'Producción', clase: 'bg-ok-suave text-ok' },
  devolucion: { etiqueta: 'Devolución', clase: 'bg-ok-suave text-ok' },
  ajuste: { etiqueta: 'Ajuste', clase: 'bg-aviso-suave text-aviso' },
  consumo: { etiqueta: 'Consumo', clase: 'bg-rosa-100 text-rosa-700' },
  venta: { etiqueta: 'Venta', clase: 'bg-rosa-100 text-rosa-700' },
  merma: { etiqueta: 'Merma', clase: 'bg-alerta-suave text-alerta' },
}

export const ESTADOS_PUBLICACION: Record<EstadoPublicacion, { etiqueta: string; clase: string }> = {
  borrador: { etiqueta: 'Borrador', clase: 'bg-rosa-100 text-rosa-700' },
  activo: { etiqueta: 'En el catálogo', clase: 'bg-ok-suave text-ok' },
  agotado: { etiqueta: 'Agotado', clase: 'bg-aviso-suave text-aviso' },
  temporada: { etiqueta: 'De temporada', clase: 'bg-ok-suave text-ok' },
  inactivo: { etiqueta: 'Fuera del catálogo', clase: 'bg-alerta-suave text-alerta' },
}

/** Venta de mostrador → /ventas; todo lo que entra por el catálogo → /pedidos. */
export function rutaPedido(codigo: string | null, canal: string | null): string {
  return `${canal === 'mostrador' ? '/ventas' : '/pedidos'}/${codigo}`
}

/** Teléfono del cliente genérico "S/N" (migración 0022): la venta queda como "S/C". */
export const TELEFONO_SIN_CLIENTE = '0000000'

export function nombreCliente(c: { nombre?: string | null; telefono?: string | null } | null): string {
  if (!c) return 'Sin cliente'
  if (c.telefono === TELEFONO_SIN_CLIENTE || c.nombre === 'S/N') return 'S/C · Sin cliente'
  return c.nombre ?? 'Sin cliente'
}

/** La foto que se muestra de un producto: la principal, si no la primera por orden. */
export function fotoPrincipal(
  imagenes: { url: string; es_principal: boolean; orden: number }[] | null | undefined,
): string | null {
  const orden = [...(imagenes ?? [])].sort(
    (a, b) => Number(b.es_principal) - Number(a.es_principal) || a.orden - b.orden,
  )
  return orden[0]?.url ?? null
}
