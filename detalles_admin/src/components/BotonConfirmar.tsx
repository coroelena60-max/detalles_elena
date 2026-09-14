'use client'

import { useState } from 'react'

/**
 * Botón para lo que no tiene vuelta atrás (cancelar, borrar, sacar del
 * catálogo): el primer clic solo pregunta, en el lugar y sin ventanas
 * emergentes. Recién "Sí, …" ejecuta.
 */
export default function BotonConfirmar({
  children,
  pregunta,
  si,
  alConfirmar,
  disabled = false,
  className = 'text-sm text-tinta-suave underline-offset-2 transition hover:text-alerta hover:underline',
}: {
  children: React.ReactNode
  pregunta: string
  /** texto del botón que confirma, ej. "Sí, cancelar" */
  si: string
  alConfirmar: () => void
  disabled?: boolean
  className?: string
}) {
  const [preguntando, setPreguntando] = useState(false)

  if (!preguntando) {
    return (
      <button type="button" onClick={() => setPreguntando(true)} disabled={disabled} className={className}>
        {children}
      </button>
    )
  }

  return (
    <div role="alertdialog" aria-label={pregunta} className="rounded-lg border border-alerta/30 bg-alerta-suave p-3">
      <p className="text-sm font-medium text-alerta">{pregunta}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPreguntando(false)
            alConfirmar()
          }}
          disabled={disabled}
          className="rounded-lg bg-alerta px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {si}
        </button>
        <button
          type="button"
          onClick={() => setPreguntando(false)}
          autoFocus
          className="rounded-lg border border-linea bg-white px-4 py-2 text-sm transition hover:bg-fondo"
        >
          No
        </button>
      </div>
    </div>
  )
}
