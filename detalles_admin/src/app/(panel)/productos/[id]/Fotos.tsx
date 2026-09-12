'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { borrarFoto, marcarFotoPrincipal, registrarFoto } from '../acciones'

export interface Foto {
  id: number
  url: string
  alt: string | null
  storage_path: string | null
  es_principal: boolean
  orden: number
}

const MAX_BYTES = 5 * 1024 * 1024 // el bucket rechaza más de 5 MB
const TIPOS = ['image/webp', 'image/jpeg', 'image/png', 'image/avif']

export default function Fotos({
  productoId,
  codigo,
  nombre,
  fotos,
  puedeEditar,
}: {
  productoId: number
  codigo: string
  nombre: string
  fotos: Foto[]
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

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
    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'webp'
    const ruta = `productos/${codigo.toLowerCase()}-${Date.now()}.${extension}`

    const sb = clienteNavegador()
    const { error } = await sb.storage
      .from('catalogo')
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

    if (error) {
      setSubiendo(false)
      setAviso({ ok: false, texto: `No se pudo subir: ${error.message}` })
      return
    }

    const {
      data: { publicUrl },
    } = sb.storage.from('catalogo').getPublicUrl(ruta)

    const r = await registrarFoto(productoId, ruta, publicUrl, nombre)
    setSubiendo(false)
    setAviso({ ok: r.ok, texto: r.mensaje })
    if (r.ok) router.refresh()
  }

  function principal(imagenId: number) {
    iniciar(async () => {
      const r = await marcarFotoPrincipal(productoId, imagenId)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  function borrar(foto: Foto) {
    iniciar(async () => {
      const r = await borrarFoto(productoId, foto.id, foto.storage_path)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
    })
  }

  const ocupado = pendiente || subiendo

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Fotos</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        La principal es la que se ve en la lista del catálogo. Subí imágenes ya
        comprimidas: el cliente entra en 4G.
      </p>

      {fotos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-lg border border-linea">
              <div className="relative aspect-square bg-rosa-50">
                <Image
                  src={f.url}
                  alt={f.alt ?? nombre}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {f.es_principal && (
                  <span className="absolute left-1 top-1 rounded-full bg-rosa-600 px-2 py-0.5 text-[0.65rem] font-medium text-white">
                    Principal
                  </span>
                )}
              </div>
              {puedeEditar && (
                <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => principal(f.id)}
                    disabled={ocupado || f.es_principal}
                    className="rounded px-1.5 py-1 text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-40"
                  >
                    Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(f)}
                    disabled={ocupado}
                    className="rounded px-1.5 py-1 text-tinta-suave transition hover:text-alerta disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-rosa-50 p-4 text-sm text-tinta-suave">
          Todavía no tiene fotos. En el catálogo se ve el marcador ❀.
        </p>
      )}

      {puedeEditar && (
        <label className="mt-4 block">
          <span className="text-sm font-medium">Agregar una foto</span>
          <input
            type="file"
            accept="image/webp,image/jpeg,image/png,image/avif"
            disabled={ocupado}
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) void subir(archivo)
              e.target.value = ''
            }}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-rosa-100 file:px-3 file:py-2 file:text-sm file:text-rosa-700"
          />
        </label>
      )}

      {subiendo && <p className="mt-2 text-sm text-tinta-suave">Subiendo…</p>}

      {aviso && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </section>
  )
}
