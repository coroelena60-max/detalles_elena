import Image from 'next/image'

/** Foto cuadrada de producto o extra; sin URL muestra el marcador ❀ igual que el catálogo. */
export default function Miniatura({
  url,
  alt,
  className = 'size-14',
}: {
  url: string | null | undefined
  alt: string
  className?: string
}) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-rosa-50 ${className}`}>
      {url ? (
        <Image src={url} alt={alt} fill sizes="120px" className="object-cover" />
      ) : (
        <span aria-hidden className="grid size-full place-items-center text-rosa-300">❀</span>
      )}
    </span>
  )
}
