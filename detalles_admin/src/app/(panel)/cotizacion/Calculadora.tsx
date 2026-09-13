'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Miniatura from '@/components/Miniatura'
import { Aviso, BOTON, BOTON_SECUNDARIO } from '@/components/ui'
import { bs, numero } from '@/lib/formato'
import { useAccion } from '@/lib/useAccion'
import {
  borrarCotizacion,
  convertirEnProducto,
  guardarCotizacion,
  type DatosCotizacion,
} from './acciones'

export interface Opciones {
  insumos: { id: number; nombre: string; unidad: string; costo: number }[]
  extras: { id: number; nombre: string; precio: number; costo: number; imagen: string | null }[]
  categorias: { id: number; nombre: string }[]
  costoHora: number
  margen: number
  puedeEditar: boolean
  puedeCrearInsumo: boolean
  puedeCrearProducto: boolean
  puedeVender: boolean
}

export interface Inicial {
  id: number
  codigo: string
  productoId: number | null
  datos: DatosCotizacion
}

/**
 * Cómo se compró: la presentación dice en qué unidad se usa y cuántas trae.
 * "1 docena de mariposas" = 12 unidades; "5 metros de cinta" = 5 metros.
 */
const PRESENTACIONES = [
  { clave: 'unidad', etiqueta: 'unidades', unidad: 'unidad', factor: 1, uso: 'unid.' },
  { clave: 'docena', etiqueta: 'docenas', unidad: 'unidad', factor: 12, uso: 'unid.' },
  { clave: 'media', etiqueta: 'medias docenas', unidad: 'unidad', factor: 6, uso: 'unid.' },
  { clave: 'ciento', etiqueta: 'cientos', unidad: 'unidad', factor: 100, uso: 'unid.' },
  { clave: 'par', etiqueta: 'pares', unidad: 'par', factor: 1, uso: 'pares' },
  { clave: 'paquete', etiqueta: 'paquetes', unidad: 'paquete', factor: 1, uso: 'paq.' },
  { clave: 'pliego', etiqueta: 'pliegos', unidad: 'pliego', factor: 1, uso: 'pliegos' },
  { clave: 'rollo', etiqueta: 'rollos', unidad: 'rollo', factor: 1, uso: 'rollos' },
  { clave: 'metro', etiqueta: 'metros', unidad: 'metro', factor: 1, uso: 'm' },
  { clave: 'centimetro', etiqueta: 'centímetros', unidad: 'centimetro', factor: 1, uso: 'cm' },
  { clave: 'gramo', etiqueta: 'gramos', unidad: 'gramo', factor: 1, uso: 'g' },
  { clave: 'kilogramo', etiqueta: 'kilos', unidad: 'kilogramo', factor: 1, uso: 'kg' },
  { clave: 'litro', etiqueta: 'litros', unidad: 'litro', factor: 1, uso: 'l' },
  { clave: 'mililitro', etiqueta: 'mililitros', unidad: 'mililitro', factor: 1, uso: 'ml' },
] as const

function presentacionDe(unidad: string, factor: number) {
  return (
    PRESENTACIONES.find((p) => p.unidad === unidad && p.factor === factor) ??
    PRESENTACIONES.find((p) => p.unidad === unidad) ??
    PRESENTACIONES[0]
  )
}

interface FilaMaterial {
  clave: string
  insumoId: number | null
  nombre: string
  presentacion: string
  cantidadCompra: string
  precioCompra: string
  cantidadUsada: string
  crearInsumo: boolean
}

interface FilaExtra {
  extraId: number
  cantidad: string
  costoUnitario: string
}

const num = (t: string) => {
  const n = Number(String(t).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const dos = (n: number) => Math.round(n * 100) / 100
let secuencia = 0
const nuevaClave = () => `m${Date.now()}-${secuencia++}`

export default function Calculadora({ opciones, inicial }: { opciones: Opciones; inicial?: Inicial }) {
  const { pendiente, aviso, ejecutar, router } = useAccion()
  const d = inicial?.datos
  const soloLectura = !opciones.puedeEditar

  const [nombre, setNombre] = useState(d?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(d?.descripcion ?? '')
  const [materiales, setMateriales] = useState<FilaMaterial[]>(
    d?.materiales.length
      ? d.materiales.map((m) => ({
          clave: nuevaClave(),
          insumoId: m.insumoId,
          nombre: m.nombre,
          presentacion: presentacionDe(m.unidad, m.factor).clave,
          cantidadCompra: String(m.cantidadCompra),
          precioCompra: String(m.precioCompra),
          cantidadUsada: String(m.cantidadUsada),
          crearInsumo: false,
        }))
      : [filaVacia()],
  )
  const [extras, setExtras] = useState<FilaExtra[]>(
    (d?.extras ?? []).map((e) => ({
      extraId: e.extraId,
      cantidad: String(e.cantidad),
      costoUnitario: String(e.costoUnitario),
    })),
  )
  const [minutos, setMinutos] = useState(String(d?.minutos ?? ''))
  const [costoHora, setCostoHora] = useState(String(d?.costoHora ?? opciones.costoHora))
  const [otrosPct, setOtrosPct] = useState(String(d?.otrosPct ?? 0))
  const [otrosMonto, setOtrosMonto] = useState(String(d?.otrosMonto ?? 0))
  const [margen, setMargen] = useState(d?.margenPct ?? opciones.margen)
  const [precioFinal, setPrecioFinal] = useState(d?.precioFinal != null ? String(d.precioFinal) : '')
  const [buscarExtra, setBuscarExtra] = useState('')
  const [categoria, setCategoria] = useState(0)

  function filaVacia(): FilaMaterial {
    return {
      clave: nuevaClave(),
      insumoId: null,
      nombre: '',
      presentacion: 'unidad',
      cantidadCompra: '',
      precioCompra: '',
      cantidadUsada: '',
      crearInsumo: false,
    }
  }

  const extraDe = useMemo(() => new Map(opciones.extras.map((e) => [e.id, e])), [opciones.extras])

  // ---- la cuenta (la misma que hace v_cotizacion en la base) ----------------
  const lineasMat = materiales.map((m) => {
    const p = PRESENTACIONES.find((x) => x.clave === m.presentacion) ?? PRESENTACIONES[0]
    const total = num(m.cantidadCompra) * p.factor
    const unitario = total > 0 ? num(m.precioCompra) / total : 0
    return { ...m, p, unitario, costo: dos(unitario * num(m.cantidadUsada)) }
  })
  const costoMateriales = lineasMat.reduce((s, m) => s + m.costo, 0)
  const costoExtras = extras.reduce((s, e) => s + dos(num(e.costoUnitario) * num(e.cantidad)), 0)
  const costoManoObra = dos((num(minutos) / 60) * num(costoHora))
  const costoOtros = dos(((costoMateriales + costoExtras + costoManoObra) * num(otrosPct)) / 100 + num(otrosMonto))
  const costoTotal = dos(costoMateriales + costoExtras + costoManoObra + costoOtros)
  const sugerido = Math.round((costoTotal * (1 + margen / 100)) / 5) * 5
  const precio = precioFinal.trim() === '' ? sugerido : num(precioFinal)
  const ganancia = dos(precio - costoTotal)
  const margenReal = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0

  function cambiarMaterial(clave: string, cambios: Partial<FilaMaterial>) {
    setMateriales((ms) => ms.map((m) => (m.clave === clave ? { ...m, ...cambios } : m)))
  }

  function escribirNombre(clave: string, texto: string) {
    // si coincide con un insumo del sistema, se vincula y trae su unidad
    const ins = opciones.insumos.find((i) => i.nombre.toLowerCase() === texto.trim().toLowerCase())
    cambiarMaterial(clave, {
      nombre: texto,
      insumoId: ins?.id ?? null,
      ...(ins ? { presentacion: presentacionDe(ins.unidad, 1).clave, crearInsumo: false } : {}),
    })
  }

  function agregarExtra(id: number) {
    const e = extraDe.get(id)
    if (!e) return
    setExtras((xs) =>
      xs.some((x) => x.extraId === id)
        ? xs.map((x) => (x.extraId === id ? { ...x, cantidad: String(num(x.cantidad) + 1) } : x))
        : [...xs, { extraId: id, cantidad: '1', costoUnitario: String(dos(e.costo)) }],
    )
    setBuscarExtra('')
  }

  const extrasBuscados = useMemo(() => {
    const t = buscarExtra.trim().toLowerCase()
    if (!t) return []
    return opciones.extras.filter((e) => e.nombre.toLowerCase().includes(t)).slice(0, 8)
  }, [buscarExtra, opciones.extras])

  function datos(): DatosCotizacion {
    return {
      id: inicial?.id ?? null,
      nombre,
      descripcion,
      minutos: num(minutos),
      costoHora: num(costoHora),
      otrosPct: num(otrosPct),
      otrosMonto: num(otrosMonto),
      margenPct: margen,
      precioFinal: precioFinal.trim() === '' ? null : num(precioFinal),
      materiales: lineasMat
        .filter((m) => m.nombre.trim() !== '')
        .map((m) => ({
          insumoId: m.insumoId,
          nombre: m.nombre,
          unidad: m.p.unidad,
          cantidadCompra: num(m.cantidadCompra),
          factor: m.p.factor,
          precioCompra: num(m.precioCompra),
          cantidadUsada: num(m.cantidadUsada),
          crearInsumo: m.crearInsumo,
        })),
      extras: extras.map((e) => ({
        extraId: e.extraId,
        cantidad: num(e.cantidad),
        costoUnitario: num(e.costoUnitario),
      })),
    }
  }

  function guardar() {
    ejecutar(
      () => guardarCotizacion(datos()),
      (r) => {
        if (r.ok && r.id && !inicial) router.replace(`/cotizacion/${r.id}`)
      },
    )
  }

  const campo = 'campo py-1.5 text-sm focus:campo-foco disabled:bg-fondo'

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
      <fieldset disabled={soloLectura || pendiente} className="min-w-0 space-y-4">
        {/* ---------------- Qué es ---------------- */}
        <section className="tarjeta p-4">
          <label htmlFor="c-nombre" className="block text-sm font-semibold">¿Qué vas a cotizar?</label>
          <input id="c-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Caja sorpresa con mariposas" className={`${campo} mt-1`} />
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Detalle o nota (opcional)" aria-label="Descripción" className={`${campo} mt-2`} />
        </section>

        {/* ---------------- Materiales ---------------- */}
        <section className="tarjeta p-4">
          <h2 className="text-sm font-semibold">1. Materiales que compraste</h2>
          <p className="mt-0.5 text-xs text-tinta-suave">
            Escribí cuánto compraste, cuánto pagaste y cuánto usás en este producto. Si el material ya está en Compras → Insumos, elegilo de la lista.
          </p>
          <datalist id="lista-insumos">
            {opciones.insumos.map((i) => (
              <option key={i.id} value={i.nombre} />
            ))}
          </datalist>

          <ul className="mt-3 space-y-3">
            {lineasMat.map((m, idx) => (
              <li key={m.clave} className="rounded-lg border border-linea p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-tinta-suave">{idx + 1}.</span>
                  <input
                    value={m.nombre}
                    onChange={(e) => escribirNombre(m.clave, e.target.value)}
                    list="lista-insumos"
                    placeholder="Material (cartón, cinta, mariposas…)"
                    aria-label="Material"
                    className={`${campo} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setMateriales((ms) => (ms.length === 1 ? [filaVacia()] : ms.filter((x) => x.clave !== m.clave)))}
                    aria-label="Quitar material"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-tinta-suave hover:bg-alerta-suave hover:text-alerta"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.3fr_1fr_1fr]">
                  <label className="text-xs text-tinta-suave">
                    Compré
                    <input inputMode="decimal" value={m.cantidadCompra} onChange={(e) => cambiarMaterial(m.clave, { cantidadCompra: e.target.value })} placeholder="5" className={`${campo} mt-0.5`} />
                  </label>
                  <label className="text-xs text-tinta-suave">
                    de
                    <select value={m.presentacion} onChange={(e) => cambiarMaterial(m.clave, { presentacion: e.target.value })} className={`${campo} mt-0.5`}>
                      {PRESENTACIONES.map((p) => (
                        <option key={p.clave} value={p.clave}>
                          {p.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-tinta-suave">
                    por Bs
                    <input inputMode="decimal" value={m.precioCompra} onChange={(e) => cambiarMaterial(m.clave, { precioCompra: e.target.value })} placeholder="87" className={`${campo} mt-0.5`} />
                  </label>
                  <label className="text-xs text-tinta-suave">
                    Usé ({m.p.uso})
                    <input inputMode="decimal" value={m.cantidadUsada} onChange={(e) => cambiarMaterial(m.clave, { cantidadUsada: e.target.value })} placeholder="2" className={`${campo} mt-0.5`} />
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-tinta-suave">
                    {m.unitario > 0 ? (
                      <>
                        {bs(dos(m.unitario))} por {m.p.uso === 'unid.' ? 'unidad' : m.p.uso}
                        {num(m.cantidadUsada) > 0 && <> × {numero(num(m.cantidadUsada))}</>}
                      </>
                    ) : (
                      'Completá cuánto compraste y cuánto pagaste'
                    )}
                    {m.insumoId && <span className="ml-2 rounded bg-ok-suave px-1.5 py-0.5 text-ok">insumo del sistema</span>}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{bs(m.costo)}</span>
                </div>

                {!m.insumoId && m.nombre.trim() !== '' && opciones.puedeCrearInsumo && (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-tinta-suave">
                    <input type="checkbox" checked={m.crearInsumo} onChange={(e) => cambiarMaterial(m.clave, { crearInsumo: e.target.checked })} className="size-4 accent-rosa-700" />
                    Guardarlo también en Compras → Insumos
                  </label>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setMateriales((ms) => [...ms, filaVacia()])} className="mt-3 w-full rounded-lg border border-dashed border-rosa-300 py-2 text-sm text-rosa-700 hover:bg-rosa-50">
            ＋ Agregar otro material
          </button>
        </section>

        {/* ---------------- Extras ---------------- */}
        <section className="tarjeta p-4">
          <h2 className="text-sm font-semibold">2. Extras del sistema</h2>
          <p className="mt-0.5 text-xs text-tinta-suave">
            Flores, peluches y accesorios que ya existen. Se toma su costo por receta; si todavía no tiene receta, corregilo a mano.
          </p>
          <div className="relative mt-2">
            <input value={buscarExtra} onChange={(e) => setBuscarExtra(e.target.value)} placeholder="Buscar un extra (rosa, girasol, peluche…)" aria-label="Buscar extra" className={campo} />
            {extrasBuscados.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-linea bg-white shadow-lg">
                {extrasBuscados.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => agregarExtra(e.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-rosa-50">
                      <Miniatura url={e.imagen} alt={e.nombre} className="size-9" />
                      <span className="min-w-0 flex-1 truncate text-sm">{e.nombre}</span>
                      <span className="text-xs text-tinta-suave">costo {bs(e.costo)} · vende {bs(e.precio)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {extras.length > 0 && (
            <ul className="mt-3 divide-y divide-linea">
              {extras.map((x) => {
                const e = extraDe.get(x.extraId)
                return (
                  <li key={x.extraId} className="flex flex-wrap items-center gap-2 py-2">
                    <Miniatura url={e?.imagen} alt={e?.nombre ?? 'Extra'} className="size-10" />
                    <span className="min-w-0 flex-1 truncate text-sm">{e?.nombre ?? `Extra ${x.extraId}`}</span>
                    <label className="flex items-center gap-1 text-xs text-tinta-suave">
                      Cant.
                      <input inputMode="decimal" value={x.cantidad} onChange={(ev) => setExtras((xs) => xs.map((y) => (y.extraId === x.extraId ? { ...y, cantidad: ev.target.value } : y)))} className={`${campo} w-16`} />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-tinta-suave">
                      Costo c/u Bs
                      <input inputMode="decimal" value={x.costoUnitario} onChange={(ev) => setExtras((xs) => xs.map((y) => (y.extraId === x.extraId ? { ...y, costoUnitario: ev.target.value } : y)))} className={`${campo} w-20`} />
                    </label>
                    <span className="w-20 text-right text-sm font-semibold tabular-nums">{bs(dos(num(x.costoUnitario) * num(x.cantidad)))}</span>
                    <button type="button" onClick={() => setExtras((xs) => xs.filter((y) => y.extraId !== x.extraId))} aria-label="Quitar extra" className="grid size-8 place-items-center rounded-full text-tinta-suave hover:bg-alerta-suave hover:text-alerta">
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ---------------- Tiempo y otros ---------------- */}
        <section className="tarjeta p-4">
          <h2 className="text-sm font-semibold">3. Tiempo de armado y otros gastos</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-tinta-suave">
              Minutos de armado
              <input inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder="45" className={`${campo} mt-0.5`} />
            </label>
            <label className="text-xs text-tinta-suave">
              Bs por hora
              <input inputMode="decimal" value={costoHora} onChange={(e) => setCostoHora(e.target.value)} className={`${campo} mt-0.5`} />
            </label>
            <label className="text-xs text-tinta-suave" title="Silicona, hilo, luz, desgaste de herramientas">
              Otros (% extra)
              <input inputMode="decimal" value={otrosPct} onChange={(e) => setOtrosPct(e.target.value)} className={`${campo} mt-0.5`} />
            </label>
            <label className="text-xs text-tinta-suave" title="Delivery, bolsa, tarjeta…">
              Otros (Bs fijos)
              <input inputMode="decimal" value={otrosMonto} onChange={(e) => setOtrosMonto(e.target.value)} className={`${campo} mt-0.5`} />
            </label>
          </div>
          <p className="mt-2 text-xs text-tinta-suave">
            Mano de obra: {numero(num(minutos))} min × {bs(num(costoHora))}/h = <strong className="text-tinta">{bs(costoManoObra)}</strong>
          </p>
        </section>
      </fieldset>

      {/* ---------------- Resultado ---------------- */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-4">
        <section className="tarjeta p-4">
          <h2 className="text-sm font-semibold">Resultado{inicial && <span className="ml-2 font-mono text-xs font-normal text-tinta-suave">{inicial.codigo}</span>}</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <Fila etiqueta="Materiales" valor={costoMateriales} />
            <Fila etiqueta="Extras" valor={costoExtras} />
            <Fila etiqueta={`Mano de obra (${numero(num(minutos))} min)`} valor={costoManoObra} />
            <Fila etiqueta="Otros" valor={costoOtros} />
            <div className="flex justify-between border-t border-linea pt-2 text-base font-semibold">
              <dt>Costo total</dt>
              <dd className="tabular-nums">{bs(costoTotal)}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <label htmlFor="c-margen">Margen</label>
              <span className="font-medium tabular-nums">{margen}%</span>
            </div>
            <input id="c-margen" type="range" min={0} max={200} step={5} value={margen} disabled={soloLectura} onChange={(e) => setMargen(Number(e.target.value))} className="mt-1 w-full accent-rosa-600" />
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm text-tinta-suave">Precio sugerido</span>
              <span className="text-lg font-semibold tabular-nums">{bs(sugerido)}</span>
            </div>
          </div>

          <label className="mt-3 block text-sm">
            Precio que vas a cobrar
            <input inputMode="decimal" value={precioFinal} disabled={soloLectura} onChange={(e) => setPrecioFinal(e.target.value)} placeholder={`${sugerido} (el sugerido)`} className="campo mt-1 focus:campo-foco" />
          </label>

          <div className={`mt-3 rounded-lg p-3 ${ganancia < 0 ? 'bg-alerta-suave text-alerta' : 'bg-ok-suave text-ok'}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{ganancia < 0 ? 'Pierde' : 'Gana'}</span>
              <span className="text-2xl font-semibold tabular-nums">{bs(Math.abs(ganancia))}</span>
            </div>
            <p className="text-xs">
              {ganancia < 0
                ? 'A ese precio no cubre lo que cuesta hacerlo.'
                : `${Math.round(margenReal)}% sobre el costo · vende a ${bs(precio)}`}
            </p>
          </div>

          {opciones.puedeEditar && (
            <button type="button" onClick={guardar} disabled={pendiente} className={`${BOTON} mt-4 w-full`}>
              {pendiente ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Guardar cotización'}
            </button>
          )}
          {aviso && <Aviso {...aviso} />}
          {inicial && <p className="mt-2 text-xs text-tinta-suave">Guardá antes de convertir o vender: se usa lo último guardado.</p>}
        </section>

        {inicial && (
          <section className="tarjeta space-y-3 p-4">
            <h2 className="text-sm font-semibold">¿Y ahora?</h2>

            {opciones.puedeVender && (
              <Link href={`/ventas/nueva?cotizacion=${inicial.id}`} className={`${BOTON_SECUNDARIO} block w-full text-center`}>
                Vender en el mostrador
              </Link>
            )}

            {inicial.productoId ? (
              <Link href={`/productos/${inicial.productoId}`} className="block text-center text-sm text-rosa-700 hover:underline">
                Ya es producto: ver ficha →
              </Link>
            ) : (
              opciones.puedeCrearProducto &&
              opciones.puedeEditar && (
                <div className="rounded-lg border border-linea p-3">
                  <p className="text-sm font-medium">Convertir en producto</p>
                  <p className="text-xs text-tinta-suave">Queda en borrador con este precio, sus minutos y su composición. Después le ponés foto y lo publicás.</p>
                  <select value={categoria} onChange={(e) => setCategoria(Number(e.target.value))} aria-label="Categoría" className="campo mt-2 py-1.5 text-sm focus:campo-foco">
                    <option value={0}>Elegí la categoría…</option>
                    {opciones.categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pendiente || !categoria}
                    onClick={() =>
                      ejecutar(
                        () => convertirEnProducto(inicial.id, categoria),
                        (r) => r.ok && r.productoId && router.push(`/productos/${r.productoId}`),
                      )
                    }
                    className={`${BOTON} mt-2 w-full`}
                  >
                    Crear producto
                  </button>
                </div>
              )
            )}

            {opciones.puedeEditar && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => {
                  if (window.confirm('¿Borrar esta cotización? No se puede deshacer.')) {
                    ejecutar(() => borrarCotizacion(inicial.id), (r) => r.ok && router.push('/cotizacion'))
                  }
                }}
                className="w-full text-sm text-tinta-suave hover:text-alerta"
              >
                Borrar cotización
              </button>
            )}
          </section>
        )}
      </aside>
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-tinta-suave">{etiqueta}</dt>
      <dd className="tabular-nums">{bs(valor)}</dd>
    </div>
  )
}
