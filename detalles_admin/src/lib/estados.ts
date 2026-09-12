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
