'use client'

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'
import { detectarTipoImagen, MAX_BYTES_IMAGEN, type TipoImagen } from '@/lib/tipoImagen'

/**
 * Subir una foto sin que el navegador tenga la sesión: el servidor revisa el
 * permiso y entrega un permiso de subida de un solo archivo (ruta + token), y
 * acá solo se usa ese token. Por eso las cookies de sesión pueden ser HttpOnly.
 */
const almacen = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage.from('catalogo')

export async function revisarArchivo(
  archivo: File,
): Promise<{ ok: true; tipo: TipoImagen } | { ok: false; mensaje: string }> {
  if (archivo.size > MAX_BYTES_IMAGEN) {
    return { ok: false, mensaje: 'La foto pesa más de 5 MB. Comprimila antes de subirla.' }
  }
  const tipo = detectarTipoImagen(new Uint8Array(await archivo.slice(0, 32).arrayBuffer()))
  return tipo ? { ok: true, tipo } : { ok: false, mensaje: 'La foto tiene que ser WebP, JPG, PNG o AVIF.' }
}

export async function subirConPermiso(ruta: string, token: string, archivo: File, tipo: TipoImagen) {
  const { error } = await almacen.uploadToSignedUrl(ruta, token, archivo, { contentType: tipo })
  return error ? `No se pudo subir: ${error.message}` : null
}
