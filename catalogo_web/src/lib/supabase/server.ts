import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Cliente para componentes de servidor y server actions.
 * Usa la clave publicable: el catálogo no necesita sesión de usuario y la
 * seguridad la impone RLS + la función crear_pedido() en la base.
 */
export function clienteServidor() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
