import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Encabezado from '@/components/Encabezado'
import ProgramarFecha from '@/components/ProgramarFecha'
import { ErrorCarga, Etiqueta } from '@/components/ui'
import { ESTADOS, nombreCliente, rutaPedido, type EstadoPedido } from '@/lib/estados'
import { diaCorto, esFechaValida, hoyBolivia } from '@/lib/fechas'
import { bs, numero } from '@/lib/formato'
import { exigirSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Agenda de entregas' }
export const dynamic = 'force-dynamic'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const ACTIVOS: EstadoPedido[] = ['nuevo', 'enviado_whatsapp', 'confirmado', 'en_produccion', 'listo']

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

function lunesDe(fecha: string): string {
  const dia = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7
  return sumarDias(fecha, -dia)
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const sesion = await exigirSesion()
  if (!sesion.permisos.has('pedido.ver') && !sesion.permisos.has('venta.ver')) redirect('/')

  const { semana } = await searchParams
  const hoy = hoyBolivia()
  const lunes = lunesDe(esFechaValida(semana) ? semana : hoy)
  const domingo = sumarDias(lunes, 6)
  const sb = await clienteServidor()

  const campos = 'id, codigo, canal, estado, tipo_entrega, fecha_compromiso, total, cliente, telefono, franja_horaria, minutos, resumen, created_at'
  const [semanaRes, sinFecha, atrasados, capacidadRes] = await Promise.all([
    sb.from('v_agenda').select(campos).gte('fecha_compromiso', lunes).lte('fecha_compromiso', domingo).order('fecha_compromiso'),
    sb.from('v_agenda').select(campos).is('fecha_compromiso', null).in('estado', ACTIVOS).order('created_at'),
    sb.from('v_agenda').select(campos).lt('fecha_compromiso', hoy).in('estado', ACTIVOS).order('fecha_compromiso'),
    sb.from('parametro').select('valor').eq('clave', 'minutos_taller_dia').maybeSingle(),
  ])
  const capacidad = Number(capacidadRes.data?.valor ?? 450)
  const error = semanaRes.error ?? sinFecha.error ?? atrasados.error
  const puedeEditar = (canal: string | null) =>
    sesion.permisos.has(canal === 'mostrador' ? 'venta.editar' : 'pedido.editar')

  type Fila = NonNullable<typeof semanaRes.data>[number]
  const porDia = new Map<string, Fila[]>()
  for (const p of semanaRes.data ?? []) {
    const lista = porDia.get(p.fecha_compromiso as string) ?? []
    lista.push(p)
    porDia.set(p.fecha_compromiso as string, lista)
  }
  const sinMinutos = [...(semanaRes.data ?? []), ...(sinFecha.data ?? [])].some(
    (p) => Number(p.minutos) === 0 && p.estado !== 'entregado',
  )

  function Tarjeta({ p, conFecha }: { p: Fila; conFecha: boolean }) {
    const est = ESTADOS[p.estado as EstadoPedido]
    return (
      <li className="rounded-lg border border-linea bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={rutaPedido(p.codigo, p.canal)} className="font-mono text-xs text-rosa-700 hover:underline">
            {p.codigo}
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {nombreCliente({ nombre: p.cliente, telefono: p.telefono })}
          </span>
          <Etiqueta clase={est.clase}>{est.etiqueta}</Etiqueta>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-tinta-suave">{p.resumen}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-tinta-suave">
          <span>{p.tipo_entrega === 'envio' ? '🛵 Envío' : '🏪 Retira'}</span>
          {p.franja_horaria && <span>{p.franja_horaria}</span>}
          <span>{Number(p.minutos) > 0 ? `${numero(p.minutos)} min` : 'sin minutos'}</span>
          <span className="ml-auto font-medium text-tinta">{bs(p.total)}</span>
        </div>
        {conFecha && puedeEditar(p.canal) && p.id !== null && (
          <div className="mt-2">
            <ProgramarFecha codigo={p.codigo ?? ''} pedidoId={p.id} fecha={p.fecha_compromiso} compacto />
          </div>
        )}
      </li>
    )
  }

  return (
    <div>
      <Encabezado
        titulo="Agenda de entregas"
        descripcion="Qué hay que tener listo cada día y cuánto trabajo de taller suma, contra la capacidad del día."
        modulo="pedido"
        permisos={sesion.permisos}
      >
        <div className="flex items-center gap-1">
          <Link href={`/pedidos/agenda?semana=${sumarDias(lunes, -7)}`} className="rounded-lg border border-linea bg-white px-3 py-2 text-sm hover:bg-rosa-50" aria-label="Semana anterior">←</Link>
          <Link href="/pedidos/agenda" className="rounded-lg border border-linea bg-white px-3 py-2 text-sm hover:bg-rosa-50">Esta semana</Link>
          <Link href={`/pedidos/agenda?semana=${sumarDias(lunes, 7)}`} className="rounded-lg border border-linea bg-white px-3 py-2 text-sm hover:bg-rosa-50" aria-label="Semana siguiente">→</Link>
        </div>
      </Encabezado>

      <p className="mt-3 text-sm font-medium">
        Semana del {diaCorto(lunes)} al {diaCorto(domingo, true)} · capacidad {numero(capacidad)} min por día
      </p>
      {sinMinutos && (
        <p className="mt-1 text-xs text-tinta-suave">
          Algunos pedidos cuentan 0 minutos porque sus productos o extras todavía no tienen tiempo de armado cargado (Productos → ficha → minutos).
        </p>
      )}

      {error && <ErrorCarga que="la agenda" mensaje={error.message} />}

      {(atrasados.data ?? []).length > 0 && (
        <section className="tarjeta mt-4 border-alerta p-4">
          <h2 className="text-sm font-semibold text-alerta">Atrasados ({atrasados.data!.length})</h2>
          <p className="text-xs text-tinta-suave">Tenían fecha anterior a hoy y todavía no se entregaron.</p>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {atrasados.data!.map((p) => (
              <Tarjeta key={p.id} p={p} conFecha />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DIAS.map((nombre, i) => {
          const fecha = sumarDias(lunes, i)
          const pedidos = porDia.get(fecha) ?? []
          const activos = pedidos.filter((p) => p.estado !== 'entregado')
          const minutos = activos.reduce((s, p) => s + Number(p.minutos), 0)
          const pct = capacidad > 0 ? (minutos / capacidad) * 100 : 0
          const esHoy = fecha === hoy
          return (
            <section key={fecha} className={`tarjeta p-3 ${esHoy ? 'border-rosa-400 ring-1 ring-rosa-300' : ''} ${fecha < hoy ? 'opacity-70' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {nombre} <span className="font-normal text-tinta-suave">{diaCorto(fecha)}</span>
                  {esHoy && <span className="ml-1 text-xs text-rosa-700">· hoy</span>}
                </h2>
                <span className={`text-xs tabular-nums ${pct > 100 ? 'font-semibold text-alerta' : 'text-tinta-suave'}`}>
                  {numero(minutos)} / {numero(capacidad)} min
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rosa-50">
                <div
                  className={`h-full rounded-full ${pct > 100 ? 'bg-alerta' : pct > 80 ? 'bg-amber-500' : 'bg-rosa-500'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              {pct > 100 && <p className="mt-1 text-xs text-alerta">Se pasa de la capacidad del taller: conviene mover algo.</p>}
              {pedidos.length === 0 ? (
                <p className="mt-3 text-xs text-tinta-suave">Libre.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {pedidos.map((p) => (
                    <Tarjeta key={p.id} p={p} conFecha={p.estado !== 'entregado'} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <section className="tarjeta mt-6 p-4">
        <h2 className="text-sm font-semibold">Sin fecha ({(sinFecha.data ?? []).length})</h2>
        <p className="text-xs text-tinta-suave">Pedidos y ventas activos que todavía no tienen día de entrega. Poneles fecha para que entren en la agenda.</p>
        {(sinFecha.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-tinta-suave">Todo está agendado.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {sinFecha.data!.map((p) => (
              <Tarjeta key={p.id} p={p} conFecha />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
