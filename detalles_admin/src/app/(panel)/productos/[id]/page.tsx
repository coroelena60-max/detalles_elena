import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Icono from '@/components/Icono'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import FormularioProducto from '../FormularioProducto'
import { obtenerOpciones } from '../opciones'
import Composicion, { type LineaComposicion } from './Composicion'
import Fotos, { type Foto } from './Fotos'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Producto ${id}` }
}

export default async function PaginaProducto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nuevo?: string }>
}) {
  const nuevo = (await searchParams).nuevo === '1'
  const sesion = await exigirPermiso('maestro.ver')
  const { id: crudo } = await params
  const id = Number(crudo)
  if (!Number.isInteger(id)) notFound()

  const sb = await clienteServidor()
  const puedeEditar = sesion.permisos.has('maestro.editar')

  const [
    { data: producto },
    { data: vista },
    { data: fotos },
    { data: composicion },
    { data: extras },
    opciones,
  ] = await Promise.all([
    sb.from('producto').select('*').eq('id', id).maybeSingle(),
    sb.from('v_producto_admin').select('*').eq('id', id).maybeSingle(),
    sb
      .from('producto_imagen')
      .select('id, url, alt, storage_path, es_principal, orden')
      .eq('producto_id', id)
      .order('es_principal', { ascending: false })
      .order('orden'),
    sb
      .from('producto_extra')
      .select('extra_id, cantidad, extra:extra_id (nombre, precio, espacios)')
      .eq('producto_id', id),
    sb
      .from('extra')
      .select('id, nombre, precio, espacios, estado')
      .neq('estado', 'inactivo')
      .order('orden'),
    obtenerOpciones(),
  ])

  if (!producto) notFound()

  const lineas: LineaComposicion[] = (
    (composicion ?? []) as unknown as {
      extra_id: number
      cantidad: number
      extra: { nombre: string; precio: number; espacios: number } | null
    }[]
  )
    .filter((c) => c.extra)
    .map((c) => ({
      extraId: c.extra_id,
      nombre: c.extra!.nombre,
      cantidad: Number(c.cantidad),
      precio: Number(c.extra!.precio),
      espacios: Number(c.extra!.espacios),
    }))

  const yaEstan = new Set(lineas.map((l) => l.extraId))
  const disponibles = (extras ?? [])
    .filter((x) => !yaEstan.has(x.id))
    .map((x) => ({
      id: x.id,
      nombre: x.nombre,
      precio: Number(x.precio),
      espacios: Number(x.espacios),
    }))

  return (
    <div>
      <Link href="/productos" className="inline-flex items-center gap-1 text-sm text-rosa-700 hover:underline">
        <Icono nombre="atras" className="size-4" />
        Productos
      </Link>

      {nuevo && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-ok-suave px-4 py-3 font-medium text-ok">
          <Icono nombre="listo" />
          Producto guardado.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{producto.nombre}</h1>
        <span className="font-mono text-sm text-tinta-suave">{producto.codigo}</span>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          <FormularioProducto
            inicial={{
              id: producto.id,
              nombre: producto.nombre,
              descripcion: producto.descripcion ?? '',
              categoriaId: producto.categoria_id,
              envoltorioId: producto.envoltorio_id,
              precio: Number(producto.precio),
              precioDesde: producto.precio_desde,
              estado: producto.estado,
              destacado: producto.destacado,
              orden: producto.orden,
              leadTimeDias: producto.lead_time_dias,
              minutosArmado: producto.minutos_armado,
              stockMinimo: Number(producto.stock_minimo ?? 0),
            }}
            opciones={opciones}
            puedeEditar={puedeEditar}
          />

          <Composicion
            productoId={producto.id}
            lineas={lineas}
            disponibles={disponibles}
            capacidad={
              vista?.espacios_capacidad != null
                ? Number(vista.espacios_capacidad)
                : null
            }
            puedeEditar={puedeEditar}
          />
        </div>

        <div className="space-y-4">
          <Fotos
            productoId={producto.id}
            nombre={producto.nombre}
            fotos={(fotos ?? []) as Foto[]}
            puedeEditar={puedeEditar}
          />

          <section className="tarjeta p-4">
            <h2 className="text-base font-semibold">Cuánto deja</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Precio</dt>
                <dd>{bs(vista?.precio ?? producto.precio)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Costo</dt>
                <dd>{bs(vista?.costo_total ?? 0)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Margen</dt>
                <dd className={vista?.a_perdida ? 'text-alerta' : ''}>
                  {bs(vista?.margen ?? 0)}
                  {vista?.margen_pct != null ? ` · ${numero(vista.margen_pct)}%` : ''}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Precio sugerido</dt>
                <dd>{bs(vista?.precio_sugerido ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Hay armados</dt>
                <dd>{numero(vista?.existencia ?? 0)}</dd>
              </div>
            </dl>
            {vista?.a_perdida && (
              <p className="mt-3 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
                Se vende por debajo de su costo.
              </p>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
