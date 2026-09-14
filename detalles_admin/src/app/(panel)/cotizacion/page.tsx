import type { Metadata } from 'next'
import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import { BOTON, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { bs, haceCuanto } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Cotización' }
export const dynamic = 'force-dynamic'

export default async function PaginaCotizaciones({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sesion = await exigirPermiso('cotizacion.ver')
  const { q } = await searchParams
  const sb = await clienteServidor()

  let consulta = sb
    .from('v_cotizacion')
    .select('id, codigo, nombre, costo_total, precio, ganancia, minutos, producto_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200)
  if (q?.trim()) consulta = consulta.ilike('nombre', `%${q.trim()}%`)
  const { data, error } = await consulta
  const lista = data ?? []

  return (
    <div>
      <Encabezado
        titulo="Cotización"
        descripcion="Calcula cuánto cuesta hacer un ramo y a cuánto venderlo."
        modulo="cotizacion"
        permisos={sesion.permisos}
      >
        <form className="flex gap-2">
          <input name="q" defaultValue={q ?? ''} placeholder="Buscar por nombre" aria-label="Buscar cotización" className="campo w-44 focus:campo-foco" />
        </form>
        {sesion.permisos.has('cotizacion.editar') && (
          <Link href="/cotizacion/nueva" className={BOTON}>
            Nueva cotización
          </Link>
        )}
      </Encabezado>

      {error && <ErrorCarga que="las cotizaciones" mensaje={error.message} />}

      {lista.length === 0 && !error ? (
        <Vacio>{q ? 'No hay cotizaciones con ese nombre.' : 'Todavía no hay cotizaciones. Empezá con "Nueva cotización".'}</Vacio>
      ) : (
        <ul className="tarjeta mt-4 divide-y divide-linea">
          {lista.map((c) => {
            const ganancia = Number(c.ganancia)
            const margen = Number(c.costo_total) > 0 ? (ganancia / Number(c.costo_total)) * 100 : 0
            return (
              <li key={c.id}>
                <Link href={`/cotizacion/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 transition hover:bg-rosa-50/50">
                  <span className="font-mono text-xs text-tinta-suave">{c.codigo}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nombre}</p>
                    <p className="text-xs text-tinta-suave">
                      costo {bs(c.costo_total)}
                      {Number(c.minutos) > 0 && ` · ${c.minutos} min`} · {haceCuanto(c.updated_at)}
                    </p>
                  </div>
                  {c.producto_id && <Etiqueta clase="bg-ok-suave text-ok">Es producto</Etiqueta>}
                  {ganancia < 0 && <Etiqueta clase="bg-alerta-suave text-alerta">A pérdida</Etiqueta>}
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold tabular-nums">{bs(c.precio)}</p>
                    <p className={`text-xs tabular-nums ${ganancia < 0 ? 'text-alerta' : 'text-tinta-suave'}`}>
                      gana {bs(ganancia)} ({Math.round(margen)}%)
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
