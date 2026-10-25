'use client'

import { useState } from 'react'
import Icono from '@/components/Icono'
import { Aviso, BOTON, BOTON_SUAVE } from '@/components/ui'
import { bs } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { ajustarPrecioItem } from '../acciones'
import AjusteLinea, { ajusteParaGuardar, monto, precioConAjuste, type Ajuste } from '../AjusteLinea'

/**
 * Cambiar el precio de una línea de una venta ya registrada (o sumarle algo
 * escrito a mano). Es la misma pieza que se usa al vender, pero acá se guarda
 * contra la base: ella revisa el permiso, se niega si ya se entregó y recalcula
 * el total.
 */
export default function EditarPrecio({
  codigo,
  itemId,
  nombre,
  cantidad,
  precioRamo,
  extrasLibres,
}: {
  codigo: string
  itemId: number
  nombre: string
  cantidad: number
  /** lo que vale el ramo hoy, sin los extras escritos a mano */
  precioRamo: number
  extrasLibres: { nombre: string; precio: number }[]
}) {
  const { pendiente, aviso, setAviso, ejecutar } = useAccion()
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState<Ajuste>({ precio: '', extras: [] })

  function abrir() {
    setValor({
      precio: String(precioRamo),
      extras: extrasLibres.map((e) => ({ nombre: e.nombre, precio: String(e.precio) })),
    })
    setAviso(null)
    setAbierto(true)
  }

  function guardar() {
    const a = ajusteParaGuardar(valor)
    // si el precio quedó igual, no hace falta tocarlo
    const precio = a.precio !== null && a.precio !== precioRamo ? a.precio : null
    ejecutar(
      () => ajustarPrecioItem(codigo, itemId, precio, a.extras),
      (r) => {
        if (r.ok) setAbierto(false)
      },
    )
  }

  if (!abierto) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={abrir}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-rosa-700 hover:underline"
        >
          <Icono nombre="billetera" className="size-4" />
          Cambiar precio o agregar algo
        </button>
        {aviso && <Aviso ok={aviso.ok} texto={aviso.texto} />}
      </div>
    )
  }

  const nuevo = precioConAjuste(monto(valor.precio), { precio: '', extras: valor.extras })

  return (
    <div className="mt-2 rounded-lg border border-linea p-3">
      <AjusteLinea nombre={nombre} precioLista={precioRamo} valor={valor} alCambiar={setValor} />

      <p className="mt-3 flex items-baseline justify-between border-t border-linea pt-2 text-sm">
        <span className="text-tinta-suave">Queda en</span>
        <span className="text-lg font-semibold tabular-nums">
          {bs(nuevo * cantidad)}
          {cantidad > 1 && <span className="ml-1 text-sm font-normal text-tinta-suave">({bs(nuevo)} c/u)</span>}
        </span>
      </p>

      {aviso && <Aviso ok={aviso.ok} texto={aviso.texto} />}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={guardar} disabled={pendiente} className={BOTON}>
          <Icono nombre="listo" />
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} disabled={pendiente} className={BOTON_SUAVE}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
