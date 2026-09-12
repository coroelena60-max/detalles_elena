/** Formatea un monto en bolivianos: 35 -> "Bs 35", 35.5 -> "Bs 35,50" */
export function bs(monto: number | string): string {
  const n = typeof monto === 'string' ? Number(monto) : monto
  if (!Number.isFinite(n)) return 'Bs 0'
  const entero = Number.isInteger(n)
  return `Bs ${n.toLocaleString('es-BO', {
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** "desde Bs 85" cuando el producto no tiene precio único */
export function precioProducto(precio: number, desde: boolean): string {
  return desde ? `desde ${bs(precio)}` : bs(precio)
}

export function plazoEntrega(dias: number | null): string | null {
  if (dias === null || dias === undefined) return null
  if (dias === 0) return 'Entrega el mismo día'
  if (dias === 1) return 'Entrega en 1 día'
  return `Entrega en ${dias} días`
}

/** Espacios de la "mochila": 12 -> "12", 0.5 -> "0,5" */
export function espacios(n: number): string {
  return n.toLocaleString('es-BO', { maximumFractionDigits: 2 })
}
