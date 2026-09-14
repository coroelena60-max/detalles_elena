/**
 * Freno básico contra probar contraseñas desde el login del panel.
 *
 * Vive en la memoria del servidor: en Vercel cada instancia lleva su cuenta, así
 * que es un freno, no una muralla. La muralla es Supabase Auth, que tiene su
 * propio límite por IP para iniciar sesión. Se cuenta por IP + correo (no solo
 * por correo) para que nadie pueda dejar afuera a la dueña probando con su mail.
 */
const VENTANA_MS = 15 * 60 * 1000
const MAX_FALLOS_POR_CUENTA = 5
const MAX_INTENTOS_POR_IP = 30

const registros = new Map<string, number[]>()

function recientes(clave: string, ahora: number) {
  const lista = (registros.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS)
  if (lista.length) registros.set(clave, lista)
  else registros.delete(clave)
  return lista
}

/** Minutos que faltan para poder volver a intentar, o 0 si puede intentar ya. */
export function esperaParaIntentar(ip: string, email: string, ahora = Date.now()): number {
  if (registros.size > 5000) registros.clear() // que la memoria no crezca sin fin
  const fallos = recientes(`f:${ip}:${email}`, ahora)
  const intentos = recientes(`i:${ip}`, ahora)
  const bloqueo =
    fallos.length >= MAX_FALLOS_POR_CUENTA ? fallos[0] : intentos.length >= MAX_INTENTOS_POR_IP ? intentos[0] : null
  return bloqueo === null ? 0 : Math.max(1, Math.ceil((bloqueo + VENTANA_MS - ahora) / 60000))
}

export function anotarIntento(ip: string, email: string, exito: boolean, ahora = Date.now()) {
  registros.set(`i:${ip}`, [...recientes(`i:${ip}`, ahora), ahora])
  if (exito) registros.delete(`f:${ip}:${email}`)
  else registros.set(`f:${ip}:${email}`, [...recientes(`f:${ip}:${email}`, ahora), ahora])
}
