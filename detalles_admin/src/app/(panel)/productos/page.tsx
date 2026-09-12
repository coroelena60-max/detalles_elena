import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { bs, numero } from '@/lib/formato'
import type { Database } from '@/types/database'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Productos' }
export const dynamic = 'force-dynamic'

type EstadoPublicacion = Database['public']['Enums']['estado_publicacion']

const ESTADOS_PRODUCTO: Record<EstadoPublicacion, { etiqueta: string; clase: string }> = {
  borrador: { etiqueta: 'Borrador', clase: 'bg-rosa-100 text-rosa-700' },
  activo: { etiqueta: 'En el catálogo', clase: 'bg-ok-suave text-ok' },
  agotado: { etiqueta: 'Agotado', clase: 'bg-aviso-suave text-aviso' },
  temporada: { etiqueta: 'De temporada', clase: 'bg-ok-suave text-ok' },
  inactivo: { etiqueta: 'Fuera del catálogo', clase: 'bg-alerta-suave text-alerta' },
}

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const sesion = await exigirPermiso('maestro.ver')
  const { estado } = await searchParams
  const sb = await clienteServidor()

  // el filtro viene de la URL: solo se acepta si es un estado real del enum
  const filtro =
    estado && estado in ESTADOS_PRODUCTO ? (estado as EstadoPublicacion) : null

  let consulta = sb.from('v_producto_admin').select('*').order('orden')
  if (filtro) consulta = consulta.eq('estado', filtro)

  const { data: productos, error } = await consulta
  const puedeEditar = sesion.permisos.has('maestro.editar')

  const filtros = [
    { clave: 'todos', etiqueta: 'Todos' },
    { clave: 'activo', etiqueta: 'En el catálogo' },
    { clave: 'borrador', etiqueta: 'Borradores' },
    { clave: 'agotado', etiqueta: 'Agotados' },
    { clave: 'inactivo', etiqueta: 'Fuera' },
  ]
  const filtroActivo = estado ?? 'todos'

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Productos</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Los ramos que ve el cliente en el catálogo. El precio lo decidís vos; el
            costo lo calcula la base con las recetas.
          </p>
        </div>
        {puedeEditar && (
          <Link
            href="/productos/nuevo"
            className="rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700"
          >
            Nuevo producto
          </Link>
        )}
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {filtros.map((f) => (
          <Link
            key={f.clave}
            href={f.clave === 'todos' ? '/productos' : `/productos?estado=${f.clave}`}
            aria-current={f.clave === filtroActivo ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              f.clave === filtroActivo
                ? 'bg-rosa-100 font-medium text-rosa-700'
                : 'text-tinta-suave hover:bg-white'
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      {error && (
        <p className="tarjeta mt-4 border-alerta bg-alerta-suave p-4 text-sm text-alerta">
          No pudimos cargar los productos: {error.message}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {(productos ?? []).map((p) => {
          const est = ESTADOS_PRODUCTO[p.estado ?? 'borrador']
          return (
            <li key={p.id}>
              <Link
                href={`/productos/${p.id}`}
                className="tarjeta flex items-center gap-3 p-3 transition hover:border-rosa-300"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-rosa-50">
                  {p.imagen_principal ? (
                    <Image
                      src={p.imagen_principal}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-xl text-rosa-300">
                      ❀
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="mt-0.5 text-xs text-tinta-suave">
                    <span className="font-mono">{p.codigo}</span> · {p.categoria}
                    {p.envoltorio ? ` · ${p.envoltorio}` : ''} · {p.fotos} foto
                    {p.fotos === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {p.precio_desde ? 'desde ' : ''}
                    {bs(p.precio)}
                  </p>
                  <p
                    className={`text-xs ${p.a_perdida ? 'text-alerta' : 'text-tinta-suave'}`}
                  >
                    costo {bs(p.costo_total)}
                    {p.margen_pct !== null && p.margen_pct !== undefined
                      ? ` · ${numero(p.margen_pct)}%`
                      : ''}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${est.clase}`}
                >
                  {est.etiqueta}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      {productos && productos.length === 0 && !error && (
        <p className="tarjeta mt-4 p-6 text-sm text-tinta-suave">
          No hay productos con este filtro.
        </p>
      )}
    </div>
  )
}
