import { SUPABASE_URL } from '@/lib/env'
import { detectarTipoImagen, MAX_BYTES_IMAGEN } from '@/lib/tipoImagen'

/**
 * Fotos del bucket `catalogo`, del lado del servidor. Las URL y las rutas se
 * arman acá (nunca se guarda una URL que mande el navegador) y lo subido se
 * revisa por contenido antes de registrarlo.
 */

const MARCA = '/storage/v1/object/public/catalogo/'

export function urlPublica(ruta: string) {
  return `${SUPABASE_URL}${MARCA}${ruta}`
}

export function rutaDeUrl(url: string | null | undefined): string | null {
  const i = url?.indexOf(MARCA) ?? -1
  return url && i >= 0 ? url.slice(i + MARCA.length) : null
}

/** Nombre de archivo seguro: minúsculas, números y guiones. */
export function trozoSeguro(texto: string) {
  return (
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'foto'
  )
}

/**
 * Lee los primeros bytes del archivo ya subido y confirma que sea una imagen
 * permitida y que no pase el tamaño. null = está bien; si no, el motivo.
 */
export async function problemaConImagenSubida(ruta: string): Promise<string | null> {
  try {
    const r = await fetch(urlPublica(ruta), { headers: { Range: 'bytes=0-31' }, cache: 'no-store' })
    if (!r.ok) return 'No se encontró el archivo subido.'
    const total = Number(r.headers.get('content-range')?.split('/')[1] ?? r.headers.get('content-length'))
    if (Number.isFinite(total) && total > MAX_BYTES_IMAGEN) return 'La foto pesa más de 5 MB.'
    const bytes = new Uint8Array(await r.arrayBuffer()).subarray(0, 32)
    return detectarTipoImagen(bytes) ? null : 'El archivo no es una imagen WebP, JPG, PNG o AVIF.'
  } catch {
    return 'No se pudo revisar el archivo subido.'
  }
}
