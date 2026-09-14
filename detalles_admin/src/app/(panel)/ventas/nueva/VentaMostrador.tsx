'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Icono, { type NombreIcono } from '@/components/Icono'
import Miniatura from '@/components/Miniatura'
import { Aviso, BOTON, BOTON_SECUNDARIO, CAMPO } from '@/components/ui'
import type { MetodoPago } from '@/lib/estados'
import { bs } from '@/lib/formato'
import { venderEnMostrador, type LineaMostrador } from '../acciones'
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

type Pago = MetodoPago | 'despues'

const PAGOS: { valor: Pago; etiqueta: string; icono: NombreIcono }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo', icono: 'efectivo' },
  { valor: 'qr', etiqueta: 'QR', icono: 'qr' },
  { valor: 'transferencia', etiqueta: 'Transferencia', icono: 'transferencia' },
  { valor: 'despues', etiqueta: 'Paga después', icono: 'calendario' },
]

/** Botón grande de "elegir una opción" (cómo paga, se lo lleva, pestañas). */
function claseOpcion(activa: boolean) {
  return `flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
    activa
      ? 'border-rosa-600 bg-rosa-50 text-rosa-700'
      : 'border-linea bg-white text-tinta-suave hover:border-rosa-300 hover:text-tinta'
  }`
}

export default function VentaMostrador({
  vendibles,
  envoltorios,
  extras,
  cotizaciones,
  cotizacionInicial,
  puedeCobrar,
}: {
  vendibles: Vendible[]
  envoltorios: Envoltorio[]
  extras: ExtraArmado[]
  cotizaciones: CotizacionVendible[]
  cotizacionInicial: number | null
  puedeCobrar: boolean
}) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<{ texto: string; codigo?: string } | null>(null)
  const [hecha, setHecha] = useState<{ codigo: string; total: number; pago: Pago; entregada: boolean } | null>(null)

  const [pestana, setPestana] = useState<'catalogo' | 'armar' | 'cotizacion'>(
    cotizacionInicial ? 'cotizacion' : 'catalogo',
  )
  const [filtro, setFiltro] = useState<'todo' | 'producto' | 'extra'>('todo')
  const [busqueda, setBusqueda] = useState('')

  const [carrito, setCarrito] = useState<Record<string, { cantidad: number; dedicatoria: string }>>({})
  const [ramos, setRamos] = useState<(RamoArmado & { clave: string; cantidad: number; dedicatoria: string })[]>([])
  const [cots, setCots] = useState<Record<number, { cantidad: number; dedicatoria: string }>>(() =>
    cotizacionInicial && cotizaciones.some((c) => c.id === cotizacionInicial)
      ? { [cotizacionInicial]: { cantidad: 1, dedicatoria: '' } }
      : {},
  )
  const [dedicando, setDedicando] = useState<Set<string>>(new Set())

  const [conCliente, setConCliente] = useState(false)
  const [cliente, setCliente] = useState({ nombre: '', telefono: '' })
  const [conNota, setConNota] = useState(false)
  const [nota, setNota] = useState('')
  const [pago, setPago] = useState<Pago>(puedeCobrar ? 'efectivo' : 'despues')
  const [seLoLleva, setSeLoLleva] = useState(true)

  // si el botón de cobrar queda fuera de la pantalla, aparece una barra fija que lleva hasta él
  const zonaBoton = useRef<HTMLDivElement>(null)
  const [botonALaVista, setBotonALaVista] = useState(true)
  useEffect(() => {
    const zona = zonaBoton.current
    if (!zona) return
    const observador = new IntersectionObserver(([e]) => setBotonALaVista(e.isIntersecting), { threshold: 0.9 })
    observador.observe(zona)
    return () => observador.disconnect()
  }, [hecha])

  const encontrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return vendibles.filter(
      (v) => (filtro === 'todo' || v.tipo === filtro) && (!t || v.nombre.toLowerCase().includes(t)),
    )
  }, [busqueda, filtro, vendibles])

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
      detalle: r.extras.map((e) => `${e.cantidad} ${e.nombre}`).join(', '),
    })),
    ...Object.entries(cots)
      .filter(([, l]) => l.cantidad > 0)
      .flatMap(([id, l]) => {
        const c = cotizaciones.find((x) => x.id === Number(id))
        return c
          ? [{ clave: `c${c.id}`, tipo: 'cotizacion' as const, nombre: c.nombre, precio: c.precio, imagen: null, cantidad: l.cantidad, dedicatoria: l.dedicatoria }]
          : []
      }),
  ]
  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

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

  function empezarDeNuevo() {
    setHecha(null)
    setError(null)
    setCarrito({})
    setRamos([])
    setCots({})
    setDedicando(new Set())
    setConCliente(false)
    setCliente({ nombre: '', telefono: '' })
    setConNota(false)
    setNota('')
    setPago(puedeCobrar ? 'efectivo' : 'despues')
    setSeLoLleva(true)
    setBusqueda('')
  }

  function registrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
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
    setError(null)
    iniciar(async () => {
      const r = await venderEnMostrador(
        conCliente ? { ...cliente, email: '' } : null,
        payload,
        conNota ? nota : '',
        { metodo: pago === 'despues' ? null : pago, entregar: seLoLleva },
      )
      if (r.ok && r.codigo) {
        setHecha({ codigo: r.codigo, total: Number(r.total ?? total), pago, entregada: seLoLleva })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setError({ texto: r.mensaje, codigo: r.codigo })
      }
    })
  }

  if (hecha) {
    const metodo = PAGOS.find((p) => p.valor === hecha.pago)
    return (
      <div className="tarjeta mx-auto mt-6 max-w-lg p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-ok-suave text-ok">
          <Icono nombre="listo" className="size-9" />
        </span>
        <h2 className="mt-4 text-2xl font-semibold">¡Venta registrada!</h2>
        <p className="mt-1 font-mono text-tinta-suave">{hecha.codigo}</p>
        <p className="mt-4 text-4xl font-semibold tabular-nums">{bs(hecha.total)}</p>
        <p className="mt-2 text-tinta-suave">
          {hecha.pago === 'despues' ? 'Sin cobrar todavía' : `Cobrado · ${metodo?.etiqueta}`}
          {' · '}
          {hecha.entregada ? 'Entregado' : 'Se entrega otro día'}
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={empezarDeNuevo} className={`${BOTON} w-full`}>
            <Icono nombre="vender" />
            Nueva venta
          </button>
          <Link href={`/comprobante/${hecha.codigo}`} target="_blank" className={`${BOTON_SECUNDARIO} w-full`}>
            <Icono nombre="imprimir" />
            Comprobante
          </Link>
        </div>
        <Link href={`/ventas/${hecha.codigo}`} className="mt-4 inline-block text-sm text-rosa-700 hover:underline">
          Ver el detalle de la venta
        </Link>
      </div>
    )
  }

  return (
    <div className={`mt-5 grid items-start gap-5 lg:grid-cols-[1fr_24rem] ${lineas.length > 0 ? 'pb-24' : ''}`}>
      {/* ---------- Qué se lleva ---------- */}
      <section className="min-w-0">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap" role="tablist" aria-label="Qué vender">
          <button type="button" role="tab" aria-selected={pestana === 'catalogo'} onClick={() => setPestana('catalogo')} className={claseOpcion(pestana === 'catalogo')}>
            <Icono nombre="flor" />
            Ramos y extras
          </button>
          <button type="button" role="tab" aria-selected={pestana === 'armar'} onClick={() => setPestana('armar')} className={claseOpcion(pestana === 'armar')}>
            <Icono nombre="lapiz" />
            Armar un ramo
          </button>
          {cotizaciones.length > 0 && (
            <button type="button" role="tab" aria-selected={pestana === 'cotizacion'} onClick={() => setPestana('cotizacion')} className={claseOpcion(pestana === 'cotizacion')}>
              <Icono nombre="calculadora" />
              Cotizaciones
            </button>
          )}
        </div>

        {pestana === 'armar' ? (
          <div className="tarjeta mt-3 p-4">
            <ArmarRamo envoltorios={envoltorios} extras={extras} alAgregar={agregarRamo} />
          </div>
        ) : pestana === 'cotizacion' ? (
          <ul className="tarjeta mt-3 divide-y divide-linea">
            {cotizaciones.map((c) => {
              const n = cots[c.id]?.cantidad ?? 0
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => cambiar(`c${c.id}`, 1)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-rosa-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.nombre}</span>
                      <span className="text-sm text-tinta-suave">{bs(c.precio)}</span>
                    </span>
                    {n > 0 && <span className="rounded-full bg-rosa-600 px-2.5 py-0.5 text-sm font-semibold text-white">{n}</span>}
                    <span className="grid size-10 place-items-center rounded-full bg-rosa-100 text-rosa-700">
                      <Icono nombre="sumar" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="relative min-w-48 flex-1">
                <span className="sr-only">Buscar</span>
                <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta-suave" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  className="campo min-h-12 pl-10 focus:campo-foco"
                />
              </label>
              <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-linea">
                {([['todo', 'Todo'], ['producto', 'Ramos'], ['extra', 'Extras']] as const).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltro(valor)}
                    aria-pressed={filtro === valor}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      filtro === valor ? 'bg-rosa-600 text-white' : 'text-tinta-suave hover:bg-rosa-50'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>

            {encontrados.length === 0 ? (
              <p className="tarjeta mt-3 p-6 text-center text-tinta-suave">No hay nada con ese nombre.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {encontrados.map((v) => {
                  const c = carrito[v.clave]?.cantidad ?? 0
                  return (
                    <li key={v.clave}>
                      <button
                        type="button"
                        onClick={() => cambiar(v.clave, 1)}
                        aria-label={`Agregar ${v.nombre}`}
                        className={`group relative flex h-full w-full flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition ${
                          c > 0 ? 'border-rosa-600' : 'border-transparent ring-1 ring-linea hover:ring-rosa-300'
                        }`}
                      >
                        <span className="relative block aspect-square w-full bg-rosa-50">
                          {v.imagen ? (
                            <Image src={v.imagen} alt="" fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" />
                          ) : (
                            <span aria-hidden className="grid size-full place-items-center text-4xl text-rosa-300">❀</span>
                          )}
                          {c > 0 && (
                            <span className="absolute right-2 top-2 grid min-w-9 place-items-center rounded-full bg-rosa-600 px-2 py-1 text-base font-semibold text-white shadow">
                              {c}
                            </span>
                          )}
                          <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-white/95 text-rosa-700 shadow transition group-hover:bg-rosa-600 group-hover:text-white">
                            <Icono nombre="sumar" />
                          </span>
                        </span>
                        <span className="flex flex-1 flex-col p-2.5">
                          <span className="line-clamp-2 text-sm leading-snug">{v.nombre}</span>
                          <span className="mt-auto pt-1 text-base font-semibold tabular-nums">{bs(v.precio)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ---------- El ticket ---------- */}
      {/* En computadora el ticket queda fijo con su propio scroll y el botón siempre a la vista */}
      <form
        id="ticket"
        onSubmit={registrar}
        className="min-w-0 scroll-mt-4 space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
      >
        <section className="tarjeta p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icono nombre="vender" />
            Venta
            {unidades > 0 && <span className="text-base font-normal text-tinta-suave">· {unidades}</span>}
          </h2>

          {lineas.length === 0 ? (
            <p className="mt-3 rounded-lg bg-rosa-50 p-4 text-center text-tinta-suave">
              Tocá un producto para agregarlo.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-linea">
              {lineas.map((l) => {
                const abierta = dedicando.has(l.clave) || l.dedicatoria !== ''
                return (
                  <li key={l.clave} className="py-3">
                    <div className="flex items-center gap-3">
                      <Miniatura url={l.imagen} alt={l.nombre} className="size-12" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-snug">{l.nombre}</p>
                        {l.detalle && <p className="truncate text-xs text-tinta-suave">{l.detalle}</p>}
                        <p className="text-sm font-semibold tabular-nums">{bs(l.precio * l.cantidad)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => cambiar(l.clave, -1)} aria-label={`Uno menos de ${l.nombre}`} className="grid size-9 place-items-center rounded-full border border-linea text-tinta-suave transition hover:border-alerta hover:text-alerta">
                          <Icono nombre={l.cantidad === 1 ? 'basura' : 'restar'} className="size-4" />
                        </button>
                        <span className="w-7 text-center font-semibold tabular-nums">{l.cantidad}</span>
                        <button type="button" onClick={() => cambiar(l.clave, 1)} aria-label={`Uno más de ${l.nombre}`} className="grid size-9 place-items-center rounded-full border border-rosa-300 text-rosa-700 transition hover:bg-rosa-50">
                          <Icono nombre="sumar" className="size-4" />
                        </button>
                      </div>
                    </div>
                    {l.tipo !== 'extra' &&
                      (abierta ? (
                        <input
                          aria-label={`Dedicatoria para ${l.nombre}`}
                          value={l.dedicatoria}
                          onChange={(e) => dedicar(l.clave, e.target.value)}
                          placeholder="Dedicatoria"
                          autoFocus={l.dedicatoria === ''}
                          className="campo mt-2 focus:campo-foco"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDedicando((s) => new Set(s).add(l.clave))}
                          className="mt-1 inline-flex items-center gap-1 text-sm text-rosa-700 hover:underline"
                        >
                          <Icono nombre="lapiz" className="size-4" />
                          Dedicatoria
                        </button>
                      ))}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-2 flex items-baseline justify-between border-t border-linea pt-3">
            <span className="text-lg">Total</span>
            <span className="text-3xl font-semibold tabular-nums">{bs(total)}</span>
          </div>
        </section>

        {puedeCobrar && (
          <section className="tarjeta p-4">
            <h2 className="font-semibold">¿Cómo paga?</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PAGOS.map((p) => (
                <button key={p.valor} type="button" onClick={() => setPago(p.valor)} aria-pressed={pago === p.valor} className={claseOpcion(pago === p.valor)}>
                  <Icono nombre={p.icono} />
                  {p.etiqueta}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="tarjeta p-4">
          <h2 className="font-semibold">¿Se lo lleva ahora?</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSeLoLleva(true)} aria-pressed={seLoLleva} className={claseOpcion(seLoLleva)}>
              <Icono nombre="listo" />
              Sí
            </button>
            <button type="button" onClick={() => setSeLoLleva(false)} aria-pressed={!seLoLleva} className={claseOpcion(!seLoLleva)}>
              <Icono nombre="calendario" />
              Otro día
            </button>
          </div>
        </section>

        <section className="tarjeta space-y-3 p-4">
          {conCliente ? (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Cliente</h2>
                <button type="button" onClick={() => setConCliente(false)} className="text-sm text-tinta-suave hover:text-alerta">
                  Quitar
                </button>
              </div>
              <input aria-label="Nombre del cliente" required value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} placeholder="Nombre" autoFocus className={CAMPO} />
              <input aria-label="Teléfono del cliente" required inputMode="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} placeholder="Teléfono" className={CAMPO} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-tinta-suave">
                <Icono nombre="usuario" />
                Cliente de paso
              </span>
              <button type="button" onClick={() => setConCliente(true)} className="inline-flex items-center gap-1 text-sm font-medium text-rosa-700 hover:underline">
                <Icono nombre="sumar" className="size-4" />
                Anotar cliente
              </button>
            </div>
          )}

          {conNota ? (
            <input aria-label="Nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota" autoFocus className={CAMPO} />
          ) : (
            <button type="button" onClick={() => setConNota(true)} className="inline-flex items-center gap-1 text-sm text-rosa-700 hover:underline">
              <Icono nombre="lapiz" className="size-4" />
              Agregar una nota
            </button>
          )}
        </section>

        {error && (
          <div>
            <Aviso ok={false} texto={error.texto} />
            {error.codigo && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/ventas/${error.codigo}`} className={BOTON_SECUNDARIO}>
                  Abrir la venta {error.codigo}
                </Link>
                <button type="button" onClick={empezarDeNuevo} className={BOTON_SECUNDARIO}>
                  Nueva venta
                </button>
              </div>
            )}
          </div>
        )}

        <div ref={zonaBoton} className="sticky bottom-0 bg-fondo pb-1 pt-2">
        <button
          type="submit"
          disabled={pendiente || lineas.length === 0 || Boolean(error?.codigo)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-rosa-600 px-4 text-lg font-semibold text-white shadow-sm transition hover:bg-rosa-700 disabled:opacity-50"
        >
          <Icono nombre="listo" className="size-6" />
          {pendiente
            ? 'Registrando…'
            : pago === 'despues'
              ? 'Registrar venta'
              : `Cobrar ${bs(total)}${seLoLleva ? ' y entregar' : ''}`}
        </button>
        </div>
      </form>

      {lineas.length > 0 && !botonALaVista && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-white/95 p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur">
          <button
            type="button"
            onClick={() => zonaBoton.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
            className="mx-auto flex min-h-13 w-full max-w-xl items-center justify-between gap-3 whitespace-nowrap rounded-xl bg-rosa-600 px-4 text-lg font-semibold text-white"
          >
            <span className="flex items-center gap-2">
              <span className="relative">
                <Icono nombre="vender" className="size-6" />
                <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-bold leading-5 text-rosa-700">
                  {unidades}
                </span>
              </span>
              <span className="ml-1">Ir a cobrar</span>
            </span>
            <span className="flex items-center gap-1">
              {bs(total)}
              <Icono nombre="siguiente" />
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
