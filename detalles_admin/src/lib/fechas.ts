/**
 * Fechas de calendario en Bolivia (America/La_Paz, UTC−4 todo el año).
 *
 * Los reportes trabajan con días de calendario ("del 1 al 15"), no con
 * instantes: por eso todo se maneja como texto AAAA-MM-DD y la base hace la
 * conversión de zona horaria. Nunca `new Date('2026-09-01')` suelto, que en
 * JavaScript es medianoche UTC y en Bolivia todavía es el día anterior.
 */
const ZONA = 'America/La_Paz'
const PATRON = /^\d{4}-\d{2}-\d{2}$/

export function hoyBolivia(): string {
  // en-CA formatea como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

export function esFechaValida(valor: string | undefined): valor is string {
  if (!valor || !PATRON.test(valor)) return false
  const [a, m, d] = valor.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

/** Lo que viene en la URL, saneado. Si falta o no sirve: el mes en curso. */
export function rangoDeParams(params: { desde?: string; hasta?: string }) {
  const hoy = hoyBolivia()
  let desde = esFechaValida(params.desde) ? params.desde : inicioDeMes(hoy)
  let hasta = esFechaValida(params.hasta) ? params.hasta : hoy
  if (hasta < desde) [desde, hasta] = [hasta, desde]
  return { desde, hasta }
}

/** Atajos que se usan de verdad: hoy, esta semana, este mes, el anterior, el año. */
export function atajosDeRango() {
  const hoy = hoyBolivia()
  const [a, m] = hoy.split('-').map(Number)
  const diaSemana = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7 // lunes = 0
  const mesPasadoFin = sumarDias(inicioDeMes(hoy), -1)

  return [
    { etiqueta: 'Hoy', desde: hoy, hasta: hoy },
    { etiqueta: 'Esta semana', desde: sumarDias(hoy, -diaSemana), hasta: hoy },
    { etiqueta: 'Este mes', desde: inicioDeMes(hoy), hasta: hoy },
    { etiqueta: 'Mes pasado', desde: inicioDeMes(mesPasadoFin), hasta: mesPasadoFin },
    { etiqueta: 'Últimos 90 días', desde: sumarDias(hoy, -89), hasta: hoy },
    { etiqueta: `Año ${a}`, desde: `${a}-01-01`, hasta: hoy },
  ].map((r) => ({ ...r, mes: m }))
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-05" -> "5 sep" (o "5 sep 2026" con año) */
export function diaCorto(fecha: string, conAnio = false): string {
  if (!esFechaValida(fecha)) return fecha
  const [a, m, d] = fecha.split('-').map(Number)
  return `${d} ${MESES[m - 1]}${conAnio ? ` ${a}` : ''}`
}

/** "2026-09-01" -> "sep 2026" */
export function mesCorto(fecha: string): string {
  if (!esFechaValida(fecha)) return fecha
  const [a, m] = fecha.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

export function describirRango(desde: string, hasta: string): string {
  if (desde === hasta) return diaCorto(desde, true)
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4)
  return `${diaCorto(desde, !mismoAnio)} al ${diaCorto(hasta, true)}`
}
