'use client'

import { useState } from 'react'
import { useAccion } from '@/lib/useAccion'

/**
 * Botón "Anular" que pide el motivo en el lugar, sin ventanas emergentes.
 * Lo usan los gastos y las compras: lo que se anula queda a la vista con su
 * porqué, en vez de desaparecer.
 */
export default function AnularConMotivo({
  accion,
  etiqueta = 'Anular',
  placeholder = '¿Por qué se anula?',
}: {
  accion: (motivo: string) => Promise<{ ok: boolean; mensaje: string }>
  etiqueta?: string
  placeholder?: string
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')

  if (!abierto) {
    return (
      <span className="inline-flex flex-col items-end">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-xs text-tinta-suave transition hover:text-alerta"
        >
          {etiqueta}
        </button>
        {aviso && !aviso.ok && <span className="text-xs text-alerta">{aviso.texto}</span>}
      </span>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(() => accion(motivo))
      }}
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
    >
      <input
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder={placeholder}
        aria-label="Motivo"
        className="campo min-w-0 flex-1 py-1 text-sm focus:campo-foco sm:w-56"
      />
      <button
        type="submit"
        disabled={pendiente || motivo.trim().length < 3}
        className="rounded-lg bg-alerta px-3 py-1 text-xs font-medium text-white transition disabled:opacity-50"
      >
        {pendiente ? '…' : etiqueta}
      </button>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => setAbierto(false)}
        className="text-xs text-tinta-suave hover:text-tinta"
      >
        No
      </button>
      {aviso && !aviso.ok && <span className="w-full text-xs text-alerta">{aviso.texto}</span>}
    </form>
  )
}
