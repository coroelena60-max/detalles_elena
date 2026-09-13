import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cifra, Etiqueta } from '@/components/ui'
import { TIPOS_MOVIMIENTO, UNIDADES } from '@/lib/estados'
import { bs, fechaHora, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FormularioInsumo from '../FormularioInsumo'

export const metadata: Metadata = { title: 'Insumo' }
export const dynamic = 'force-dynamic'

export default async function PaginaInsumo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso('insumo.ver')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const sb = await clienteServidor()

  const [{ data: insumo }, { data: existencia }, { data: proveedores }, { data: recetas }, { data: kardex }] =
    await Promise.all([
      sb.from('insumo').select('*').eq('id', id).maybeSingle(),
      sb.from('v_existencia_insumo').select('existencia, valorizado, bajo_minimo').eq('id', id).maybeSingle(),
      sb.from('proveedor').select('id, nombre').order('nombre'),
      sb.from('extra_insumo').select('cantidad, extra:extra_id (id, nombre)').eq('insumo_id', id),
      sb
        .from('v_kardex')
        .select('id, created_at, tipo, cantidad, costo_unitario, compra, pedido, nota, registrado_por')
        .eq('tipo_item', 'insumo')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

  if (!insumo) notFound()
  const unidad = UNIDADES[insumo.unidad]

  return (
    <div>
      <Link href="/compras/insumos" className="text-sm text-rosa-700 hover:underline">
        ← Insumos
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{insumo.nombre}</h1>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra
          etiqueta="Hay"
          valor={`${numero(existencia?.existencia)} ${unidad}`}
          tono={existencia?.bajo_minimo ? 'alerta' : 'normal'}
          detalle={existencia?.bajo_minimo ? 'por debajo del mínimo' : undefined}
        />
        <Cifra etiqueta={`Costo por ${unidad}`} valor={bs(insumo.costo_unitario)} />
        <Cifra etiqueta="Valor en stock" valor={bs(existencia?.valorizado)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <FormularioInsumo
            proveedores={proveedores ?? []}
            puedeEditar={sesion.permisos.has('insumo.editar')}
            inicial={{
              id: insumo.id,
              nombre: insumo.nombre,
              descripcion: insumo.descripcion ?? '',
              unidad: insumo.unidad,
              costo: String(insumo.costo_unitario),
              minimo: String(insumo.stock_minimo),
              proveedorId: insumo.proveedor_id,
              activo: insumo.activo,
            }}
          />

          <section className="tarjeta overflow-x-auto">
            <h2 className="px-4 pt-4 text-sm font-semibold">Últimos movimientos</h2>
            {(kardex ?? []).length === 0 ? (
              <p className="px-4 pb-4 pt-2 text-sm text-tinta-suave">
                Todavía no se movió. Entra con una compra recibida y sale al producir flores.
              </p>
            ) : (
              <table className="mt-2 w-full min-w-[480px] text-sm">
                <tbody className="divide-y divide-linea">
                  {(kardex ?? []).map((m) => {
                    const t = m.tipo ? TIPOS_MOVIMIENTO[m.tipo] : null
                    const c = Number(m.cantidad)
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-2 text-xs text-tinta-suave">{fechaHora(m.created_at)}</td>
                        <td className="px-4 py-2">{t && <Etiqueta clase={t.clase}>{t.etiqueta}</Etiqueta>}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${c < 0 ? 'text-alerta' : 'text-ok'}`}>
                          {c > 0 ? '+' : ''}
                          {numero(c)}
                        </td>
                        <td className="px-4 py-2 text-xs text-tinta-suave">{m.compra ?? m.nota ?? ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <section className="tarjeta h-fit p-4">
          <h2 className="text-sm font-semibold">Dónde se usa</h2>
          {(recetas ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">
              En ninguna receta todavía. Sumalo a la receta de una flor desde Productos → Producto
              personalizado.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {(recetas ?? []).map((r) => {
                const extra = r.extra as { id: number; nombre: string } | null
                if (!extra) return null
                return (
                  <li key={extra.id} className="flex justify-between gap-2">
                    <Link href={`/productos/personalizado/extras/${extra.id}`} className="hover:text-rosa-700 hover:underline">
                      {extra.nombre}
                    </Link>
                    <span className="tabular-nums text-tinta-suave">
                      {numero(r.cantidad)} {unidad}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
