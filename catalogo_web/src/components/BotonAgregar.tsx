'use client'

import { useState } from 'react'
import { useCarrito } from '@/lib/carrito/CarritoProvider'
import type { TipoLinea } from '@/lib/carrito/tipos'

interface Props {
  tipo: TipoLinea
  referenciaId: number
  nombre: string
  precio: number
  imagen: string | null
  agotado?: boolean
  variante?: 'principal' | 'compacto'
}

export default function BotonAgregar({
  tipo,
  referenciaId,
  nombre,
  precio,
  imagen,
  agotado = false,
  variante = 'principal',
}: Props) {
  const { agregar, cantidadDe } = useCarrito()
  const [agregado, setAgregado] = useState(false)
  const enCarrito = cantidadDe(tipo, referenciaId)

  if (agotado) {
    return (
      <span className="inline-block rounded-full bg-rosa-100 px-4 py-2 text-sm text-tinta-suave">
        Sin stock por ahora
      </span>
    )
  }

  const alHacerClic = () => {
    agregar({ tipo, referenciaId, nombre, precio, imagen })
    setAgregado(true)
    window.setTimeout(() => setAgregado(false), 1600)
  }

  const clases =
    variante === 'principal'
      ? 'w-full rounded-full bg-rosa-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-rosa-600'
      : 'rounded-full border border-rosa-300 px-3 py-1.5 text-xs font-medium text-rosa-700 transition hover:bg-rosa-100'

  return (
    <button type="button" onClick={alHacerClic} className={clases}>
      {agregado
        ? '¡Agregado!'
        : enCarrito > 0
          ? `Agregar otro (${enCarrito})`
          : 'Agregar al pedido'}
    </button>
  )
}
