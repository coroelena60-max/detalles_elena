import { clienteServidor } from '@/lib/supabase/servidor'
import type { Sesion } from '@/lib/sesion'
import type { Opciones } from './Calculadora'

/** Lo que la calculadora necesita tener a mano: insumos, extras con su costo y categorías. */
export async function cargarOpciones(sesion: Sesion): Promise<Opciones> {
  const sb = await clienteServidor()
  const verInsumos = sesion.permisos.has('insumo.ver')

  const [insumos, extras, costos, categorias, parametros] = await Promise.all([
    verInsumos
      ? sb.from('insumo').select('id, nombre, unidad, costo_unitario').eq('activo', true).order('nombre')
      : Promise.resolve({ data: [] as { id: number; nombre: string; unidad: string; costo_unitario: number }[] }),
    sb.from('extra').select('id, nombre, precio, imagen_url').neq('estado', 'inactivo').order('nombre'),
    sb.from('v_costo_extra').select('id, costo_total'),
    sb.from('categoria').select('id, nombre').order('orden'),
    sb.from('parametro').select('clave, valor').in('clave', ['costo_hora_mano_obra', 'margen_objetivo_pct']),
  ])

  const costoDe = new Map((costos.data ?? []).map((c) => [c.id, Number(c.costo_total)]))
  const param = new Map((parametros.data ?? []).map((p) => [p.clave, Number(p.valor)]))

  return {
    insumos: (insumos.data ?? []).map((i) => ({
      id: i.id,
      nombre: i.nombre,
      unidad: i.unidad,
      costo: Number(i.costo_unitario),
    })),
    extras: (extras.data ?? []).map((e) => ({
      id: e.id,
      nombre: e.nombre,
      precio: Number(e.precio),
      costo: costoDe.get(e.id) ?? 0,
      imagen: e.imagen_url,
    })),
    categorias: categorias.data ?? [],
    costoHora: param.get('costo_hora_mano_obra') ?? 20,
    margen: param.get('margen_objetivo_pct') ?? 60,
    puedeEditar: sesion.permisos.has('cotizacion.editar'),
    puedeCrearInsumo: sesion.permisos.has('insumo.editar'),
    puedeCrearProducto: sesion.permisos.has('maestro.editar'),
    puedeVender: sesion.permisos.has('venta.editar'),
  }
}
