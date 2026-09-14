import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Etiqueta } from '@/components/ui'
import { ESTADOS_PUBLICACION, type UnidadMedida } from '@/lib/estados'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FormularioExtra from '../FormularioExtra'
import FotoExtra from './FotoExtra'
import Receta, { type Ingrediente } from './Receta'

export const metadata: Metadata = { title: 'Extra' }
export const dynamic = 'force-dynamic'

export default async function PaginaExtra({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso('maestro.ver')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const sb = await clienteServidor()
  const puedeEditar = sesion.permisos.has('maestro.editar')

  const [{ data: extra }, { data: costo }, { data: categorias }, { data: receta }, { data: insumos }, { data: stock }, { data: usos }] =
    await Promise.all([
      sb.from('extra').select('*').eq('id', id).maybeSingle(),
      sb.from('v_costo_extra').select('*').eq('id', id).maybeSingle(),
      sb.from('extra_categoria').select('id, nombre').order('orden'),
      sb.from('extra_insumo').select('cantidad, insumo:insumo_id (id, nombre, unidad, costo_unitario)').eq('extra_id', id),
      sb.from('insumo').select('id, nombre, unidad, costo_unitario').eq('activo', true).order('nombre'),
      sb.from('v_existencia_extra').select('existencia').eq('id', id).maybeSingle(),
      sb.from('producto_extra').select('cantidad, producto:producto_id (id, nombre)').eq('extra_id', id),
    ])

  if (!extra) notFound()

  const ingredientes: Ingrediente[] = (
    (receta ?? []) as unknown as {
      cantidad: number
      insumo: { id: number; nombre: string; unidad: UnidadMedida; costo_unitario: number } | null
    }[]
  )
    .filter((r) => r.insumo)
    .map((r) => ({
      insumoId: r.insumo!.id,
      nombre: r.insumo!.nombre,
      unidad: r.insumo!.unidad,
      cantidad: Number(r.cantidad),
      costoUnitario: Number(r.insumo!.costo_unitario),
    }))

  const precio = Number(extra.precio)
  const costoTotal = Number(costo?.costo_total ?? 0)
  const margen = precio - costoTotal
  const est = ESTADOS_PUBLICACION[extra.estado]

  return (
    <div>
      <Link href="/productos/personalizado" className="text-sm text-rosa-700 hover:underline">
        ← Producto personalizado
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{extra.nombre}</h1>
        <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <FormularioExtra
            categorias={categorias ?? []}
            puedeEditar={puedeEditar}
            inicial={{
              id: extra.id,
              nombre: extra.nombre,
              descripcion: extra.descripcion ?? '',
              categoriaId: extra.extra_categoria_id,
              precio: String(extra.precio),
              espacios: String(extra.espacios),
              unidad: extra.unidad,
              estado: extra.estado,
              orden: String(extra.orden),
              stockMinimo: String(extra.stock_minimo ?? 0),
              minutosArmado: extra.minutos_armado ? String(extra.minutos_armado) : '',
            }}
          />
          <Receta
            extraId={extra.id}
            ingredientes={ingredientes}
            puedeEditar={puedeEditar}
            insumos={(insumos ?? []).map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, costo: Number(i.costo_unitario) }))}
          />
        </div>

        <div className="space-y-4">
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">Cuánto deja cada una</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-tinta-suave">Precio</dt><dd className="tabular-nums">{bs(precio)}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-suave">Materiales</dt><dd className="tabular-nums">{bs(costo?.costo_materiales)}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-suave">Mano de obra ({numero(costo?.minutos_armado)} min)</dt><dd className="tabular-nums">{bs(costo?.costo_mano_obra)}</dd></div>
              <div className="flex justify-between font-medium"><dt>Costo</dt><dd className="tabular-nums">{bs(costoTotal)}</dd></div>
              <div className={`flex justify-between border-t border-linea pt-1 font-semibold ${margen < 0 ? 'text-alerta' : 'text-ok'}`}>
                <dt>Margen</dt>
                <dd className="tabular-nums">{bs(margen)}{precio > 0 ? ` · ${numero((margen / precio) * 100)}%` : ''}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-tinta-suave">
              En stock: <strong>{numero(stock?.existencia)}</strong>
            </p>
          </section>

          <FotoExtra extraId={extra.id} url={extra.imagen_url} puedeEditar={puedeEditar} />

          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold">Ramos que la llevan</h2>
            {(usos ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">Ningún producto del catálogo.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {(usos ?? []).map((u) => {
                  const p = u.producto as { id: number; nombre: string } | null
                  return p ? (
                    <li key={p.id} className="flex justify-between gap-2">
                      <Link href={`/productos/${p.id}`} className="truncate hover:text-rosa-700 hover:underline">{p.nombre}</Link>
                      <span className="tabular-nums text-tinta-suave">×{numero(u.cantidad)}</span>
                    </li>
                  ) : null
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
