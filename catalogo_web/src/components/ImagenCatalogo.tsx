import Image from 'next/image'

interface Props {
  src: string | null
  alt: string
  sizes?: string
  prioridad?: boolean
  className?: string
}

/**
 * Muestra la foto del producto o un marcador si todavía no se subió al
 * Storage (la carga de imágenes es un paso aparte del seed).
 */
export default function ImagenCatalogo({
  src,
  alt,
  sizes = '(max-width: 640px) 50vw, 320px',
  prioridad = false,
  className = '',
}: Props) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${alt} (foto pendiente)`}
        className={`grid place-items-center bg-rosa-100 text-3xl text-rosa-300 ${className}`}
      >
        ❀
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={prioridad}
      className={`object-cover ${className}`}
    />
  )
}
