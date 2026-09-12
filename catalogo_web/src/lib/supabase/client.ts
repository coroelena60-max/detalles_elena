'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'

let instancia: ReturnType<typeof createBrowserClient> | null = null

/** Cliente para componentes de cliente (singleton). */
export function clienteNavegador() {
  if (!instancia) {
    instancia = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
  }
  return instancia
}
