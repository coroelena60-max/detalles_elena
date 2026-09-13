'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function BotonesComprobante({
  volver,
  whatsapp,
  texto,
}: {
  volver: string
  whatsapp: string
  texto: string
}) {
  const [copiado, setCopiado] = useState(false)

  return (
    <div className="mx-auto flex max-w-md flex-wrap items-center gap-2 print:hidden">
      <Link href={volver} className="mr-auto text-sm text-rosa-700 hover:underline">
        ← Volver
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-linea bg-white px-3 py-2 text-sm hover:bg-rosa-50"
        title="En el diálogo de impresión podés elegir “Guardar como PDF”"
      >
        🖨 Imprimir / PDF
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
          } catch {
            setCopiado(false)
          }
        }}
        className="rounded-lg border border-linea bg-white px-3 py-2 text-sm hover:bg-rosa-50"
      >
        {copiado ? '✓ Copiado' : 'Copiar texto'}
      </button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:brightness-95"
      >
        Enviar por WhatsApp
      </a>
    </div>
  )
}
