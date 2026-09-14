'use client'

import { useState, useTransition } from 'react'
import BotonConfirmar from '@/components/BotonConfirmar'
import Icono, { type NombreIcono } from '@/components/Icono'
import {
  ESTADOS,
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

/** El botón grande dice lo que se hace, no el nombre del estado. */
const PASO: Partial<Record<EstadoPedido, { texto: string; icono: NombreIcono }>> = {
  confirmado: { texto: 'Confirmar pedido', icono: 'listo' },
  en_produccion: { texto: 'Empezar a armarlo', icono: 'flor' },
  listo: { texto: 'Ya está listo', icono: 'caja' },
  entregado: { texto: 'Entregar', icono: 'vender' },
}

const METODOS: { valor: MetodoPago; etiqueta: string; icono: NombreIcono }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo', icono: 'efectivo' },
  { valor: 'qr', etiqueta: 'QR', icono: 'qr' },
  { valor: 'transferencia', etiqueta: 'Transferencia', icono: 'transferencia' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta', icono: 'billetera' },
]

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
  const paso = siguiente ? PASO[siguiente] : undefined
  // desde confirmado o en el taller se puede saltar directo a "entregado"
  const atajoEntregar = siguiente && siguiente !== 'entregado' && (estado === 'confirmado' || estado === 'en_produccion')

  function avanzar(nuevo: EstadoPedido) {
    setAviso(null)
    iniciar(async () => {
      const r = await cambiarEstado(codigo, pedidoId, nuevo)
      setAviso({ ok: r.ok, texto: r.ok ? `Listo: ${ESTADOS[nuevo].etiqueta.toLowerCase()}.` : r.mensaje })
    })
  }

  function cobrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    const valor = Number(monto.replace(',', '.'))
    iniciar(async () => {
      const r = await registrarPago(codigo, pedidoId, valor, metodo, metodo === 'efectivo' ? '' : referencia)
      setAviso({ ok: r.ok, texto: r.ok ? `Cobro de ${bs(valor)} anotado.` : r.mensaje })
      if (r.ok) {
        setReferencia('')
        setMonto('')
      }
    })
  }

  return (
    <div className="space-y-4">
      {puedeEditar && (
        <section className="tarjeta p-4">
          <h2 className="text-base font-semibold">Qué sigue</h2>

          {cerrado ? (
            <p className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-3 font-medium ${estado === 'entregado' ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'}`}>
              <Icono nombre={estado === 'entregado' ? 'listo' : 'cerrar'} />
              {estado === 'entregado' ? 'Ya se entregó' : 'Está cancelado'}
            </p>
          ) : (
            <>
              {siguiente && paso && (
                <button
                  type="button"
                  onClick={() => avanzar(siguiente)}
                  disabled={pendiente}
                  className="mt-3 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-rosa-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-rosa-700 disabled:opacity-60"
                >
                  <Icono nombre={paso.icono} />
                  {pendiente ? 'Guardando…' : paso.texto}
                </button>
              )}
              {atajoEntregar && (
                <button
                  type="button"
                  onClick={() => avanzar('entregado')}
                  disabled={pendiente}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-rosa-300 px-4 py-2 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-60"
                >
                  <Icono nombre="vender" />
                  Entregar ya
                </button>
              )}
            </>
          )}
        </section>
      )}

      {puedeCobrar && saldo > 0 && estado !== 'cancelado' && (
        <form onSubmit={cobrar} className="tarjeta p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Cobrar</h2>
            <span className="text-sm text-tinta-suave">
              Falta <strong className="text-lg text-tinta">{bs(saldo)}</strong>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setMetodo(m.valor)}
                aria-pressed={metodo === m.valor}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 text-sm font-medium transition ${
                  metodo === m.valor
                    ? 'border-rosa-600 bg-rosa-50 text-rosa-700'
                    : 'border-linea bg-white text-tinta-suave hover:border-rosa-300'
                }`}
              >
                <Icono nombre={m.icono} />
                {m.etiqueta}
              </button>
            ))}
          </div>

          <label htmlFor="monto" className="mt-3 block text-sm font-medium">
            ¿Cuánto paga?
          </label>
          <input
            id="monto"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            className="campo mt-1 text-lg focus:campo-foco"
          />

          {metodo !== 'efectivo' && (
            <>
              <label htmlFor="referencia" className="mt-3 block text-sm font-medium">
                Nº de transacción <span className="font-normal text-tinta-suave">(si tiene)</span>
              </label>
              <input
                id="referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="campo mt-1 focus:campo-foco"
              />
            </>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ok px-4 py-2.5 text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Icono nombre="efectivo" />
            {pendiente ? 'Guardando…' : `Cobrar ${bs(Number(monto.replace(',', '.')) || 0)}`}
          </button>
        </form>
      )}

      {puedeCobrar && saldo <= 0 && estado !== 'cancelado' && (
        <p className="tarjeta flex items-center gap-2 p-4 font-medium text-ok">
          <Icono nombre="listo" />
          Pagado completo
        </p>
      )}

      {aviso && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 ${aviso.ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'}`}
        >
          {aviso.texto}
        </p>
      )}

      {puedeEditar && !cerrado && (
        <div className="text-center">
          <BotonConfirmar
            pregunta={`¿Cancelar ${codigo}? Después no se puede volver atrás.`}
            si="Sí, cancelar"
            disabled={pendiente}
            alConfirmar={() => avanzar('cancelado')}
          >
            Cancelar este pedido
          </BotonConfirmar>
        </div>
      )}
    </div>
  )
}
