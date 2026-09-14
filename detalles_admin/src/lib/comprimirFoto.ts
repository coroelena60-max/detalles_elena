'use client'

import { detectarTipoImagen, MAX_BYTES_IMAGEN, type TipoImagen } from '@/lib/tipoImagen'

/**
 * Deja la foto lista para subir: la achica a `ladoMax` px del lado más largo y la
 * pasa a WebP (JPG si el navegador no sabe hacer WebP, como Safari viejo). Las
 * fotos de celular salen de 3-8 MB y el catálogo entra en 4G: sin esto subían
 * PNG de 2 MB que el optimizador de imágenes tardaba en bajar.
 *
 * Si la versión comprimida no pesa menos (una foto ya optimizada), se sube la
 * original. El tipo se mira siempre por el contenido, y el servidor lo vuelve a
 * revisar al registrar la foto.
 */
export async function comprimirFoto(
  archivo: File,
  { ladoMax = 1600, calidad = 0.82 }: { ladoMax?: number; calidad?: number } = {},
): Promise<{ ok: true; archivo: File; tipo: TipoImagen } | { ok: false; mensaje: string }> {
  const tipoOriginal = detectarTipoImagen(new Uint8Array(await archivo.slice(0, 32).arrayBuffer()))
  if (!tipoOriginal) return { ok: false, mensaje: 'La foto tiene que ser WebP, JPG, PNG o AVIF.' }

  let comprimido: Blob | null = null
  try {
    const imagen = await createImageBitmap(archivo)
    const escala = Math.min(1, ladoMax / Math.max(imagen.width, imagen.height))
    const ancho = Math.max(1, Math.round(imagen.width * escala))
    const alto = Math.max(1, Math.round(imagen.height * escala))

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(imagen, 0, 0, ancho, alto)
      comprimido = await aBlob(lienzo, 'image/webp', calidad)
      if (comprimido?.type !== 'image/webp') {
        // JPG no tiene transparencia: fondo blanco en vez de negro
        ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, ancho, alto)
        comprimido = await aBlob(lienzo, 'image/jpeg', 0.85)
      }
    }
    imagen.close()
  } catch {
    comprimido = null // el navegador no pudo leerla: se intenta con la original
  }

  let final: File = archivo
  if (comprimido && (comprimido.size < archivo.size || archivo.size > MAX_BYTES_IMAGEN)) {
    const extension = comprimido.type === 'image/webp' ? 'webp' : 'jpg'
    const nombre = archivo.name.replace(/\.[^.]+$/, '') || 'foto'
    final = new File([comprimido], `${nombre}.${extension}`, { type: comprimido.type })
  }

  if (final.size > MAX_BYTES_IMAGEN) {
    return { ok: false, mensaje: 'La foto es demasiado pesada. Probá con otra.' }
  }
  const tipo = detectarTipoImagen(new Uint8Array(await final.slice(0, 32).arrayBuffer()))
  return tipo ? { ok: true, archivo: final, tipo } : { ok: false, mensaje: 'No se pudo preparar la foto.' }
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number) {
  return new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, tipo, calidad))
}
