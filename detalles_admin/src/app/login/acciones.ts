'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
  const email = String(datos.get('email') ?? '').trim()
  const password = String(datos.get('password') ?? '')
  const volver = String(datos.get('volver') ?? '/')

  if (!email || !password) {
    return { ok: false, mensaje: 'Completá tu correo y tu contraseña.' }
  }

  const sb = await clienteServidor()
  const { error } = await sb.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      ok: false,
      mensaje:
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : `No pudimos entrar: ${error.message}`,
    }
  }

  revalidatePath('/', 'layout')
  redirect(volver.startsWith('/') ? volver : '/')
}

export async function salir() {
  const sb = await clienteServidor()
  await sb.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
