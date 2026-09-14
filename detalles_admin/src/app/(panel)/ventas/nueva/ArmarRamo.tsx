'use client'

import { useMemo, useState } from 'react'
import Miniatura from '@/components/Miniatura'
import { BOTON } from '@/components/ui'
import { bs, numero } from '@/lib/formato'

export interface Envoltorio {
  id: number
  estilo: string
  tamano: string
  precio: number
  /** espacios que entran; null = sin límite */
  capacidad: number | null
  orden: number
}

export interface ExtraArmado {
  id: number
  nombre: string
  precio: number
  espacios: number
  imagen: string | null
}

export interface RamoArmado {
  envoltorioId: number
  nombre: string
  precio: number
  imagen: string | null
  extras: { id: number; nombre: string; cantidad: number }[]
}

/**
 * El mismo armador del catálogo: envoltorio + extras con la regla de espacios.
 * La regla está repetida acá solo para guiar; la que manda es crear_pedido().
 */
export default function ArmarRamo({
  envoltorios,
  extras,
  alAgregar,
}: {
  envoltorios: Envoltorio[]
  extras: ExtraArmado[]
  alAgregar: (ramo: RamoArmado) => void
}) {
  const [envId, setEnvId] = useState<number | null>(null)
  const [cant, setCant] = useState<Record<number, number>>({})
  const [busqueda, setBusqueda] = useState('')

  const env = envoltorios.find((e) => e.id === envId) ?? null
  const estilos = useMemo(() => [...new Set(envoltorios.map((e) => e.estilo))], [envoltorios])

  const elegidos = extras.filter((e) => (cant[e.id] ?? 0) > 0)
  const usados = elegidos.reduce((s, e) => s + e.espacios * cant[e.id], 0)
  const precio = (env?.precio ?? 0) + elegidos.reduce((s, e) => s + e.precio * cant[e.id], 0)
  const capacidad = env?.capacidad ?? null

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return t ? extras.filter((e) => e.nombre.toLowerCase().includes(t)) : extras
  }, [busqueda, extras])

  function cabe(e: ExtraArmado) {
    return capacidad === null || usados + e.espacios <= capacidad
  }

  function cambiar(id: number, delta: number) {
    setCant((c) => {
      const n = Math.max(0, Math.min(99, (c[id] ?? 0) + delta))
      const copia = { ...c }
      if (n === 0) delete copia[id]
      else copia[id] = n
      return copia
    })
  }

  function elegirEnvoltorio(id: number) {
    const nuevo = envoltorios.find((e) => e.id === id)
    setEnvId(id)
    // si el tamaño nuevo es más chico y ya no entra, se vacían los extras
    if (nuevo?.capacidad != null && usados > nuevo.capacidad) setCant({})
  }

  function agregar() {
    if (!env) return
    alAgregar({
      envoltorioId: env.id,
      nombre: `Ramo personalizado ${env.estilo} ${env.tamano}`,
      precio,
      imagen: elegidos.find((e) => e.imagen)?.imagen ?? null,
      extras: elegidos.map((e) => ({ id: e.id, nombre: e.nombre, cantidad: cant[e.id] })),
    })
    setEnvId(null)
    setCant({})
    setBusqueda('')
  }

  return (
    <div>
      <p className="font-semibold">1. Elegí el envoltorio</p>
      {envoltorios.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-suave">No hay envoltorios cargados.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {estilos.map((estilo) => (
            <div key={estilo} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-sm text-tinta-suave">{estilo}</span>
              {envoltorios
                .filter((e) => e.estilo === estilo)
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => elegirEnvoltorio(e.id)}
                    aria-pressed={e.id === envId}
                    title={e.capacidad === null ? 'Sin límite' : `Entran ${numero(e.capacidad)} lugares`}
                    className={`min-h-11 rounded-lg border-2 px-3 py-1.5 text-sm transition ${
                      e.id === envId
                        ? 'border-rosa-600 bg-rosa-600 text-white'
                        : 'border-linea bg-white hover:border-rosa-300'
                    }`}
                  >
                    <span className="font-medium">{e.tamano || estilo}</span>{' '}
                    <span className={e.id === envId ? 'text-white/80' : 'text-tinta-suave'}>{bs(e.precio)}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {env && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">2. Agregá flores y extras</p>
            <span className="text-sm text-tinta-suave">
              {capacidad === null
                ? `${numero(usados)} lugares usados`
                : `Lleno: ${numero(usados)} de ${numero(capacidad)} lugares`}
            </span>
          </div>
          {capacidad !== null && (
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-rosa-50">
              <div
                className={`h-full rounded-full ${usados >= capacidad ? 'bg-alerta' : 'bg-rosa-500'}`}
                style={{ width: `${Math.min(100, (usados / capacidad) * 100)}%` }}
              />
            </div>
          )}
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un extra…"
            aria-label="Buscar un extra para el ramo"
            className="campo mt-2 focus:campo-foco"
          />
          <ul className="mt-2 max-h-80 divide-y divide-linea overflow-y-auto">
            {visibles.map((e) => {
              const c = cant[e.id] ?? 0
              return (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <Miniatura url={e.imagen} alt={e.nombre} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{e.nombre}</p>
                    <p className="text-xs text-tinta-suave">
                      {bs(e.precio)} · ocupa {numero(e.espacios)}
                    </p>
                  </div>
                  {c > 0 && (
                    <>
                      <button type="button" onClick={() => cambiar(e.id, -1)} aria-label={`Quitar ${e.nombre}`} className="grid size-10 place-items-center rounded-full border border-linea text-xl leading-none">−</button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">{c}</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => cambiar(e.id, 1)}
                    disabled={!cabe(e)}
                    aria-label={`Agregar ${e.nombre}`}
                    title={cabe(e) ? undefined : 'Ya no entra: elegí un envoltorio más grande'}
                    className="grid size-10 place-items-center rounded-full border border-rosa-300 text-xl leading-none text-rosa-700 hover:bg-rosa-50 disabled:opacity-30"
                  >
                    +
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rosa-50 p-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {env.estilo} {env.tamano}
                {elegidos.length > 0 && (
                  <span className="font-normal text-tinta-suave">
                    {' '}· {elegidos.map((e) => `${cant[e.id]}× ${e.nombre}`).join(', ')}
                  </span>
                )}
              </p>
              <p className="text-lg font-semibold tabular-nums">{bs(precio)}</p>
            </div>
            <button type="button" onClick={agregar} disabled={elegidos.length === 0} className={BOTON}>
              Agregar a la venta
            </button>
          </div>
        </>
      )}
    </div>
  )
}
