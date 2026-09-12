'use server'

import { revalidatePath } from 'next/cache'
import { numeroDe, traducirError } from '@/lib/acciones'
import { esFechaValida } from '@/lib/fechas'
import type { MetodoPago } from '@/lib/estados'
import { clienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: boolean; mensaje: string }

export interface DatosGasto {
  fecha: string
  categoriaId: number
  descripcion: string
  monto: string
  metodo: MetodoPago
  comprobante: string
  nota: string
}

function refrescar() {
  revalidatePath('/contabilidad')
  revalidatePath('/contabilidad/ganancias')
}

/**
 * Registrar un gasto. Quién lo registró lo pone la base (trigger), y un gasto
 * no se edita después: si está mal, se anula con motivo y se carga de nuevo.
 */
export async function registrarGasto(d: DatosGasto): Promise<Resultado> {
  const monto = numeroDe(d.monto)
  if (!esFechaValida(d.fecha)) return { ok: false, mensaje: 'Revisá la fecha.' }
  if (!d.categoriaId) return { ok: false, mensaje: 'Elegí de qué tipo es el gasto.' }
  if (d.descripcion.trim().length < 3) {
    return { ok: false, mensaje: 'Escribí en qué se gastó.' }
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: 'El monto tiene que ser mayor a cero.' }
  }

  const sb = await clienteServidor()
  const { data, error } = await sb
    .from('gasto')
    .insert({
      fecha: d.fecha,
      categoria_gasto_id: d.categoriaId,
      descripcion: d.descripcion.trim(),
      monto: Math.round(monto * 100) / 100,
      metodo: d.metodo,
      comprobante: d.comprobante.trim() || null,
      nota: d.nota.trim() || null,
    })
    .select('codigo')
    .single()

  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescar()
  return { ok: true, mensaje: `Gasto ${data.codigo} registrado.` }
}

export async function anularGasto(id: number, motivo: string): Promise<Resultado> {
  if (motivo.trim().length < 3) {
    return { ok: false, mensaje: 'Escribí por qué se anula.' }
  }
  const sb = await clienteServidor()
  const { error } = await sb.rpc('anular_gasto', { p_gasto_id: id, p_motivo: motivo })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescar()
  return { ok: true, mensaje: 'Gasto anulado. Ya no cuenta en las ganancias.' }
}

// ---------------------------------------------------------------------------
// Tipos de gasto
// ---------------------------------------------------------------------------

export async function crearTipoGasto(nombre: string, descripcion: string): Promise<Resultado> {
  if (nombre.trim().length < 3) return { ok: false, mensaje: 'El nombre es muy corto.' }
  const sb = await clienteServidor()

  const { data: ultimo } = await sb
    .from('categoria_gasto')
    .select('orden')
    .lt('orden', 99)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await sb.from('categoria_gasto').insert({
    nombre: nombre.trim(),
    descripcion: descripcion.trim() || null,
    orden: (ultimo?.orden ?? 0) + 1,
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescar()
  return { ok: true, mensaje: 'Tipo de gasto agregado.' }
}

export async function cambiarTipoGasto(id: number, activa: boolean): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.from('categoria_gasto').update({ activa }).eq('id', id)
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescar()
  return { ok: true, mensaje: activa ? 'Vuelve a aparecer en la lista.' : 'Ya no se ofrece al registrar.' }
}
