/**
 * Tipo real de una imagen por sus primeros bytes ("magic bytes"), no por la
 * extensión ni por lo que dice el navegador. Se usa en el navegador (para avisar
 * rápido) y en el servidor (para rechazar lo que se haya subido igual).
 */
export const TIPOS_IMAGEN = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const

export type TipoImagen = keyof typeof TIPOS_IMAGEN

export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024 // el bucket rechaza más de 5 MB

const texto = (b: Uint8Array, desde: number, largo: number) =>
  String.fromCharCode(...b.subarray(desde, desde + largo))

export function detectarTipoImagen(b: Uint8Array): TipoImagen | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png'
  if (b.length >= 12 && texto(b, 0, 4) === 'RIFF' && texto(b, 8, 4) === 'WEBP') return 'image/webp'
  if (b.length >= 12 && texto(b, 4, 4) === 'ftyp' && ['avif', 'avis'].includes(texto(b, 8, 4))) return 'image/avif'
  return null
}

export function esTipoImagen(t: string): t is TipoImagen {
  return Object.hasOwn(TIPOS_IMAGEN, t)
}
