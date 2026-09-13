'use client'

import { useState } from 'react'
import { programarPedido } from '@/app/(panel)/ventas/acciones'
import { useAccion } from '@/lib/useAccion'

/** El día en que el pedido tiene que estar listo (lo que ordena la agenda). */
export default function ProgramarFecha({
  codigo,
  pedidoId,
  fecha,
  compacto = false,
}: {
  codigo: string
  pedidoId: number
  fecha: string | null
  compacto?: boolean
}) {
  const { pendiente, aviso, ejecutar } = useAccion()
  const [valor, setValor] = useState(fecha ?? '')

  return (
    <div className={compacto ? 'flex items-center gap-1' : ''}>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label={`Fecha de entrega de ${codigo}`}
          className="campo py-1 text-sm focus:campo-foco"
        />
        <button
          type="button"
          disabled={pendiente || valor === (fecha ?? '')}
          onClick={() => ejecutar(() => programarPedido(codigo, pedidoId, valor || null))}
          className="rounded-lg border border-rosa-300 px-2.5 py-1 text-sm text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-40"
        >
          {pendiente ? '…' : 'Guardar'}
        </button>
      </div>
      {aviso && !compacto && (
        <p className={`mt-1 text-xs ${aviso.ok ? 'text-ok' : 'text-alerta'}`}>{aviso.texto}</p>
      )}
      {aviso && !aviso.ok && compacto && <span className="text-xs text-alerta">{aviso.texto}</span>}
    </div>
  )
}
