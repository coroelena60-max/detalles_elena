'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/types/database'

let instancia: ReturnType<typeof createBrowserClient<Database>> | null = null

/** Cliente para componentes de cliente (singleton). */
export function clienteNavegador() {
  if (!instancia) {
    instancia = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)
  }
  return instancia
}
