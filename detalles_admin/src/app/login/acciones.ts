'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { anotarIntento, esperaParaIntentar } from '@/lib/limiteIntentos'
import { COOKIE_ACTIVIDAD, COOKIE_INICIO, opcionesCookieSesion } from '@/lib/limitesSesion'
import { destinoSeguro } from '@/lib/destinoSeguro'
import { clienteServidor } from '@/lib/supabase/servidor'

export type ResultadoLogin = { ok: false; mensaje: string }

/**
 * Entrar al panel. No hay registro público: las cuentas las crea la dueña
 * desde Supabase (Authentication → Add user) y después se les asigna un rol.
 */
export async function entrar(
  _anterior: ResultadoLogin | null,
  datos: FormData,
): Promise<ResultadoLogin> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  const password = String(datos.get('password') ?? '')
  const volver = destinoSeguro(String(datos.get('volver') ?? '/'))

  if (!email || !password) {
    return { ok: false, mensaje: 'Completá tu correo y tu contraseña.' }
  }

  // Vercel pone la IP real del visitante al principio de x-forwarded-for
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'sin-ip'
  const espera = esperaParaIntentar(ip, email)
  if (espera > 0) {
    return { ok: false, mensaje: `Demasiados intentos. Probá de nuevo en ${espera} min.` }
  }

  const sb = await clienteServidor()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  anotarIntento(ip, email, !error)

  if (error) {
    return {
      ok: false,
      mensaje:
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : `No pudimos entrar: ${error.message}`,
    }
  }

  // arranca el reloj de la sesión (lo controla src/proxy.ts)
  const galletas = await cookies()
  const ahora = String(Date.now())
  galletas.set(COOKIE_INICIO, ahora, opcionesCookieSesion())
  galletas.set(COOKIE_ACTIVIDAD, ahora, opcionesCookieSesion())

  revalidatePath('/', 'layout')
  redirect(volver)
}

export async function salir() {
  const sb = await clienteServidor()
  await sb.auth.signOut()
  const galletas = await cookies()
  galletas.delete(COOKIE_INICIO)
  galletas.delete(COOKIE_ACTIVIDAD)
  revalidatePath('/', 'layout')
  redirect('/login')
}
