'use client'

import { useMemo, useState } from 'react'
import { Aviso, BOTON, CAMPO } from '@/components/ui'
import { bs } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { crearVentaMostrador, type LineaMostrador } from '../acciones'

export interface Vendible {
  clave: string
  tipo: 'producto' | 'extra'
  id: number
  nombre: string
  precio: number
  detalle: string
}

export default function VentaMostrador({ vendibles }: { vendibles: Vendible[] }) {
  const { pendiente, aviso, ejecutar, router } = useAccion()
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', email: '' })
  const [sinCliente, setSinCliente] = useState(false)
  const [nota, setNota] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<Record<string, { cantidad: number; dedicatoria: string }>>({})

  const encontrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return (t ? vendibles.filter((v) => v.nombre.toLowerCase().includes(t)) : vendibles).slice(0, 40)
  }, [busqueda, vendibles])

  const lineas = Object.entries(carrito)
    .filter(([, l]) => l.cantidad > 0)
    .map(([clave, l]) => ({ ...vendibles.find((v) => v.clave === clave)!, ...l }))
  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)

  function cambiar(clave: string, delta: number) {
    setCarrito((c) => {
      const actual = c[clave] ?? { cantidad: 0, dedicatoria: '' }
      return { ...c, [clave]: { ...actual, cantidad: Math.min(99, Math.max(0, actual.cantidad + delta)) } }
    })
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="tarjeta p-4">
        <label htmlFor="v-buscar" className="block text-sm font-semibold">¿Qué se lleva?</label>
        <input
          id="v-buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un ramo o un extra…"
          className={CAMPO}
        />
        <ul className="mt-3 divide-y divide-linea">
          {encontrados.map((v) => {
            const c = carrito[v.clave]?.cantidad ?? 0
            return (
              <li key={v.clave} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{v.nombre}</p>
                  <p className="text-xs text-tinta-suave">{bs(v.precio)} · {v.detalle}</p>
                </div>
                {c > 0 && (
                  <>
                    <button type="button" onClick={() => cambiar(v.clave, -1)} aria-label={`Quitar ${v.nombre}`} className="grid size-8 place-items-center rounded-full border border-linea text-lg leading-none">−</button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">{c}</span>
                  </>
                )}
                <button type="button" onClick={() => cambiar(v.clave, 1)} aria-label={`Agregar ${v.nombre}`} className="grid size-8 place-items-center rounded-full border border-rosa-300 text-lg leading-none text-rosa-700 hover:bg-rosa-50">+</button>
              </li>
            )
          })}
          {encontrados.length === 0 && <li className="py-3 text-sm text-tinta-suave">No hay nada con ese nombre en el catálogo.</li>}
        </ul>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const payload: LineaMostrador[] = lineas.map((l) => ({ tipo: l.tipo, id: l.id, cantidad: l.cantidad, dedicatoria: l.dedicatoria }))
          ejecutar(
            () => crearVentaMostrador(sinCliente ? null : cliente, payload, nota),
            (r) => r.ok && r.codigo && router.push(`/ventas/${r.codigo}`),
          )
        }}
        className="h-fit space-y-4 lg:sticky lg:top-4"
      >
        <section className="tarjeta p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Cliente</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sinCliente}
                onChange={(e) => setSinCliente(e.target.checked)}
                className="size-4 accent-rosa-700"
              />
              Venta sin cliente
            </label>
          </div>
          {sinCliente ? (
            <p className="mt-2 rounded-lg bg-rosa-50 px-3 py-2 text-sm text-tinta-suave">
              Se registra como <strong className="text-tinta">S/C · Sin cliente</strong>. No hace falta nombre ni teléfono.
            </p>
          ) : (
          <>
          <div className="mt-2 space-y-2">
            <input aria-label="Nombre" required value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} placeholder="Nombre" className="campo focus:campo-foco" />
            <input aria-label="Teléfono" required inputMode="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} placeholder="Teléfono (70000000)" className="campo focus:campo-foco" />
            <input aria-label="Correo" type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} placeholder="Correo (opcional)" className="campo focus:campo-foco" />
          </div>
          <p className="mt-2 text-xs text-tinta-suave">Si el teléfono ya compró antes, se suma a su historial.</p>
          </>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="text-sm font-semibold">Venta</h2>
          {lineas.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">Todavía no agregaste nada.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {lineas.map((l) => (
                <li key={l.clave} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{l.cantidad} × {l.nombre}</span>
                    <span className="tabular-nums">{bs(l.precio * l.cantidad)}</span>
                  </div>
                  {l.tipo === 'producto' && (
                    <input
                      aria-label={`Dedicatoria para ${l.nombre}`}
                      value={l.dedicatoria}
                      onChange={(e) => setCarrito((c) => ({ ...c, [l.clave]: { ...c[l.clave], dedicatoria: e.target.value } }))}
                      placeholder="Dedicatoria (opcional)"
                      className="campo mt-1 py-1 text-xs focus:campo-foco"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <input aria-label="Nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className="campo mt-3 focus:campo-foco" />
          <div className="mt-3 flex items-baseline justify-between border-t border-linea pt-3">
            <span className="text-sm">Total estimado</span>
            <span className="text-2xl font-semibold tabular-nums">{bs(total)}</span>
          </div>
          <p className="text-xs text-tinta-suave">El total final lo calcula la base con los precios vigentes.</p>
          <button type="submit" disabled={pendiente || lineas.length === 0} className={`${BOTON} mt-3 w-full`}>
            {pendiente ? 'Registrando…' : 'Registrar venta'}
          </button>
          <p className="mt-2 text-xs text-tinta-suave">
            Queda confirmada. El cobro se anota en la ficha de la venta.
          </p>
          {aviso && !aviso.ok && <Aviso {...aviso} />}
        </section>
      </form>
    </div>
  )
}
