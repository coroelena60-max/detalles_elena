/** Formatea un monto en bolivianos: 35 -> "Bs 35", 35.5 -> "Bs 35,50" */
export function bs(monto: number | string | null | undefined): string {
  const n = typeof monto === 'string' ? Number(monto) : (monto ?? 0)
  if (!Number.isFinite(n)) return 'Bs 0'
  return `Bs ${n.toLocaleString('es-BO', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function numero(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('es-BO', { maximumFractionDigits: 2 })
}

const ZONA = 'America/La_Paz'

export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('es-BO', {
    timeZone: ZONA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-BO', {
    timeZone: ZONA,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "hace 3 h" — para la lista de pedidos, que se mira a cada rato. */
export function haceCuanto(valor: string | null | undefined): string {
  if (!valor) return '—'
  const ms = Date.now() - new Date(valor).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}
