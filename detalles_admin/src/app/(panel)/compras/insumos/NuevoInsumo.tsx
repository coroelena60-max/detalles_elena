'use client'

import { useState } from 'react'
import { BOTON } from '@/components/ui'
import FormularioInsumo from './FormularioInsumo'

export default function NuevoInsumo({ proveedores }: { proveedores: { id: number; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={BOTON}>
        Nuevo insumo
      </button>
    )
  }
  return (
    <div className="w-full">
      <FormularioInsumo proveedores={proveedores} puedeEditar alCancelar={() => setAbierto(false)} />
    </div>
  )
}
