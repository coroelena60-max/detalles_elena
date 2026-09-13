'use server'

import { revalidatePath } from 'next/cache'
import { traducirError } from '@/lib/acciones'
import { clienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: boolean; mensaje: string }

export interface MaterialCotizacion {
  insumoId: number | null
  nombre: string
  unidad: string
  cantidadCompra: number
  factor: number
  precioCompra: number
  cantidadUsada: number
  crearInsumo: boolean
}

export interface ExtraCotizacion {
  extraId: number
  cantidad: number
  costoUnitario: number
}

export interface DatosCotizacion {
  id: number | null
  nombre: string
  descripcion: string
  minutos: number
  costoHora: number
  otrosPct: number
  otrosMonto: number
  margenPct: number
  precioFinal: number | null
  materiales: MaterialCotizacion[]
  extras: ExtraCotizacion[]
}

const bien = (n: number) => Number.isFinite(n) && n >= 0

/** Guarda cabecera y líneas juntas. La cuenta la hace la base (v_cotizacion). */
export async function guardarCotizacion(d: DatosCotizacion): Promise<Resultado & { id?: number }> {
  if (d.nombre.trim().length < 2) return { ok: false, mensaje: 'Poné un nombre a la cotización.' }
  if (![d.minutos, d.costoHora, d.otrosPct, d.otrosMonto, d.margenPct].every(bien)) {
    return { ok: false, mensaje: 'Revisá los números: no pueden ser negativos.' }
  }
  const materiales = d.materiales.filter((m) => m.nombre.trim() !== '')
  for (const m of materiales) {
    if (!(m.cantidadCompra > 0)) return { ok: false, mensaje: `"${m.nombre}": ¿cuánto compraste? Tiene que ser más que cero.` }
    if (!bien(m.precioCompra) || !bien(m.cantidadUsada)) return { ok: false, mensaje: `Revisá los números de "${m.nombre}".` }
  }
  if (materiales.length === 0 && d.extras.length === 0 && d.minutos === 0) {
    return { ok: false, mensaje: 'Agregá al menos un material, un extra o el tiempo de armado.' }
  }

  const sb = await clienteServidor()
  const { data, error } = await sb.rpc('guardar_cotizacion', {
    p: {
      id: d.id,
      nombre: d.nombre.trim(),
      descripcion: d.descripcion.trim(),
      minutos: Math.round(d.minutos),
      costo_hora: d.costoHora,
      otros_pct: d.otrosPct,
      otros_monto: d.otrosMonto,
      margen_pct: d.margenPct,
      precio_final: d.precioFinal,
      materiales: materiales.map((m) => ({
        insumo_id: m.insumoId,
        nombre: m.nombre.trim(),
        unidad: m.unidad,
        cantidad_compra: m.cantidadCompra,
        factor: m.factor,
        precio_compra: m.precioCompra,
        cantidad_usada: m.cantidadUsada,
        crear_insumo: m.crearInsumo,
      })),
      extras: d.extras
        .filter((e) => e.cantidad > 0)
        .map((e) => ({ extra_id: e.extraId, cantidad: e.cantidad, costo_unitario: e.costoUnitario })),
    },
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }

  const id = (data as { id?: number } | null)?.id
  revalidatePath('/cotizacion')
  if (id) revalidatePath(`/cotizacion/${id}`)
  if (materiales.some((m) => m.crearInsumo)) revalidatePath('/compras/insumos')
  return { ok: true, mensaje: 'Cotización guardada.', id }
}

export async function borrarCotizacion(id: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.rpc('borrar_cotizacion', { p_id: id })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  revalidatePath('/cotizacion')
  return { ok: true, mensaje: 'Cotización borrada.' }
}

export async function convertirEnProducto(
  id: number,
  categoriaId: number,
): Promise<Resultado & { productoId?: number }> {
  if (!categoriaId) return { ok: false, mensaje: 'Elegí en qué categoría va el producto.' }
  const sb = await clienteServidor()
  const { data, error } = await sb.rpc('convertir_cotizacion_en_producto', {
    p_id: id,
    p_categoria_id: categoriaId,
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  const r = data as { producto_id: number; codigo: string }
  revalidatePath('/productos')
  revalidatePath(`/cotizacion/${id}`)
  return { ok: true, mensaje: `Producto ${r.codigo} creado en borrador.`, productoId: r.producto_id }
}
