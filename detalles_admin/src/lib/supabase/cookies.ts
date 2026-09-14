/**
 * Opciones de las cookies de sesión de Supabase. Por defecto @supabase/ssr las
 * deja legibles desde JavaScript (httpOnly: false) para que el cliente de
 * navegador pueda usarlas; el panel ya no usa la sesión en el navegador (las
 * fotos se suben con un permiso firmado), así que van HttpOnly: un script
 * inyectado no puede leer el token.
 */
export const opcionesCookiesSesion = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}
