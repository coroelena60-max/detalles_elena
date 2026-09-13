import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import { BOTON, BOTON_SECUNDARIO, ErrorCarga, Etiqueta } from '@/components/ui'
import { ESTADOS_PUBLICACION } from '@/lib/estados'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import Envoltorios from './Envoltorios'

export const metadata: Metadata = { title: 'Producto personalizado' }
export const dynamic = 'force-dynamic'

export default async function PaginaPersonalizado() {
  const sesion = await exigirPermiso('maestro.ver')
  const sb = await clienteServidor()
  const puedeEditar = sesion.permisos.has('maestro.editar')

  const [{ data: extras, error }, { data: costos }, { data: recetas }, { data: envs }, { data: costosEnv }] =
    await Promise.all([
      sb
        .from('extra')
        .select('id, nombre, precio, espacios, unidad, estado, imagen_url, orden, categoria:extra_categoria_id (nombre, orden)')
        .order('orden'),
      sb.from('v_costo_extra').select('id, costo_total'),
      sb.from('extra_insumo').select('extra_id'),
      sb
        .from('envoltorio')
        .select('id, precio_base, espacios, minutos_armado, activo, estilo:estilo_id (nombre, orden), tamano:tamano_id (codigo, orden)'),
      sb.from('v_costo_envoltorio').select('id, costo_total'),
    ])

  const costoDe = new Map((costos ?? []).map((c) => [c.id, Number(c.costo_total ?? 0)]))
  const conReceta = new Set((recetas ?? []).map((r) => r.extra_id))
  const costoEnv = new Map((costosEnv ?? []).map((c) => [c.id, Number(c.costo_total ?? 0)]))

  // agrupar extras por su categoría (flores, follaje, accesorios…)
  const grupos = new Map<string, { orden: number; lista: NonNullable<typeof extras> }>()
  for (const e of extras ?? []) {
    const cat = e.categoria as { nombre: string; orden: number } | null
    const clave = cat?.nombre ?? 'Sin categoría'
    const g = grupos.get(clave) ?? { orden: cat?.orden ?? 99, lista: [] }
    g.lista.push(e)
    grupos.set(clave, g)
  }

  const envoltorios = (envs ?? [])
    .map((e) => {
      const es = e.estilo as { nombre: string; orden: number } | null
      const tm = e.tamano as { codigo: string; orden: number } | null
      return {
        id: e.id,
        estilo: es?.nombre ?? '—',
        estiloOrden: es?.orden ?? 0,
        tamano: tm?.codigo ?? '—',
        tamanoOrden: tm?.orden ?? 0,
        precio: Number(e.precio_base),
        espacios: e.espacios == null ? null : Number(e.espacios),
        minutos: e.minutos_armado,
        activo: e.activo,
        costo: costoEnv.get(e.id) ?? 0,
      }
    })
    .sort((a, b) => a.estiloOrden - b.estiloOrden || a.tamanoOrden - b.tamanoOrden)

  return (
    <div>
      <Encabezado
        titulo="Producto personalizado"
        descripcion="Las piezas con las que el cliente arma su ramo en el catálogo: un envoltorio y los extras que entren en él."
        modulo="maestro"
        permisos={sesion.permisos}
      >
        <Link href="/productos/personalizado/cotizador" className={BOTON_SECUNDARIO}>
          Cotizador
        </Link>
      </Encabezado>

      {error && <ErrorCarga que="los extras" mensaje={error.message} />}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Extras</h2>
            <p className="text-xs text-tinta-suave">
              Se agregan a un ramo y también se venden sueltos. Los <strong>espacios</strong> son lo que
              ocupan dentro del envoltorio.
            </p>
          </div>
          {puedeEditar && (
            <Link href="/productos/personalizado/extras/nuevo" className={BOTON}>
              Nuevo extra
            </Link>
          )}
        </div>

        <div className="mt-3 space-y-4">
          {[...grupos.entries()]
            .sort((a, b) => a[1].orden - b[1].orden)
            .map(([nombre, g]) => (
              <div key={nombre}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{nombre}</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.lista.map((e) => {
                    const est = ESTADOS_PUBLICACION[e.estado]
                    const costo = costoDe.get(e.id) ?? 0
                    const perdida = costo > Number(e.precio)
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/productos/personalizado/extras/${e.id}`}
                          className={`tarjeta flex items-center gap-3 p-2.5 transition hover:border-rosa-300 ${e.estado === 'inactivo' ? 'opacity-60' : ''}`}
                        >
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-rosa-50">
                            {e.imagen_url ? (
                              <Image src={e.imagen_url} alt="" fill sizes="48px" className="object-cover" />
                            ) : (
                              <span className="grid size-full place-items-center text-rosa-300">❀</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{e.nombre}</p>
                            <p className="text-xs text-tinta-suave">
                              {bs(e.precio)} · {numero(e.espacios)} esp.
                              {conReceta.has(e.id) ? (
                                <span className={perdida ? 'text-alerta' : ''}> · costo {bs(costo)}</span>
                              ) : (
                                <span> · sin receta</span>
                              )}
                            </p>
                          </div>
                          {e.estado !== 'activo' && <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Envoltorios</h2>
        <p className="text-xs text-tinta-suave">
          Estilo × tamaño. La <strong>capacidad</strong> es cuántos espacios de extras entran: es la regla
          que el catálogo usa para no dejar armar un ramo imposible. Los cambios se ven en el catálogo al
          instante.
        </p>
        <Envoltorios envoltorios={envoltorios} puedeEditar={puedeEditar} />
      </section>
    </div>
  )
}
