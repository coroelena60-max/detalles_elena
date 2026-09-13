import Link from 'next/link'
import Encabezado from '@/components/Encabezado'
import { BOTON } from '@/components/ui'
import { ESTADOS, ESTADO_PAGO, rutaPedido, nombreCliente, type EstadoPedido } from '@/lib/estados'
import { bs, haceCuanto } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

/**
 * Pedido y venta viven en la misma tabla `pedido`, pero para la tienda son dos cosas:
 * - pedido: lo que el cliente arma en el catálogo web (canal distinto de 'mostrador')
 * - venta: lo que se vende en la tienda y se carga a mano (canal 'mostrador')
 */
const TIPOS = {
  pedidos: {
    titulo: 'Pedidos',
    descripcion: 'Los pedidos del catálogo web. Aparecen acá apenas el cliente confirma y se cierran por WhatsApp.',
    ruta: '/pedidos',
    modulo: 'pedido',
    filtroInicial: 'pendientes',
    vacio: 'No hay pedidos del catálogo con este filtro.',
  },
  ventas: {
    titulo: 'Ventas',
    descripcion: 'Lo que se vende en la tienda. Se carga a mano y nace confirmado.',
    ruta: '/ventas',
    modulo: 'venta',
    filtroInicial: 'todos',
    vacio: 'No hay ventas de mostrador con este filtro.',
  },
} as const

const FILTROS = [
  { clave: 'pendientes', etiqueta: 'Por atender' },
  { clave: 'curso', etiqueta: 'En curso' },
  { clave: 'entregados', etiqueta: 'Entregados' },
  { clave: 'todos', etiqueta: 'Todos' },
] as const

const ESTADOS_POR_FILTRO: Record<string, EstadoPedido[] | null> = {
  pendientes: ['nuevo', 'enviado_whatsapp'],
  curso: ['confirmado', 'en_produccion', 'listo'],
  entregados: ['entregado'],
  todos: null,
}

export default async function ListaPedidos({
  tipo,
  searchParams,
}: {
  tipo: keyof typeof TIPOS
  searchParams: Promise<{ filtro?: string; q?: string }>
}) {
  const t = TIPOS[tipo]
  const sesion = await exigirPermiso('venta.ver')
  const { filtro: f, q } = await searchParams
  const filtro = f && f in ESTADOS_POR_FILTRO ? f : t.filtroInicial
  const sb = await clienteServidor()

  let consulta = sb
    .from('pedido')
    .select(
      'id, codigo, estado, total, canal, created_at, cliente:cliente_id (nombre, telefono)',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  consulta = tipo === 'ventas' ? consulta.eq('canal', 'mostrador') : consulta.neq('canal', 'mostrador')
  const estados = ESTADOS_POR_FILTRO[filtro] ?? null
  if (estados) consulta = consulta.in('estado', estados)
  if (q?.trim()) consulta = consulta.ilike('codigo', `%${q.trim().toUpperCase()}%`)

  const [{ data: pedidos, error }, { data: saldos }] = await Promise.all([
    consulta,
    sb.from('v_pedido_saldo').select('id, saldo, estado_pago'),
  ])

  const saldoDe = new Map(
    (saldos ?? []).map((s) => [s.id, s] as const),
  )

  return (
    <div>
      <Encabezado
        titulo={t.titulo}
        descripcion={t.descripcion}
        modulo={t.modulo}
        permisos={sesion.permisos}
      >
        <form className="flex gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="PED-00012"
            aria-label="Buscar por código"
            className="campo w-40 focus:campo-foco"
          />
          <button
            type="submit"
            className="rounded-lg border border-linea bg-white px-3 py-2 text-sm transition hover:bg-rosa-50"
          >
            Buscar
          </button>
        </form>
        {tipo === 'ventas' && sesion.permisos.has('venta.editar') && (
          <Link href="/ventas/nueva" className={BOTON}>
            Nueva venta
          </Link>
        )}
      </Encabezado>

      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <Link
            key={f.clave}
            href={`${t.ruta}?filtro=${f.clave}`}
            aria-current={f.clave === filtro ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              f.clave === filtro
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
          No pudimos cargar la lista: {error.message}
        </p>
      )}

      {pedidos && pedidos.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {pedidos.map((p) => {
            const estado = ESTADOS[p.estado]
            const cliente = p.cliente as { nombre: string; telefono: string } | null
            const saldo = saldoDe.get(p.id)
            const pago = saldo ? ESTADO_PAGO[saldo.estado_pago ?? 'pendiente'] : null
            return (
              <li key={p.id}>
                <Link
                  href={rutaPedido(p.codigo, p.canal)}
                  className="tarjeta block p-3 transition hover:border-rosa-300"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs text-tinta-suave">
                      {p.codigo}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {nombreCliente(cliente)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${estado.clase}`}>
                      {estado.etiqueta}
                    </span>
                    {pago && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${pago.clase}`}>
                        {pago.etiqueta}
                      </span>
                    )}
                    <span className="text-sm font-semibold">{bs(p.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-tinta-suave">
                    <span>{haceCuanto(p.created_at)}</span>
                    {cliente?.telefono && cliente.nombre !== 'S/N' && <span>{cliente.telefono}</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        !error && (
          <p className="tarjeta mt-4 p-6 text-sm text-tinta-suave">
            {t.vacio}
          </p>
        )
      )}
    </div>
  )
}
