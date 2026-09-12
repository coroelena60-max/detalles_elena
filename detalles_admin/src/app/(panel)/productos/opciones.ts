import { clienteServidor } from '@/lib/supabase/servidor'
import type { OpcionesFormulario } from './FormularioProducto'

/** Categorías y envoltorios para los selects del formulario. */
export async function obtenerOpciones(): Promise<OpcionesFormulario> {
  const sb = await clienteServidor()

  const [{ data: categorias }, { data: envoltorios }] = await Promise.all([
    sb.from('categoria').select('id, nombre').order('orden'),
    sb
      .from('envoltorio')
      .select(
        'id, precio_base, espacios, estilo:estilo_id (nombre, orden), tamano:tamano_id (codigo, orden)',
      )
      .eq('activo', true),
  ])

  type Fila = {
    id: number
    precio_base: number
    espacios: number | null
    estilo: { nombre: string; orden: number } | null
    tamano: { codigo: string; orden: number } | null
  }

  return {
    categorias: categorias ?? [],
    envoltorios: ((envoltorios ?? []) as unknown as Fila[])
      .filter((e) => e.estilo && e.tamano)
      .sort(
        (a, b) =>
          (a.estilo!.orden ?? 0) - (b.estilo!.orden ?? 0) ||
          (a.tamano!.orden ?? 0) - (b.tamano!.orden ?? 0),
      )
      .map((e) => ({
        id: e.id,
        nombre: `${e.estilo!.nombre} ${e.tamano!.codigo}`,
        espacios: e.espacios === null ? null : Number(e.espacios),
        precio_base: Number(e.precio_base),
      })),
  }
}
