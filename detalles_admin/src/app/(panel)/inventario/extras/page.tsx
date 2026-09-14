import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import { Cifra, ErrorCarga, Vacio } from '@/components/ui'
import { numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FiltroStock from '../FiltroStock'
import TablaStock from '../TablaStock'

export const metadata: Metadata = { title: 'Flores y extras' }
export const dynamic = 'force-dynamic'

export default async function PaginaStockExtras({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; q?: string }>
}) {
  const sesion = await exigirPermiso('inventario.ver')
  const { ver = 'todos', q } = await searchParams
  const sb = await clienteServidor()

  const [{ data, error }, { data: recetas }] = await Promise.all([
    sb
      .from('v_existencia_extra')
      .select('id, nombre, estado, stock_minimo, existencia')
      .neq('estado', 'inactivo')
      .order('nombre'),
    sb.from('extra_insumo').select('extra_id'),
  ])

  const conReceta = new Set((recetas ?? []).map((r) => r.extra_id))
  const todas = (data ?? []).map((e) => ({
    id: e.id!,
    nombre: e.nombre ?? '',
    estado: e.estado,
    existencia: Number(e.existencia ?? 0),
    minimo: Number(e.stock_minimo ?? 0),
    tieneReceta: conReceta.has(e.id!),
  }))

  const conteos = {
    todos: todas.length,
    reponer: todas.filter((f) => f.existencia <= f.minimo).length,
    sin: todas.filter((f) => f.existencia <= 0).length,
  }
  const texto = q?.trim().toLowerCase()
  const filas = todas
    .filter((f) => (ver === 'reponer' ? f.existencia <= f.minimo : ver === 'sin' ? f.existencia <= 0 : true))
    .filter((f) => !texto || f.nombre.toLowerCase().includes(texto))

  return (
    <div>
      <Encabezado
        titulo="Inventario"
        descripcion="Flores, peluches y tarjetas que hay hechos."
        modulo="inventario"
        permisos={sesion.permisos}
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra
          etiqueta="Unidades en stock"
          valor={numero(todas.reduce((s, f) => s + Math.max(f.existencia, 0), 0))}
        />
        <Cifra etiqueta="Para reponer" valor={numero(conteos.reponer)} tono={conteos.reponer ? 'alerta' : 'normal'} />
        <Cifra
          etiqueta="Con receta"
          valor={`${numero(todas.filter((f) => f.tieneReceta).length)} de ${numero(todas.length)}`}
          detalle="las que gastan materiales al hacerse"
        />
      </div>

      <FiltroStock ruta="/inventario/extras" activo={ver} conteos={conteos} q={q} />

      {error && <ErrorCarga que="el stock" mensaje={error.message} />}
      {filas.length === 0 && !error ? (
        <Vacio>No hay extras con este filtro.</Vacio>
      ) : (
        <TablaStock
          tipoItem="extra"
          filas={filas}
          puedeEditar={sesion.permisos.has('inventario.editar')}
          enlaceBase={sesion.permisos.has('maestro.ver') ? '/productos/personalizado/extras' : undefined}
        />
      )}
      <p className="mt-3 text-xs text-tinta-suave">
        La receta de cada flor (qué insumos lleva) se carga en Productos → Producto personalizado.
      </p>
    </div>
  )
}
