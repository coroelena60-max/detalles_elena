'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { crearRol } from '../acciones'

export default function NuevoRol() {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)

  function guardar() {
    setError(null)
    iniciar(async () => {
      const r = await crearRol(nombre, descripcion)
      if (!r.ok) {
        setError(r.mensaje)
        return
      }
      // el rol nace vacío: lo útil es ir derecho a elegirle los permisos
      router.push(`/usuarios/roles/${r.id}`)
    })
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 rounded-lg border border-rosa-300 px-4 py-2 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50"
      >
        Nuevo rol
      </button>
    )
  }

  return (
    <section className="tarjeta mt-4 p-4">
      <h2 className="text-sm font-semibold">Nuevo rol</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre-rol" className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id="nombre-rol"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Repartidor"
            className="campo mt-1 focus:campo-foco"
          />
        </div>
        <div>
          <label htmlFor="desc-rol" className="block text-sm font-medium">
            Para qué sirve
          </label>
          <input
            id="desc-rol"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ve los pedidos listos y los marca entregados."
            className="campo mt-1 focus:campo-foco"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={guardar}
          className="rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
        >
          {pendiente ? 'Creando…' : 'Crear y elegir permisos'}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
          className="rounded-lg px-4 py-2 text-sm text-tinta-suave transition hover:bg-white"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
          {error}
        </p>
      )}
    </section>
  )
}
