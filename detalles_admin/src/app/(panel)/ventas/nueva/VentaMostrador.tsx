'use client'

import { useMemo, useState } from 'react'
import Miniatura from '@/components/Miniatura'
import { Aviso, BOTON, CAMPO } from '@/components/ui'
import { bs } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import { crearVentaMostrador, type LineaMostrador } from '../acciones'
import ArmarRamo, { type Envoltorio, type ExtraArmado, type RamoArmado } from './ArmarRamo'

export interface Vendible {
  clave: string
  tipo: 'producto' | 'extra'
  id: number
  nombre: string
  precio: number
  detalle: string
  imagen: string | null
}

export interface CotizacionVendible {
  id: number
  codigo: string
  nombre: string
  precio: number
}

interface Linea {
  clave: string
  tipo: 'producto' | 'extra' | 'personalizado' | 'cotizacion'
  nombre: string
  precio: number
  imagen: string | null
  cantidad: number
  dedicatoria: string
  detalle?: string
}

export default function VentaMostrador({
  vendibles,
  envoltorios,
  extras,
  cotizaciones,
  cotizacionInicial,
}: {
  vendibles: Vendible[]
  envoltorios: Envoltorio[]
  extras: ExtraArmado[]
  cotizaciones: CotizacionVendible[]
  cotizacionInicial: number | null
}) {
  const { pendiente, aviso, ejecutar, router } = useAccion()
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', email: '' })
  const [sinCliente, setSinCliente] = useState(false)
  const [nota, setNota] = useState('')
  const [pestana, setPestana] = useState<'catalogo' | 'armar' | 'cotizacion'>('catalogo')
  const [cots, setCots] = useState<Record<number, { cantidad: number; dedicatoria: string }>>(() =>
    cotizacionInicial && cotizaciones.some((c) => c.id === cotizacionInicial)
      ? { [cotizacionInicial]: { cantidad: 1, dedicatoria: '' } }
      : {},
  )
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<Record<string, { cantidad: number; dedicatoria: string }>>({})
  const [ramos, setRamos] = useState<(RamoArmado & { clave: string; cantidad: number; dedicatoria: string })[]>([])

  const encontrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return (t ? vendibles.filter((v) => v.nombre.toLowerCase().includes(t)) : vendibles).slice(0, 40)
  }, [busqueda, vendibles])

  const lineas: Linea[] = [
    ...Object.entries(carrito)
      .filter(([, l]) => l.cantidad > 0)
      .map(([clave, l]) => ({ ...vendibles.find((v) => v.clave === clave)!, ...l, detalle: undefined })),
    ...ramos.map((r) => ({
      clave: r.clave,
      tipo: 'personalizado' as const,
      nombre: r.nombre,
      precio: r.precio,
      imagen: r.imagen,
      cantidad: r.cantidad,
      dedicatoria: r.dedicatoria,
      detalle: r.extras.map((e) => `${e.cantidad}× ${e.nombre}`).join(', '),
    })),
    ...Object.entries(cots)
      .filter(([, l]) => l.cantidad > 0)
      .flatMap(([id, l]) => {
        const c = cotizaciones.find((x) => x.id === Number(id))
        return c
          ? [{ clave: `c${c.id}`, tipo: 'cotizacion' as const, nombre: c.nombre, precio: c.precio, imagen: null, cantidad: l.cantidad, dedicatoria: l.dedicatoria, detalle: `según ${c.codigo}` }]
          : []
      }),
  ]
  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)

  function cambiar(clave: string, delta: number) {
    if (clave.startsWith('c')) {
      const id = Number(clave.slice(1))
      setCots((c) => {
        const actual = c[id] ?? { cantidad: 0, dedicatoria: '' }
        return { ...c, [id]: { ...actual, cantidad: Math.min(99, Math.max(0, actual.cantidad + delta)) } }
      })
      return
    }
    if (clave.startsWith('r')) {
      setRamos((rs) =>
        rs
          .map((r) => (r.clave === clave ? { ...r, cantidad: Math.min(99, r.cantidad + delta) } : r))
          .filter((r) => r.cantidad > 0),
      )
      return
    }
    setCarrito((c) => {
      const actual = c[clave] ?? { cantidad: 0, dedicatoria: '' }
      return { ...c, [clave]: { ...actual, cantidad: Math.min(99, Math.max(0, actual.cantidad + delta)) } }
    })
  }

  function dedicar(clave: string, texto: string) {
    if (clave.startsWith('c')) {
      const id = Number(clave.slice(1))
      setCots((c) => ({ ...c, [id]: { ...c[id], dedicatoria: texto } }))
    } else if (clave.startsWith('r')) {
      setRamos((rs) => rs.map((r) => (r.clave === clave ? { ...r, dedicatoria: texto } : r)))
    } else {
      setCarrito((c) => ({ ...c, [clave]: { ...c[clave], dedicatoria: texto } }))
    }
  }

  function agregarRamo(ramo: RamoArmado) {
    setRamos((rs) => [...rs, { ...ramo, clave: `r${Date.now()}`, cantidad: 1, dedicatoria: '' }])
    setPestana('catalogo')
  }

  const pestanaClase = (activa: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm transition ${
      activa ? 'bg-rosa-100 font-medium text-rosa-700' : 'text-tinta-suave hover:bg-rosa-50'
    }`

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="tarjeta p-4">
        <nav className="mb-3 flex gap-1" aria-label="Qué vender">
          <button type="button" onClick={() => setPestana('catalogo')} aria-pressed={pestana === 'catalogo'} className={pestanaClase(pestana === 'catalogo')}>
            Productos y extras
          </button>
          <button type="button" onClick={() => setPestana('armar')} aria-pressed={pestana === 'armar'} className={pestanaClase(pestana === 'armar')}>
            ❀ Armar ramo personalizado
          </button>
          {cotizaciones.length > 0 && (
            <button type="button" onClick={() => setPestana('cotizacion')} aria-pressed={pestana === 'cotizacion'} className={pestanaClase(pestana === 'cotizacion')}>
              Desde cotización
            </button>
          )}
        </nav>

        {pestana === 'cotizacion' ? (
          <ul className="divide-y divide-linea">
            {cotizaciones.map((c) => {
              const n = cots[c.id]?.cantidad ?? 0
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.nombre}</p>
                    <p className="text-xs text-tinta-suave">{bs(c.precio)} · {c.codigo}</p>
                  </div>
                  {n > 0 && <span className="w-6 text-center text-sm font-medium tabular-nums">{n}</span>}
                  <button type="button" onClick={() => cambiar(`c${c.id}`, 1)} aria-label={`Agregar ${c.nombre}`} className="grid size-8 place-items-center rounded-full border border-rosa-300 text-lg leading-none text-rosa-700 hover:bg-rosa-50">+</button>
                </li>
              )
            })}
          </ul>
        ) : pestana === 'armar' ? (
          <ArmarRamo envoltorios={envoltorios} extras={extras} alAgregar={agregarRamo} />
        ) : (
          <>
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
                  <li key={v.clave} className="flex items-center gap-3 py-2">
                    <Miniatura url={v.imagen} alt={v.nombre} />
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
          </>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const payload: LineaMostrador[] = [
            ...Object.entries(carrito)
              .filter(([, l]) => l.cantidad > 0)
              .map(([clave, l]) => {
                const v = vendibles.find((x) => x.clave === clave)!
                return { tipo: v.tipo, id: v.id, cantidad: l.cantidad, dedicatoria: l.dedicatoria }
              }),
            ...ramos.map((r) => ({
              tipo: 'personalizado' as const,
              id: r.envoltorioId,
              cantidad: r.cantidad,
              dedicatoria: r.dedicatoria,
              extras: r.extras.map((x) => ({ extra_id: x.id, cantidad: x.cantidad })),
            })),
            ...Object.entries(cots)
              .filter(([, l]) => l.cantidad > 0)
              .map(([id, l]) => ({ tipo: 'cotizacion' as const, id: Number(id), cantidad: l.cantidad, dedicatoria: l.dedicatoria })),
          ]
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
            <ul className="mt-2 space-y-3">
              {lineas.map((l) => (
                <li key={l.clave} className="text-sm">
                  <div className="flex items-start gap-2">
                    <Miniatura url={l.imagen} alt={l.nombre} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="min-w-0">{l.cantidad} × {l.nombre}</span>
                        <span className="shrink-0 tabular-nums">{bs(l.precio * l.cantidad)}</span>
                      </div>
                      {l.detalle && <p className="text-xs text-tinta-suave">{l.detalle}</p>}
                      {(l.tipo === 'personalizado' || l.tipo === 'cotizacion') && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          <button type="button" onClick={() => cambiar(l.clave, -1)} className="rounded border border-linea px-1.5" aria-label="Uno menos">−</button>
                          <button type="button" onClick={() => cambiar(l.clave, 1)} className="rounded border border-linea px-1.5" aria-label="Uno más">+</button>
                          <button type="button" onClick={() => cambiar(l.clave, -l.cantidad)} className="ml-1 text-tinta-suave hover:text-alerta">Quitar</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {l.tipo !== 'extra' && (
                    <input
                      aria-label={`Dedicatoria para ${l.nombre}`}
                      value={l.dedicatoria}
                      onChange={(e) => dedicar(l.clave, e.target.value)}
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
