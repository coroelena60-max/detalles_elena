'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Aviso } from '@/components/ui'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { useAccion } from '@/lib/useAccion'
import { guardarFotoExtra } from '../../../maestro'

const MAX_BYTES = 5 * 1024 * 1024
const TIPOS = ['image/webp', 'image/jpeg', 'image/png', 'image/avif']

/** Ruta dentro del bucket a partir de la URL pública (para poder borrarla después). */
function rutaDeUrl(url: string | null): string | null {
  const marca = '/storage/v1/object/public/catalogo/'
  const i = url?.indexOf(marca) ?? -1
  return url && i >= 0 ? url.slice(i + marca.length) : null
}

export default function FotoExtra({
  extraId,
  slug,
  url,
  puedeEditar,
}: {
  extraId: number
  slug: string
  url: string | null
  puedeEditar: boolean
}) {
  const { pendiente, aviso, setAviso, ejecutar } = useAccion()
  const [subiendo, setSubiendo] = useState(false)

  async function subir(archivo: File) {
    setAviso(null)
    if (!TIPOS.includes(archivo.type)) {
      setAviso({ ok: false, texto: 'La foto tiene que ser WebP, JPG, PNG o AVIF.' })
      return
    }
    if (archivo.size > MAX_BYTES) {
      setAviso({ ok: false, texto: 'La foto pesa más de 5 MB. Comprimila antes de subirla.' })
      return
    }
    setSubiendo(true)
    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'webp'
    // prefijo "panel-" = subida desde acá; las fotos originales del seed no se tocan
    const ruta = `extras/panel-${slug}-${Date.now()}.${ext}`
    const sb = clienteNavegador()
    const { error } = await sb.storage.from('catalogo').upload(ruta, archivo, { contentType: archivo.type })
    setSubiendo(false)
    if (error) {
      setAviso({ ok: false, texto: `No se pudo subir: ${error.message}` })
      return
    }
    const { data } = sb.storage.from('catalogo').getPublicUrl(ruta)
    ejecutar(() => guardarFotoExtra(extraId, data.publicUrl, rutaDeUrl(url)))
  }

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Foto</h2>
      <div className="relative mt-3 aspect-square overflow-hidden rounded-lg bg-rosa-50">
        {url ? (
          <Image src={url} alt="" fill sizes="(min-width: 1024px) 20rem, 100vw" className="object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-4xl text-rosa-300">❀</span>
        )}
      </div>
      {puedeEditar && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-rosa-300 bg-white px-3 py-1.5 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50">
            {subiendo || pendiente ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
            <input
              type="file"
              accept={TIPOS.join(',')}
              disabled={subiendo || pendiente}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) subir(f)
                e.target.value = ''
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => ejecutar(() => guardarFotoExtra(extraId, null, rutaDeUrl(url)))}
              className="text-xs text-tinta-suave hover:text-alerta"
            >
              Quitar
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-tinta-suave">Cuadrada y liviana: se ve chiquita en el armador.</p>
      {aviso && <Aviso {...aviso} />}
    </section>
  )
}
