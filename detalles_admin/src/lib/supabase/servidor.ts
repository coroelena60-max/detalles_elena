import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Cliente para Server Components y server actions.
 *
 * Usa la clave publicable + la sesión del usuario: quien manda es RLS. La
 * service_role NO se usa acá; queda reservada para tareas administrativas
 * fuera del request (scripts, migraciones), nunca para saltarse permisos.
 */
export async function clienteServidor() {
  const galletas = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return galletas.getAll()
      },
      setAll(nuevas) {
        try {
          for (const { name, value, options } of nuevas) {
            galletas.set(name, value, options)
          }
        } catch {
          // En un Server Component no se pueden escribir cookies: el refresco
          // de sesión lo hace el middleware, así que se puede ignorar.
        }
      },
    },
  })
}
