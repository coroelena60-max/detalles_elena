import { WHATSAPP_NUMBER } from '@/lib/env'

/**
 * Mensaje CORTO a propósito: wa.me se degrada pasando ~1.500 caracteres.
 * El detalle completo del pedido lo consulta la tienda por el código.
 */
export function mensajePedido(codigo: string, nombre: string, total: number) {
  return [
    `Hola Detalles Elena! Acabo de armar un pedido en el catálogo.`,
    ``,
    `Código: ${codigo}`,
    `Nombre: ${nombre}`,
    `Total (sin envío): Bs ${total}`,
    ``,
    `Quedo atento/a para confirmar.`,
  ].join('\n')
}

/** El número para mostrar en pantalla (sin el 591 de Bolivia). */
export function numeroWhatsappVisible(numero = WHATSAPP_NUMBER) {
  return numero.startsWith('591') ? numero.slice(3) : numero
}

export function enlaceWhatsapp(texto: string, numero = WHATSAPP_NUMBER) {
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(texto)}`
}

export function enlacePedidoWhatsapp(
  codigo: string,
  nombre: string,
  total: number,
) {
  return enlaceWhatsapp(mensajePedido(codigo, nombre, total))
}

export function enlaceConsultaWhatsapp(asunto?: string) {
  return enlaceWhatsapp(
    asunto
      ? `Hola Detalles Elena! Quisiera consultar por ${asunto}.`
      : 'Hola Detalles Elena! Quisiera hacer una consulta.',
  )
}
