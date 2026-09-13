import type { Metadata } from 'next'
import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Cifra, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { ESTADOS_COMPRA, type EstadoCompra } from '@/lib/estados'
import { diaCorto, rangoDeParams } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import NuevaCompra from './NuevaCompra'

export const metadata: Metadata = { title: 'Compras' }
export const dynamic = 'force-dynamic'

export default async function PaginaCompras({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string }>
}) {
  const sesion = await exigirPermiso('compra.ver')
  const params = await searchParams
  const { desde, hasta } = rangoDeParams(params)
  const estado =
    params.estado && params.estado in ESTADOS_COMPRA ? (params.estado as EstadoCompra) : undefined
  const sb = await clienteServidor()

  let consulta = sb
    .from('compra')
    .select('id, codigo, fecha, estado, total, documento, proveedor:proveedor_id (nombre), items:compra_item (id)')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
  if (estado) consulta = consulta.eq('estado', estado)

  const [{ data, error }, { data: proveedores }, { data: borradores }] = await Promise.all([
    consulta,
    sb.from('proveedor').select('id, nombre').eq('activo', true).order('nombre'),
    // los borradores se muestran siempre, aunque sean de otro mes: son trabajo pendiente
    sb.from('compra').select('codigo, fecha, total').eq('estado', 'borrador').order('fecha'),
  ])

  const compras = data ?? []
  const recibidas = compras.filter((c) => c.estado === 'recibida')
  const total = recibidas.reduce((s, c) => s + Number(c.total), 0)

  return (
    <div>
      <Encabezado
        titulo="Compras"
        descripcion="Insumos que entran a la tienda. Una compra se carga como borrador y se recibe cuando llega la mercadería."
        modulo="compra"
        permisos={sesion.permisos}
      >
        {sesion.permisos.has('compra.editar') && <NuevaCompra proveedores={proveedores ?? []} />}
      </Encabezado>

      {(borradores ?? []).length > 0 && (
        <section className="tarjeta mt-4 border-aviso/30 bg-aviso-suave p-3">
          <p className="text-sm font-medium text-aviso">
            {borradores!.length} compra{borradores!.length === 1 ? '' : 's'} sin recibir
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {borradores!.map((b) => (
              <Link key={b.codigo} href={`/compras/${b.codigo}`} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-aviso hover:underline">
                {b.codigo} · {diaCorto(b.fecha)} · {bs(b.total)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <FiltroFechas ruta="/compras" desde={desde} hasta={hasta} extras={{ estado }}>
        <div>
          <label htmlFor="estado" className="block text-xs font-medium text-tinta-suave">Estado</label>
          <select id="estado" name="estado" defaultValue={estado ?? ''} className="campo mt-1 w-36 focus:campo-foco">
            <option value="">Todos</option>
            {Object.entries(ESTADOS_COMPRA).map(([k, v]) => (
              <option key={k} value={k}>{v.etiqueta}</option>
            ))}
          </select>
        </div>
      </FiltroFechas>

      {error && <ErrorCarga que="las compras" mensaje={error.message} />}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra etiqueta="Comprado (recibido)" valor={bs(total)} tono="destacado" />
        <Cifra etiqueta="Compras recibidas" valor={numero(recibidas.length)} />
        <Cifra etiqueta="En el rango" valor={numero(compras.length)} />
      </div>

      {compras.length === 0 && !error ? (
        <Vacio>No hay compras en este rango.</Vacio>
      ) : (
        <ul className="tarjeta mt-4 divide-y divide-linea">
          {compras.map((c) => {
            const est = ESTADOS_COMPRA[c.estado]
            const prov = c.proveedor as { nombre: string } | null
            const n = (c.items as { id: number }[] | null)?.length ?? 0
            return (
              <li key={c.id}>
                <Link href={`/compras/${c.codigo}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 transition hover:bg-rosa-50/50">
                  <span className="w-14 text-xs text-tinta-suave">{diaCorto(c.fecha)}</span>
                  <span className="font-mono text-xs text-tinta-suave">{c.codigo}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {prov?.nombre ?? 'Sin proveedor'}
                    <span className="ml-2 text-xs font-normal text-tinta-suave">
                      {n} insumo{n === 1 ? '' : 's'}
                      {c.documento ? ` · Doc. ${c.documento}` : ''}
                    </span>
                  </span>
                  <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>
                  <span className={`w-24 text-right text-sm font-semibold tabular-nums ${c.estado === 'anulada' ? 'text-tinta-suave line-through' : ''}`}>
                    {bs(c.total)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
