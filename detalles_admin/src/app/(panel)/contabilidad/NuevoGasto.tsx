'use client'

import { useState } from 'react'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import { METODOS_PAGO, type MetodoPago } from '@/lib/estados'
import { hoyBolivia } from '@/lib/fechas'
import { useAccion } from '@/lib/useAccion'
import { registrarGasto } from './acciones'

export default function NuevoGasto({
  categorias,
}: {
  categorias: { id: number; nombre: string; descripcion: string | null }[]
}) {
  const { pendiente, aviso, ejecutar, setAviso } = useAccion()
  const [abierto, setAbierto] = useState(false)

  const vacio = {
    fecha: hoyBolivia(),
    categoriaId: 0,
    descripcion: '',
    monto: '',
    metodo: 'efectivo' as MetodoPago,
    comprobante: '',
    nota: '',
  }
  const [d, setD] = useState(vacio)
  const categoria = categorias.find((c) => c.id === d.categoriaId)

  if (!abierto) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setAbierto(true)
            setAviso(null)
          }}
          className={BOTON}
        >
          Registrar gasto
        </button>
        {aviso && <Aviso {...aviso} />}
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ejecutar(
          () => registrarGasto(d),
          (r) => {
            if (r.ok) {
              setD({ ...vacio, fecha: d.fecha, metodo: d.metodo })
              setAbierto(false)
            }
          },
        )
      }}
      className="tarjeta mt-4 w-full p-4"
    >
      <h2 className="text-sm font-semibold">Nuevo gasto</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Plata que sale y no vuelve como mercadería. Si compraste papel, cinta o peluches para
        armar ramos, eso es una <strong>compra</strong>, no un gasto.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="g-fecha" className="block text-sm font-medium">
            Fecha
          </label>
          <input
            id="g-fecha"
            type="date"
            required
            max={hoyBolivia()}
            value={d.fecha}
            onChange={(e) => setD({ ...d, fecha: e.target.value })}
            className={CAMPO}
          />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="g-cat" className="block text-sm font-medium">
            Tipo de gasto
          </label>
          <select
            id="g-cat"
            required
            value={d.categoriaId || ''}
            onChange={(e) => setD({ ...d, categoriaId: Number(e.target.value) })}
            className={CAMPO}
          >
            <option value="" disabled>
              Elegí…
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {categoria?.descripcion && (
            <p className="mt-1 text-xs text-tinta-suave">{categoria.descripcion}</p>
          )}
        </div>
        <div>
          <label htmlFor="g-monto" className="block text-sm font-medium">
            Monto (Bs)
          </label>
          <input
            id="g-monto"
            inputMode="decimal"
            required
            placeholder="0,00"
            value={d.monto}
            onChange={(e) => setD({ ...d, monto: e.target.value })}
            className={`${CAMPO} text-right tabular-nums`}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="g-desc" className="block text-sm font-medium">
            En qué se gastó
          </label>
          <input
            id="g-desc"
            required
            placeholder="Publicidad en TikTok, semana del 8"
            value={d.descripcion}
            onChange={(e) => setD({ ...d, descripcion: e.target.value })}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="g-metodo" className="block text-sm font-medium">
            Cómo se pagó
          </label>
          <select
            id="g-metodo"
            value={d.metodo}
            onChange={(e) => setD({ ...d, metodo: e.target.value as MetodoPago })}
            className={CAMPO}
          >
            {Object.entries(METODOS_PAGO).map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="g-comp" className="block text-sm font-medium">
            Nº de comprobante
          </label>
          <input
            id="g-comp"
            placeholder="Opcional"
            value={d.comprobante}
            onChange={(e) => setD({ ...d, comprobante: e.target.value })}
            className={CAMPO}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="g-nota" className="block text-sm font-medium">
            Nota
          </label>
          <input
            id="g-nota"
            placeholder="Opcional"
            value={d.nota}
            onChange={(e) => setD({ ...d, nota: e.target.value })}
            className={CAMPO}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pendiente} className={BOTON}>
          {pendiente ? 'Guardando…' : 'Guardar gasto'}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
          className={BOTON_SECUNDARIO}
        >
          Cancelar
        </button>
      </div>
      {aviso && <Aviso {...aviso} />}
    </form>
  )
}
