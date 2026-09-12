'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import ImagenCatalogo from '@/components/ImagenCatalogo'
import { useCarrito } from '@/lib/carrito/CarritoProvider'
import type { ExtraDeLinea } from '@/lib/carrito/tipos'
import { bs, espacios as fmtEspacios } from '@/lib/formato'
import type { Envoltorio, Extra, ExtraCategoria } from '@/types/database'

interface Props {
  envoltorios: Envoltorio[]
  extras: Extra[]
  categorias: ExtraCategoria[]
}

/**
 * "Armá tu ramo": envoltorio + extras, con la misma regla de capacidad que
 * valida crear_pedido(). Acá la regla se repite solo para guiar al cliente;
 * la que manda es la de la base, que recalcula precios y vuelve a chequear
 * los espacios al crear el pedido.
 */
export default function ArmadoPersonalizado({
  envoltorios,
  extras,
  categorias,
}: Props) {
  const router = useRouter()
  const { agregar } = useCarrito()

  const estilos = useMemo(() => {
    const vistos = new Map<string, { slug: string; nombre: string }>()
    for (const e of envoltorios) {
      if (!vistos.has(e.estilo_slug))
        vistos.set(e.estilo_slug, { slug: e.estilo_slug, nombre: e.estilo_nombre })
    }
    return [...vistos.values()]
  }, [envoltorios])

  const [estiloSlug, setEstiloSlug] = useState(estilos[0]?.slug ?? '')
  const [envoltorioId, setEnvoltorioId] = useState<number | null>(null)
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [dedicatoria, setDedicatoria] = useState('')
  const [agregado, setAgregado] = useState(false)

  const deEstilo = envoltorios.filter((e) => e.estilo_slug === estiloSlug)
  const envoltorio = envoltorios.find((e) => e.id === envoltorioId) ?? null

  const elegidos = useMemo(
    () =>
      extras
        .map((x) => ({ extra: x, cantidad: cantidades[x.id] ?? 0 }))
        .filter((e) => e.cantidad > 0),
    [extras, cantidades],
  )

  const capacidad = envoltorio?.espacios ?? null
  const usados = elegidos.reduce(
    (s, e) => s + Number(e.extra.espacios) * e.cantidad,
    0,
  )
  const libres = capacidad === null ? null : Math.max(0, capacidad - usados)
  const pasado = capacidad !== null && usados > capacidad

  const totalExtras = elegidos.reduce(
    (s, e) => s + Number(e.extra.precio) * e.cantidad,
    0,
  )
  const total = (envoltorio?.precio_base ?? 0) + totalExtras

  /** ¿Entra una unidad más de este extra? */
  function cabe(extra: Extra): boolean {
    if (capacidad === null) return true
    return usados + Number(extra.espacios) <= capacidad
  }

  function cambiar(extraId: number, delta: number) {
    setCantidades((prev) => {
      const actual = prev[extraId] ?? 0
      const siguiente = Math.max(0, Math.min(99, actual + delta))
      const copia = { ...prev }
      if (siguiente === 0) delete copia[extraId]
      else copia[extraId] = siguiente
      return copia
    })
  }

  function elegirEnvoltorio(id: number) {
    setEnvoltorioId(id)
    setAgregado(false)
  }

  function alAgregar() {
    if (!envoltorio || elegidos.length === 0 || pasado) return
    const extrasLinea: ExtraDeLinea[] = elegidos.map((e) => ({
      extraId: e.extra.id,
      nombre: e.extra.nombre,
      precio: Number(e.extra.precio),
      cantidad: e.cantidad,
    }))
    agregar({
      tipo: 'personalizado',
      referenciaId: envoltorio.id,
      nombre: `Ramo armado · ${envoltorio.estilo_nombre} ${envoltorio.tamano_codigo}`,
      precio: total,
      imagen: elegidos[0]?.extra.imagen_url ?? null,
      extras: extrasLinea,
      ...(dedicatoria.trim() ? { dedicatoria: dedicatoria.trim().slice(0, 300) } : {}),
    })
    setAgregado(true)
    router.push('/pedido')
  }

  const grupos = categorias
    .map((c) => ({
      categoria: c,
      items: extras.filter((x) => x.extra_categoria_id === c.id),
    }))
    .filter((g) => g.items.length > 0)
  const sinCategoria = extras.filter((x) => x.extra_categoria_id === null)
  if (sinCategoria.length > 0) {
    grupos.push({
      categoria: { id: -1, nombre: 'Otros', slug: 'otros', orden: 99 },
      items: sinCategoria,
    })
  }

  return (
    <div className="contenedor py-8 pb-40">
      <h1 className="text-2xl font-semibold">Armá tu ramo</h1>
      <p className="mt-2 max-w-2xl text-sm text-tinta-suave">
        Elegí el envoltorio y ponele las flores y detalles que quieras. Cada tamaño
        tiene un espacio limitado: el armador te avisa cuánto te queda. El precio se
        confirma con nosotras por WhatsApp.
      </p>

      {/* ---------------- Paso 1: envoltorio ---------------- */}
      <section className="mt-8" aria-labelledby="paso-envoltorio">
        <h2 id="paso-envoltorio" className="text-lg font-semibold">
          1 · El envoltorio
        </h2>

        <div role="tablist" aria-label="Estilos" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {estilos.map((e) => (
            <button
              key={e.slug}
              type="button"
              role="tab"
              aria-selected={e.slug === estiloSlug}
              onClick={() => setEstiloSlug(e.slug)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                e.slug === estiloSlug
                  ? 'bg-rosa-500 font-medium text-white'
                  : 'border border-rosa-300 text-rosa-700 hover:bg-rosa-50'
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deEstilo.map((e) => {
            const activo = e.id === envoltorioId
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => elegirEnvoltorio(e.id)}
                  aria-pressed={activo}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    activo
                      ? 'border-rosa-500 bg-rosa-50 ring-1 ring-rosa-500'
                      : 'border-rosa-200 bg-white hover:border-rosa-300'
                  }`}
                >
                  <p className="text-sm font-medium">
                    {e.tamano_nombre}{' '}
                    <span className="text-tinta-suave">({e.tamano_codigo})</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-rosa-700">
                    desde {bs(e.precio_base)}
                  </p>
                  <p className="mt-1 text-xs text-tinta-suave">
                    {e.espacios === null
                      ? 'Capacidad a consultar'
                      : `Caben ${fmtEspacios(e.espacios)} espacios`}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---------------- Paso 2: extras ---------------- */}
      <section className="mt-10" aria-labelledby="paso-extras">
        <h2 id="paso-extras" className="text-lg font-semibold">
          2 · Qué le ponemos
        </h2>

        {!envoltorio ? (
          <p className="mt-4 rounded-2xl border border-rosa-200 bg-white p-5 text-sm text-tinta-suave">
            Elegí primero un envoltorio y te mostramos cuánto espacio tenés.
          </p>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border border-rosa-200 bg-white p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-tinta-suave">
                  {capacidad === null
                    ? 'Este envoltorio no tiene capacidad definida'
                    : `Ocupado ${fmtEspacios(usados)} de ${fmtEspacios(capacidad)} espacios`}
                </span>
                {libres !== null && (
                  <strong className={pasado ? 'text-rosa-700' : ''}>
                    {pasado ? 'No entra todo' : `Queda ${fmtEspacios(libres)}`}
                  </strong>
                )}
              </div>
              {capacidad !== null && (
                <div
                  role="progressbar"
                  aria-valuenow={Math.min(usados, capacidad)}
                  aria-valuemin={0}
                  aria-valuemax={capacidad}
                  aria-label="Espacio usado en el envoltorio"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-rosa-100"
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      pasado ? 'bg-rosa-700' : 'bg-rosa-400'
                    }`}
                    style={{
                      width: `${Math.min(100, (usados / capacidad) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-tinta-suave">
                Una rosa ocupa 1 espacio, un girasol 2, una corona o una tarjeta
                ninguno.
              </p>
            </div>

            {grupos.map((g) => (
              <div key={g.categoria.id} className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
                  {g.categoria.nombre}
                </h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((x) => {
                    const cantidad = cantidades[x.id] ?? 0
                    const puede = cabe(x)
                    return (
                      <li
                        key={x.id}
                        className={`flex items-center gap-3 rounded-2xl border bg-white p-3 ${
                          cantidad > 0 ? 'border-rosa-400' : 'border-rosa-200'
                        }`}
                      >
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                          <ImagenCatalogo
                            src={x.imagen_url}
                            alt={x.nombre}
                            sizes="56px"
                            className="size-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{x.nombre}</p>
                          <p className="text-xs text-tinta-suave">
                            {bs(x.precio)} ·{' '}
                            {Number(x.espacios) === 0
                              ? 'no ocupa espacio'
                              : `${fmtEspacios(Number(x.espacios))} espacio${
                                  Number(x.espacios) === 1 ? '' : 's'
                                }`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => cambiar(x.id, -1)}
                            disabled={cantidad === 0}
                            aria-label={`Quitar una unidad de ${x.nombre}`}
                            className="size-8 rounded-full border border-rosa-200 text-sm disabled:opacity-40 hover:bg-rosa-50"
                          >
                            −
                          </button>
                          <span
                            aria-live="polite"
                            className="w-7 text-center text-sm font-medium"
                          >
                            {cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiar(x.id, 1)}
                            disabled={!puede}
                            aria-label={
                              puede
                                ? `Agregar una unidad de ${x.nombre}`
                                : `${x.nombre} no entra en el espacio que queda`
                            }
                            title={puede ? undefined : 'No queda espacio en este tamaño'}
                            className="size-8 rounded-full border border-rosa-200 text-sm disabled:opacity-40 hover:bg-rosa-50"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            <div className="mt-6">
              <label htmlFor="dedicatoria" className="text-sm font-medium">
                Dedicatoria (opcional)
              </label>
              <textarea
                id="dedicatoria"
                name="dedicatoria"
                rows={2}
                maxLength={300}
                value={dedicatoria}
                onChange={(ev) => setDedicatoria(ev.target.value)}
                placeholder="Feliz cumple, mamá"
                className="mt-1 w-full rounded-xl border border-rosa-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rosa-400"
              />
            </div>
          </>
        )}
      </section>

      {/* ---------------- Resumen fijo ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rosa-200 bg-white/95 backdrop-blur">
        <div className="contenedor flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {envoltorio
                ? `${envoltorio.estilo_nombre} ${envoltorio.tamano_codigo}`
                : 'Sin envoltorio elegido'}
            </p>
            <p className="text-xs text-tinta-suave">
              {elegidos.length === 0
                ? 'Todavía no elegiste flores'
                : `${elegidos.reduce((s, e) => s + e.cantidad, 0)} ítems · ${bs(
                    totalExtras,
                  )} en extras`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-tinta-suave">Total</p>
            <strong className="text-lg">{bs(total)}</strong>
          </div>
          <button
            type="button"
            onClick={alAgregar}
            disabled={!envoltorio || elegidos.length === 0 || pasado}
            className="shrink-0 rounded-full bg-rosa-500 px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-rosa-200 disabled:text-tinta-suave hover:bg-rosa-600"
          >
            {agregado ? 'Agregado' : 'Agregar a mi pedido'}
          </button>
        </div>
        {pasado && (
          <p aria-live="polite" className="contenedor pb-3 text-xs text-rosa-700">
            Sacá algo o elegí un tamaño más grande: te pasaste por{' '}
            {fmtEspacios(usados - (capacidad ?? 0))} espacios.
          </p>
        )}
        <p className="contenedor pb-3 text-xs text-tinta-suave">
          El envío no está incluido.{' '}
          <Link href="/pedido" className="text-rosa-700 hover:underline">
            Ver mi pedido
          </Link>
        </p>
      </div>
    </div>
  )
}
