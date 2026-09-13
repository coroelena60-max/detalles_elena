'use server'

import { revalidatePath } from 'next/cache'
import { traducirError } from '@/lib/acciones'
import { clienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: boolean; mensaje: string }
export type Movida = 'entrada' | 'conteo' | 'merma' | 'devolucion'

function refrescar() {
  revalidatePath('/inventario')
  revalidatePath('/inventario/extras')
  revalidatePath('/inventario/movimientos')
  revalidatePath('/')
}

/**
 * Mover stock a mano. La persona no piensa en "cantidades con signo": piensa
 * "armé 3", "se rompieron 2" o "conté y hay 14". Acá se traduce eso al
 * movimiento que entiende el kardex.
 *
 *   entrada    → producción, suma
 *   conteo     → ajuste por la diferencia entre lo contado y lo que dice el sistema
 *   merma      → resta
 *   devolucion → suma
 */
export async function moverStock(
  tipoItem: 'producto' | 'extra',
  itemId: number,
  movida: Movida,
  cantidad: number,
  existenciaActual: number,
  nota: string,
): Promise<Resultado> {
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    return { ok: false, mensaje: 'Revisá la cantidad.' }
  }

  let tipo: 'produccion' | 'ajuste' | 'merma' | 'devolucion'
  let firmada: number
  switch (movida) {
    case 'entrada':
      tipo = 'produccion'
      firmada = cantidad
      break
    case 'devolucion':
      tipo = 'devolucion'
      firmada = cantidad
      break
    case 'merma':
      tipo = 'merma'
      firmada = -cantidad
      break
    case 'conteo':
      tipo = 'ajuste'
      firmada = Math.round((cantidad - existenciaActual) * 1000) / 1000
      break
  }

  if (firmada === 0) {
    return {
      ok: false,
      mensaje: movida === 'conteo' ? 'El conteo coincide con el sistema: no hay nada que ajustar.' : 'La cantidad tiene que ser mayor a cero.',
    }
  }

  const sb = await clienteServidor()
  const { error } = await sb.rpc('registrar_movimiento', {
    p_tipo_item: tipoItem,
    p_item_id: itemId,
    p_tipo: tipo,
    p_cantidad: firmada,
    p_nota: nota.trim() || (movida === 'conteo' ? `Conteo: ${cantidad}` : undefined),
  })
  if (error) return { ok: false, mensaje: traducirError(error.message) }

  refrescar()
  const signo = firmada > 0 ? `+${firmada}` : `${firmada}`
  return { ok: true, mensaje: `Listo: ${signo} en el stock.` }
}

/**
 * Fabricar flores: descuenta los insumos de la receta y suma las unidades
 * terminadas, todo junto. Si el extra no tiene receta, solo suma.
 */
export async function producirExtra(extraId: number, cantidad: number): Promise<Resultado> {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, mensaje: 'La cantidad tiene que ser mayor a cero.' }
  }
  const sb = await clienteServidor()
  const { error } = await sb.rpc('producir_extra', { p_extra_id: extraId, p_cantidad: cantidad })
  if (error) return { ok: false, mensaje: traducirError(error.message) }
  refrescar()
  revalidatePath('/compras/insumos')
  return { ok: true, mensaje: `Producidas ${cantidad}. Se descontaron los insumos de la receta.` }
}
