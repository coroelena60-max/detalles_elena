'use client'

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  agregarLinea,
  cambiarCantidadLinea,
  obtenerSnapshot,
  obtenerSnapshotServidor,
  quitarLinea,
  suscribir,
  vaciarCarrito,
} from './almacen'
import {
  cantidadTotal,
  claveLinea,
  totalCarrito,
  type LineaCarrito,
  type TipoLinea,
} from './tipos'

interface ContextoCarrito {
  lineas: LineaCarrito[]
  total: number
  cantidad: number
  /** false durante el render del servidor y la hidratación */
  listo: boolean
  agregar: (linea: Omit<LineaCarrito, 'clave' | 'cantidad'>, cantidad?: number) => void
  cambiarCantidad: (clave: string, cantidad: number) => void
  quitar: (clave: string) => void
  vaciar: () => void
  cantidadDe: (tipo: TipoLinea, id: number) => number
}

const Contexto = createContext<ContextoCarrito | null>(null)

const hidratadoCliente = () => true
const hidratadoServidor = () => false

export function CarritoProvider({ children }: { children: ReactNode }) {
  const lineas = useSyncExternalStore(
    suscribir,
    obtenerSnapshot,
    obtenerSnapshotServidor,
  )
  const listo = useSyncExternalStore(
    suscribir,
    hidratadoCliente,
    hidratadoServidor,
  )

  const valor = useMemo<ContextoCarrito>(
    () => ({
      lineas,
      total: totalCarrito(lineas),
      cantidad: cantidadTotal(lineas),
      listo,
      agregar: agregarLinea,
      cambiarCantidad: cambiarCantidadLinea,
      quitar: quitarLinea,
      vaciar: vaciarCarrito,
      cantidadDe: (tipo, id) =>
        lineas.find((l) => l.clave === claveLinea(tipo, id))?.cantidad ?? 0,
    }),
    [lineas, listo],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useCarrito() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}
