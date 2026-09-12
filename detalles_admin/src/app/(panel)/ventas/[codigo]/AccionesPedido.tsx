'use client'

import { useState, useTransition } from 'react'
import {
  ESTADOS,
  METODOS_PAGO,
  SIGUIENTE_ESTADO,
  type EstadoPedido,
  type MetodoPago,
} from '@/lib/estados'
import { bs } from '@/lib/formato'
import { cambiarEstado, registrarPago } from '../acciones'

interface Props {
  codigo: string
  pedidoId: number
  estado: EstadoPedido
  saldo: number
  puedeEditar: boolean
  puedeCobrar: boolean
}

export default function AccionesPedido({
  codigo,
  pedidoId,
  estado,
  saldo,
  puedeEditar,
  puedeCobrar,
}: Props) {
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [monto, setMonto] = useState(saldo > 0 ? String(saldo) : '')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [referencia, setReferencia] = useState('')

  const siguiente = SIGUIENTE_ESTADO[estado]
  const cerrado = estado === 'entregado' || estado === 'cancelado'

  function avanzar(nuevo: EstadoPedido) {
    setAviso(null)
    iniciar(async () => {
      const r = await cambiarEstado(codigo, pedidoId, nuevo)
      setAviso({ ok: r.ok, texto: r.mensaje })
    })
  }

  function cobrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    const valor = Number(monto)
    iniciar(async () => {
      const r = await registrarPago(codigo, pedidoId, valor, metodo, referencia)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) {
        setReferencia('')
        setMonto('')
      }
    })
  }

  return (
    <div className="space-y-4">
      {puedeEditar && (
        <div className="tarjeta p-4">
          <h2 className="text-sm font-semibold">Estado</h2>

          {siguiente ? (
            <button
              type="button"
              onClick={() => avanzar(siguiente)}
              disabled={pendiente}
              className="mt-3 w-full rounded-lg bg-rosa-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
            >
              {pendiente ? 'Guardando…' : `Marcar como ${ESTADOS[siguiente].etiqueta}`}
            </button>
          ) : (
            <p className="mt-3 text-sm text-tinta-suave">
              {estado === 'entregado'
                ? 'El pedido ya se entregó.'
                : 'El pedido está cancelado.'}
            </p>
          )}

          {siguiente === 'entregado' && (
            <p className="mt-2 text-xs text-tinta-suave">
              Al entregar se descuenta del inventario lo que salió.
            </p>
          )}

          {!cerrado && (
            <button
              type="button"
              onClick={() => avanzar('cancelado')}
              disabled={pendiente}
              className="mt-2 w-full rounded-lg border border-linea px-4 py-2 text-sm text-tinta-suave transition hover:border-alerta hover:text-alerta disabled:opacity-60"
            >
              Cancelar pedido
            </button>
          )}
        </div>
      )}

      {puedeCobrar && (
        <form onSubmit={cobrar} className="tarjeta p-4">
          <h2 className="text-sm font-semibold">Registrar un cobro</h2>
          <p className="mt-1 text-xs text-tinta-suave">
            Saldo pendiente: <strong>{bs(saldo)}</strong>
          </p>

          <label htmlFor="monto" className="mt-3 block text-sm">
            Monto
          </label>
          <input
            id="monto"
            type="number"
            step="0.01"
            min="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            className="campo mt-1 focus:campo-foco"
          />

          <label htmlFor="metodo" className="mt-3 block text-sm">
            Método
          </label>
          <select
            id="metodo"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoPago)}
            className="campo mt-1 focus:campo-foco"
          >
            {Object.entries(METODOS_PAGO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>

          <label htmlFor="referencia" className="mt-3 block text-sm">
            Referencia <span className="text-tinta-suave">(opcional)</span>
          </label>
          <input
            id="referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Nº de transacción"
            className="campo mt-1 focus:campo-foco"
          />

          <button
            type="submit"
            disabled={pendiente}
            className="mt-4 w-full rounded-lg border border-rosa-300 px-4 py-2.5 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-60"
          >
            {pendiente ? 'Guardando…' : 'Registrar cobro'}
          </button>
        </form>
      )}

      {aviso && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  )
}
