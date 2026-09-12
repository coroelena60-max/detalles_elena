import type { Metadata } from 'next'
import Encabezado from '@/components/Encabezado'
import FiltroFechas from '@/components/FiltroFechas'
import { Barras, Cifra, Columnas, ErrorCarga, Etiqueta, Vacio } from '@/components/ui'
import { ESTADOS, type EstadoPedido } from '@/lib/estados'
import { describirRango, diaCorto, rangoDeParams } from '@/lib/fechas'
import { numero } from '@/lib/formato'
import { exigirPermiso } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata: Metadata = { title: 'Bitácora' }
export const dynamic = 'force-dynamic'

const ACCIONES: Record<string, { etiqueta: string; clase: string }> = {
  insert: { etiqueta: 'Creó', clase: 'bg-ok-suave text-ok' },
  update: { etiqueta: 'Modificó', clase: 'bg-aviso-suave text-aviso' },
  delete: { etiqueta: 'Borró', clase: 'bg-alerta-suave text-alerta' },
  cambio_estado: { etiqueta: 'Cambió estado', clase: 'bg-rosa-100 text-rosa-700' },
}

/** Los nombres de tabla, dichos como se dicen en la tienda. */
const ENTIDADES: Record<string, string> = {
  pedido: 'Pedido',
  pago: 'Pago',
  cliente: 'Cliente',
  producto: 'Producto',
  extra: 'Extra',
  envoltorio: 'Envoltorio',
  categoria: 'Categoría',
  insumo: 'Insumo',
  extra_insumo: 'Receta de un extra',
  proveedor: 'Proveedor',
  compra: 'Compra',
  movimiento_inventario: 'Movimiento de stock',
  gasto: 'Gasto',
  categoria_gasto: 'Tipo de gasto',
  usuario_rol: 'Rol de un usuario',
  rol_permiso: 'Permiso de un rol',
  rol: 'Rol',
  perfil: 'Usuario',
  parametro: 'Parámetro',
}

interface Fila {
  id: number
  created_at: string
  accion: string
  entidad: string
  entidad_id: string | null
  nota: string | null
  usuario: string | null
  email: string | null
  campos: string[] | null
  estado_antes: string | null
  estado_despues: string | null
  referencia: string | null
}

interface Reporte {
  desde: string
  hasta: string
  total: number
  por_entidad: { entidad: string; acciones: number }[]
  por_accion: { accion: string; acciones: number }[]
  por_dia: { dia: string; acciones: number }[]
  filas: Fila[]
}

function horaBolivia(instante: string): string {
  return new Date(instante).toLocaleTimeString('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function diaBolivia(instante: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(
    new Date(instante),
  )
}

function etiquetaEstado(e: string | null) {
  return e && e in ESTADOS ? ESTADOS[e as EstadoPedido].etiqueta : (e ?? '—')
}

export default async function PaginaBitacora({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; usuario?: string; entidad?: string }>
}) {
  const sesion = await exigirPermiso('bitacora.ver')
  const params = await searchParams
  const { desde, hasta } = rangoDeParams(params)
  const sb = await clienteServidor()

  const usuario = params.usuario ?? ''
  const entidad = params.entidad && params.entidad in ENTIDADES ? params.entidad : ''
  const esSistema = usuario === 'sistema'
  const esUuid = /^[0-9a-f-]{36}$/i.test(usuario)

  const [{ data, error }, { data: personas }] = await Promise.all([
    sb.rpc('reporte_bitacora', {
      p_desde: desde,
      p_hasta: hasta,
      p_perfil: esUuid ? usuario : undefined,
      p_sistema: esSistema,
      p_entidad: entidad || undefined,
    }),
    sesion.permisos.has('usuario.ver')
      ? sb.from('v_usuario_admin').select('id, nombre, email').order('nombre')
      : Promise.resolve({ data: [] as { id: string | null; nombre: string | null; email: string | null }[] }),
  ])

  const reporte = data as unknown as Reporte | null
  const elegido = (personas ?? []).find((p) => p.id === usuario)
  const quien = esSistema
    ? 'el sistema'
    : elegido
      ? elegido.nombre || elegido.email
      : 'todos los usuarios'

  // agrupar la lista por día para que se lea como un diario
  const porDia = new Map<string, Fila[]>()
  for (const f of reporte?.filas ?? []) {
    const d = diaBolivia(f.created_at)
    porDia.set(d, [...(porDia.get(d) ?? []), f])
  }

  const entidadTop = reporte?.por_entidad[0]

  return (
    <div>
      <Encabezado
        titulo="Bitácora"
        descripcion="Elegí un rango de fechas y un usuario: aparece todo lo que hizo en el sistema. Se escribe sola y no se puede borrar."
        modulo="administracion"
        permisos={sesion.permisos}
      />

      <FiltroFechas
        ruta="/usuarios/bitacora"
        desde={desde}
        hasta={hasta}
        extras={{ usuario, entidad }}
      >
        <div>
          <label htmlFor="usuario" className="block text-xs font-medium text-tinta-suave">
            Usuario
          </label>
          <select
            id="usuario"
            name="usuario"
            defaultValue={usuario}
            className="campo mt-1 w-56 focus:campo-foco"
          >
            <option value="">Todos</option>
            {(personas ?? []).map((p) => (
              <option key={p.id} value={p.id ?? ''}>
                {p.nombre || p.email}
              </option>
            ))}
            <option value="sistema">El sistema (procesos automáticos)</option>
          </select>
        </div>
        <div>
          <label htmlFor="entidad" className="block text-xs font-medium text-tinta-suave">
            Sobre qué
          </label>
          <select
            id="entidad"
            name="entidad"
            defaultValue={entidad}
            className="campo mt-1 w-48 focus:campo-foco"
          >
            <option value="">Todo</option>
            {Object.entries(ENTIDADES).map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
      </FiltroFechas>

      {error && <ErrorCarga que="la bitácora" mensaje={error.message} />}

      {reporte && (
        <>
          <p className="mt-5 text-sm">
            Acciones de <strong>{quien}</strong>
            {entidad && (
              <>
                {' '}sobre <strong>{ENTIDADES[entidad].toLowerCase()}</strong>
              </>
            )}{' '}
            del <strong>{describirRango(desde, hasta)}</strong>.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra etiqueta="Acciones" valor={numero(reporte.total)} tono="destacado" />
            <Cifra
              etiqueta="Días con actividad"
              valor={numero(reporte.por_dia.length)}
            />
            <Cifra
              etiqueta="Lo que más tocó"
              valor={entidadTop ? (ENTIDADES[entidadTop.entidad] ?? entidadTop.entidad) : '—'}
              detalle={entidadTop ? `${numero(entidadTop.acciones)} acciones` : undefined}
            />
            <Cifra
              etiqueta="Tipo de acción"
              valor={
                reporte.por_accion[0]
                  ? (ACCIONES[reporte.por_accion[0].accion]?.etiqueta ?? reporte.por_accion[0].accion)
                  : '—'
              }
              detalle={reporte.por_accion
                .map((a) => `${ACCIONES[a.accion]?.etiqueta ?? a.accion} ${a.acciones}`)
                .join(' · ')}
            />
          </div>

          {reporte.total > 0 && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="tarjeta p-4">
                <h2 className="text-sm font-semibold">Actividad por día</h2>
                <Columnas
                  filas={reporte.por_dia.map((d) => ({
                    etiqueta: diaCorto(d.dia),
                    valor: d.acciones,
                  }))}
                  formato={(n) => `${numero(n)} acciones`}
                />
              </section>
              <section className="tarjeta p-4">
                <h2 className="text-sm font-semibold">Sobre qué trabajó</h2>
                <Barras
                  filas={reporte.por_entidad.slice(0, 8).map((e) => ({
                    etiqueta: ENTIDADES[e.entidad] ?? e.entidad,
                    valor: e.acciones,
                  }))}
                  formato={numero}
                />
              </section>
            </div>
          )}

          {reporte.total === 0 ? (
            <Vacio>No hay acciones registradas con estos filtros.</Vacio>
          ) : (
            <div className="mt-4 space-y-4">
              {[...porDia.entries()].map(([dia, filas]) => (
                <section key={dia} className="tarjeta overflow-hidden">
                  <h3 className="border-b border-linea bg-fondo px-4 py-2 text-xs font-medium uppercase tracking-wide text-tinta-suave">
                    {diaCorto(dia, true)} · {filas.length} acción{filas.length === 1 ? '' : 'es'}
                  </h3>
                  <ul className="divide-y divide-linea">
                    {filas.map((f) => {
                      const acc = ACCIONES[f.accion] ?? {
                        etiqueta: f.accion,
                        clase: 'bg-fondo text-tinta-suave',
                      }
                      return (
                        <li key={f.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                          <span className="w-12 shrink-0 font-mono text-xs text-tinta-suave">
                            {horaBolivia(f.created_at)}
                          </span>
                          <Etiqueta clase={acc.clase}>{acc.etiqueta}</Etiqueta>
                          <div className="min-w-0 flex-1 text-sm">
                            {ENTIDADES[f.entidad] ?? f.entidad}
                            {f.referencia ? (
                              <span className="ml-1 font-medium">{f.referencia}</span>
                            ) : (
                              f.entidad_id && (
                                <span className="ml-1 font-mono text-xs text-tinta-suave">
                                  #{f.entidad_id}
                                </span>
                              )
                            )}
                            {f.accion === 'cambio_estado' && (
                              <span className="ml-1 text-tinta-suave">
                                de {etiquetaEstado(f.estado_antes)} a{' '}
                                <strong className="text-tinta">
                                  {etiquetaEstado(f.estado_despues)}
                                </strong>
                              </span>
                            )}
                            {f.accion === 'update' && f.campos && f.campos.length > 0 && (
                              <span className="block text-xs text-tinta-suave">
                                cambió: {f.campos.slice(0, 6).join(', ')}
                                {f.campos.length > 6 ? ` y ${f.campos.length - 6} más` : ''}
                              </span>
                            )}
                            {f.nota && (
                              <span className="block text-xs text-tinta-suave">{f.nota}</span>
                            )}
                          </div>
                          {!elegido && !esSistema && (
                            <span className="shrink-0 text-xs text-tinta-suave">
                              {f.usuario || f.email || 'el sistema'}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              {reporte.filas.length < reporte.total && (
                <p className="text-xs text-tinta-suave">
                  Se muestran las últimas {numero(reporte.filas.length)} de{' '}
                  {numero(reporte.total)} acciones. Achicá el rango para ver el resto.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
