function requerido(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiá .env.local.example a .env.local y completala.`,
    )
  }
  return valor
}

export const SUPABASE_URL = requerido(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
)

export const SUPABASE_KEY = requerido(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)

/** Número de la tienda en formato internacional sin "+". Nunca hardcodear. */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''
