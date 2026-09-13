import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import { Cifra, ErrorCarga, Vacio } from '@/components/ui'
import { numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FiltroStock from './FiltroStock'
import TablaStock from './TablaStock'

export const metadata: Metadata = { title: 'Stock de productos' }
export const dynamic = 'force-dynamic'

export default async function PaginaStockProductos({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; q?: string }>
}) {
  const sesion = await exigirPermiso('inventario.ver')
  const { ver = 'todos', q } = await searchParams
  const sb = await clienteServidor()

  const { data, error } = await sb
    .from('v_existencia_producto')
    .select('id, codigo, nombre, estado, stock_minimo, existencia')
    .neq('estado', 'inactivo')
    .order('nombre')

  const todas = (data ?? []).map((p) => ({
    id: p.id!,
    nombre: p.nombre ?? '',
    codigo: p.codigo,
    estado: p.estado,
    existencia: Number(p.existencia ?? 0),
    minimo: Number(p.stock_minimo ?? 0),
  }))

  const conteos = {
    todos: todas.length,
    reponer: todas.filter((f) => f.existencia <= f.minimo).length,
    sin: todas.filter((f) => f.existencia <= 0).length,
  }
  const texto = q?.trim().toLowerCase()
  const filas = todas
    .filter((f) => (ver === 'reponer' ? f.existencia <= f.minimo : ver === 'sin' ? f.existencia <= 0 : true))
    .filter((f) => !texto || f.nombre.toLowerCase().includes(texto) || f.codigo?.toLowerCase().includes(texto))

  const unidades = todas.reduce((s, f) => s + Math.max(f.existencia, 0), 0)

  return (
    <div>
      <Encabezado
        titulo="Stock de productos"
        descripcion="Ramos ya armados esperando cliente. La mayoría se arma por pedido, así que es normal ver ceros: esto sirve para lo que se deja hecho."
        modulo="inventario"
        permisos={sesion.permisos}
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra etiqueta="Unidades armadas" valor={numero(unidades)} />
        <Cifra etiqueta="Para reponer" valor={numero(conteos.reponer)} tono={conteos.reponer ? 'alerta' : 'normal'} />
        <Cifra etiqueta="Productos" valor={numero(conteos.todos)} />
      </div>

      <FiltroStock ruta="/inventario" activo={ver} conteos={conteos} q={q} />

      {error && <ErrorCarga que="el stock" mensaje={error.message} />}
      {filas.length === 0 && !error ? (
        <Vacio>No hay productos con este filtro.</Vacio>
      ) : (
        <TablaStock
          tipoItem="producto"
          filas={filas}
          puedeEditar={sesion.permisos.has('inventario.editar')}
          enlaceBase={sesion.permisos.has('maestro.ver') ? '/productos' : undefined}
        />
      )}
      <p className="mt-3 text-xs text-tinta-suave">
        Al marcar un pedido como entregado, lo que llevaba se descuenta solo.
      </p>
    </div>
  )
}
