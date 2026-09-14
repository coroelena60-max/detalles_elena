'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { revisarArchivo, subirConPermiso } from '@/lib/subidaFirmada'
import { TIPOS_IMAGEN } from '@/lib/tipoImagen'
import { borrarFoto, marcarFotoPrincipal, prepararSubidaFoto, registrarFoto } from '../acciones'

export interface Foto {
  id: number
  url: string
  alt: string | null
  storage_path: string | null
  es_principal: boolean
  orden: number
}

export default function Fotos({
  productoId,
  nombre,
  fotos,
  puedeEditar,
}: {
  productoId: number
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
    setSubiendo(true)
    const r = await subirFoto(archivo)
    setSubiendo(false)
    setAviso({ ok: r.ok, texto: r.mensaje })
    if (r.ok) router.refresh()
  }

  async function subirFoto(archivo: File) {
    // el tipo se mira por el contenido del archivo, no por la extensión
    const revision = await revisarArchivo(archivo)
    if (!revision.ok) return revision
    const permiso = await prepararSubidaFoto(productoId, revision.tipo)
    if (!permiso.ok) return permiso
    const error = await subirConPermiso(permiso.ruta, permiso.token, archivo, revision.tipo)
    if (error) return { ok: false, mensaje: error }
    return registrarFoto(productoId, permiso.ruta, nombre)
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
      const r = await borrarFoto(productoId, foto.id)
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
        <ul className="mt-3 grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 divide-x divide-linea border-t border-linea text-xs">
                  {f.es_principal ? (
                    <span className="grid place-items-center px-1 py-2 text-tinta-suave">★ Principal</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => principal(f.id)}
                      disabled={ocupado}
                      title="Usar como foto principal"
                      className="px-1 py-2 text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-40"
                    >
                      ☆ Principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => borrar(f)}
                    disabled={ocupado}
                    className="px-1 py-2 text-tinta-suave transition hover:bg-alerta-suave hover:text-alerta disabled:opacity-40"
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
        <label
          className={`mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-rosa-300 px-3 py-3 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50 ${
            ocupado ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <span aria-hidden>＋</span>
          {subiendo ? 'Subiendo…' : 'Agregar una foto'}
          <input
            type="file"
            accept={Object.keys(TIPOS_IMAGEN).join(',')}
            disabled={ocupado}
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) void subir(archivo)
              e.target.value = ''
            }}
            className="sr-only"
          />
        </label>
      )}

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
