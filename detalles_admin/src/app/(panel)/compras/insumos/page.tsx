import type { Metadata } from 'next'
import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import { Cifra, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { UNIDADES } from '@/lib/estados'
import { bs, numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import NuevoInsumo from './NuevoInsumo'

export const metadata: Metadata = { title: 'Materiales' }
export const dynamic = 'force-dynamic'

export default async function PaginaInsumos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ver?: string }>
}) {
  const sesion = await exigirPermiso('insumo.ver')
  const { q, ver } = await searchParams
  const sb = await clienteServidor()

  const [{ data, error }, { data: proveedores }, { data: recetas }] = await Promise.all([
    sb.from('v_existencia_insumo').select('*').order('nombre'),
    sb.from('proveedor').select('id, nombre').eq('activo', true).order('nombre'),
    sb.from('extra_insumo').select('insumo_id'),
  ])

  const usos = new Map<number, number>()
  for (const r of recetas ?? []) usos.set(r.insumo_id, (usos.get(r.insumo_id) ?? 0) + 1)

  const texto = q?.trim().toLowerCase()
  const todos = data ?? []
  const filas = todos
    .filter((i) => (ver === 'inactivos' ? !i.activo : i.activo))
    .filter((i) => (ver === 'reponer' ? i.bajo_minimo : true))
    .filter((i) => !texto || i.nombre?.toLowerCase().includes(texto))

  const activos = todos.filter((i) => i.activo)
  const valor = activos.reduce((s, i) => s + Math.max(Number(i.valorizado ?? 0), 0), 0)
  const reponer = activos.filter((i) => i.bajo_minimo).length

  const filtros = [
    { clave: '', etiqueta: 'En uso' },
    { clave: 'reponer', etiqueta: 'Para reponer' },
    { clave: 'inactivos', etiqueta: 'Fuera de uso' },
  ]

  return (
    <div>
      <Encabezado
        titulo="Materiales"
        descripcion="Lo que se compra para armar: papel, cinta, alambre."
        modulo="compra"
        permisos={sesion.permisos}
      >
        {sesion.permisos.has('insumo.editar') && <NuevoInsumo proveedores={proveedores ?? []} />}
      </Encabezado>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Cifra etiqueta="Materiales en uso" valor={numero(activos.length)} />
        <Cifra etiqueta="Para reponer" valor={numero(reponer)} tono={reponer ? 'alerta' : 'normal'} />
        <Cifra etiqueta="Valor del stock" valor={bs(valor)} detalle="existencia × costo" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1">
          {filtros.map((f) => (
            <Link
              key={f.clave}
              href={f.clave ? `/compras/insumos?ver=${f.clave}` : '/compras/insumos'}
              aria-current={(ver ?? '') === f.clave ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                (ver ?? '') === f.clave ? 'bg-rosa-100 font-medium text-rosa-700' : 'text-tinta-suave hover:bg-white'
              }`}
            >
              {f.etiqueta}
            </Link>
          ))}
        </nav>
        <form action="/compras/insumos" className="flex gap-2">
          {ver && <input type="hidden" name="ver" value={ver} />}
          <input name="q" defaultValue={q} placeholder="Buscar…" aria-label="Buscar material" className="campo w-44 focus:campo-foco" />
        </form>
      </div>

      {error && <ErrorCarga que="los materiales" mensaje={error.message} />}

      {filas.length === 0 && !error ? (
        <Vacio>
          {todos.length === 0
            ? 'Todavía no hay materiales cargados.'
            : 'No hay materiales con este filtro.'}
        </Vacio>
      ) : (
        <section className="tarjeta mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-linea bg-fondo text-left text-xs uppercase tracking-wide text-tinta-suave">
              <tr>
                <th className="px-3 py-2 font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">Hay</th>
                <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                <th className="px-3 py-2 text-right font-medium">Costo</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((i) => {
                const unidad = i.unidad ? UNIDADES[i.unidad] : ''
                const uso = usos.get(i.id!) ?? 0
                return (
                  <tr key={i.id} className="hover:bg-rosa-50/50">
                    <td className="px-3 py-2">
                      <Link href={`/compras/insumos/${i.id}`} className="font-medium hover:text-rosa-700 hover:underline">
                        {i.nombre}
                      </Link>
                      <span className="block text-xs text-tinta-suave">
                        por {unidad}
                        {uso > 0 ? ` · en ${uso} receta${uso === 1 ? '' : 's'}` : ' · en ninguna receta'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.bajo_minimo ? (
                        <Etiqueta clase="bg-aviso-suave text-aviso">{numero(i.existencia)}</Etiqueta>
                      ) : (
                        numero(i.existencia)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-suave">{numero(i.stock_minimo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{bs(i.costo_unitario)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{bs(i.valorizado)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
