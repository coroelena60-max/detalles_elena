/**
 * Cuánto dura una sesión del panel. Supabase deja las cookies 400 días y las
 * renueva solas: sin esto, quien entró una vez seguía adentro para siempre.
 * Lo hace cumplir `src/proxy.ts` en cada request.
 */
export const LIMITES_SESION = {
  /** sin tocar el panel durante este tiempo, se cierra */
  inactividadMs: 4 * 60 * 60 * 1000,
  /** desde que entró, aunque la use todo el tiempo */
  maximaMs: 12 * 60 * 60 * 1000,
}

/** cuándo entró (respaldo si el token no trae `amr`) */
export const COOKIE_INICIO = 'panel_inicio'
/** último request hecho por la persona (el sondeo de pedidos no cuenta) */
export const COOKIE_ACTIVIDAD = 'panel_actividad'

export type MotivoCierre = 'inactividad' | 'vencida'

export function opcionesCookieSesion() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(LIMITES_SESION.maximaMs / 1000),
  }
}

/**
 * Momento del login en ms. Primero el `amr` del token de Supabase (firmado: no
 * se puede estirar editando cookies); si no viene, la cookie que deja `entrar()`.
 */
export function inicioDeSesion(amr: unknown, cookieInicio: string | undefined): number | null {
  if (Array.isArray(amr)) {
    const marcas = amr
      .map((a) => Number((a as { timestamp?: unknown })?.timestamp))
      .filter((t) => Number.isFinite(t) && t > 0)
    if (marcas.length) return Math.min(...marcas) * 1000
  }
  const n = Number(cookieInicio)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** null = la sesión sigue; si no, por qué se cierra */
export function evaluarSesion(inicio: number | null, actividad: number | null, ahora: number): MotivoCierre | null {
  if (inicio === null || ahora - inicio > LIMITES_SESION.maximaMs) return 'vencida'
  if (ahora - (actividad ?? inicio) > LIMITES_SESION.inactividadMs) return 'inactividad'
  return null
}
