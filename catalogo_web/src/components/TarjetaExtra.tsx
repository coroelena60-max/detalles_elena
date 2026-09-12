import BotonAgregar from '@/components/BotonAgregar'
import ImagenCatalogo from '@/components/ImagenCatalogo'
import { bs } from '@/lib/formato'
import type { Extra } from '@/types/database'

export default function TarjetaExtra({ extra }: { extra: Extra }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-rosa-200 bg-white p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
        <ImagenCatalogo
          src={extra.imagen_url}
          alt={extra.nombre}
          sizes="64px"
          className="size-full"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{extra.nombre}</h3>
        <p className="text-sm font-semibold text-rosa-700">{bs(extra.precio)}</p>
      </div>
      <BotonAgregar
        tipo="extra"
        referenciaId={extra.id}
        nombre={extra.nombre}
        precio={extra.precio}
        imagen={extra.imagen_url}
        agotado={extra.estado === 'agotado'}
        variante="compacto"
      />
    </article>
  )
}
