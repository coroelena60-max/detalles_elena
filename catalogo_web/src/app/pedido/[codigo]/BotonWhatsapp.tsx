'use client'

import { useState } from 'react'
import { enlacePedidoWhatsapp } from '@/lib/whatsapp'
import { marcarEnviadoWhatsapp } from '../acciones'

export default function BotonWhatsapp({
  codigo,
  nombre,
  total,
}: {
  codigo: string
  nombre: string
  total: number
}) {
  const [abierto, setAbierto] = useState(false)
  const enlace = enlacePedidoWhatsapp(codigo, nombre, total)

  return (
    <>
      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setAbierto(true)
          // métrica de conversión; si falla no bloquea al cliente
          void marcarEnviadoWhatsapp(codigo).catch(() => {})
        }}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25d366] px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-95"
      >
        Enviar mi pedido por WhatsApp
      </a>
      {abierto && (
        <p aria-live="polite" className="mt-3 text-xs text-tinta-suave">
          Si WhatsApp no se abrió, volvé a tocar el botón o escribinos el código{' '}
          <strong>{codigo}</strong> manualmente.
        </p>
      )}
    </>
  )
}
