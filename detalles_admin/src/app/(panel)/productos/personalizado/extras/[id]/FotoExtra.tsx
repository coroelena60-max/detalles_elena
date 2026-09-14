'use client'

import Image from 'next/image'
import { useState } from 'react'
import BotonConfirmar from '@/components/BotonConfirmar'
import { Aviso } from '@/components/ui'
import { comprimirFoto } from '@/lib/comprimirFoto'
import { subirConPermiso } from '@/lib/subidaFirmada'
import { TIPOS_IMAGEN } from '@/lib/tipoImagen'
import { useAccion } from '@/lib/useAccion'
import { guardarFotoExtra, prepararSubidaFotoExtra } from '../../../maestro'

export default function FotoExtra({
  extraId,
  url,
  puedeEditar,
}: {
  extraId: number
  url: string | null
  puedeEditar: boolean
}) {
  const { pendiente, aviso, setAviso, ejecutar } = useAccion()
  const [subiendo, setSubiendo] = useState(false)

  async function subir(archivo: File) {
    setAviso(null)
    setSubiendo(true)
    // se ve chica en el armador: 800 px alcanzan
    const foto = await comprimirFoto(archivo, { ladoMax: 800 })
    if (!foto.ok) {
      setSubiendo(false)
      setAviso({ ok: false, texto: foto.mensaje })
      return
    }
    const permiso = await prepararSubidaFotoExtra(extraId, foto.tipo)
    const error = permiso.ok
      ? await subirConPermiso(permiso.ruta, permiso.token, foto.archivo, foto.tipo)
      : permiso.mensaje
    setSubiendo(false)
    if (error || !permiso.ok) {
      setAviso({ ok: false, texto: error ?? 'No se pudo subir.' })
      return
    }
    ejecutar(() => guardarFotoExtra(extraId, permiso.ruta))
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
              accept={Object.keys(TIPOS_IMAGEN).join(',')}
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
            <BotonConfirmar
              pregunta="¿Quitar la foto?"
              si="Sí, quitar"
              disabled={pendiente}
              alConfirmar={() => ejecutar(() => guardarFotoExtra(extraId, null))}
            >
              Quitar foto
            </BotonConfirmar>
          )}
        </div>
      )}
      {aviso && <Aviso {...aviso} />}
    </section>
  )
}
