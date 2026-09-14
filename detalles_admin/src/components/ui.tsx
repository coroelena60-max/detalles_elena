/**
 * Piezas chicas que se repiten en todo el panel. Sin estado: sirven igual en
 * Server Components y en componentes de cliente.
 */

export function Cifra({
  etiqueta,
  valor,
  detalle,
  tono = 'normal',
}: {
  etiqueta: string
  valor: string
  detalle?: string
  tono?: 'normal' | 'destacado' | 'ok' | 'alerta'
}) {
  const fondo = {
    normal: '',
    destacado: 'border-rosa-300 bg-rosa-50',
    ok: 'border-ok/30 bg-ok-suave',
    alerta: 'border-alerta/30 bg-alerta-suave',
  }[tono]
  const color = { normal: '', destacado: '', ok: 'text-ok', alerta: 'text-alerta' }[tono]

  return (
    <div className={`tarjeta p-4 ${fondo}`}>
      <p className="text-xs uppercase tracking-wide text-tinta-suave">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  )
}

export function Aviso({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        ok ? 'bg-ok-suave text-ok' : 'bg-alerta-suave text-alerta'
      }`}
    >
      {texto}
    </p>
  )
}

export function ErrorCarga({ que, mensaje }: { que: string; mensaje: string }) {
  return (
    <p className="tarjeta mt-4 border-alerta bg-alerta-suave p-4 text-sm text-alerta">
      No pudimos cargar {que}: {mensaje}
    </p>
  )
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="tarjeta mt-4 p-6 text-sm text-tinta-suave">{children}</p>
}

export function Etiqueta({
  children,
  clase = 'bg-fondo text-tinta-suave',
}: {
  children: React.ReactNode
  clase?: string
}) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${clase}`}>
      {children}
    </span>
  )
}

/** Barras horizontales sin librería: suficiente para "qué se vende más". */
export function Barras({
  filas,
  formato,
  vacio = 'Sin datos en este rango.',
}: {
  filas: { etiqueta: string; valor: number; detalle?: string }[]
  formato: (n: number) => string
  vacio?: string
}) {
  if (filas.length === 0) return <p className="mt-2 text-sm text-tinta-suave">{vacio}</p>
  const max = Math.max(...filas.map((f) => f.valor), 0) || 1

  return (
    <ul className="mt-3 space-y-2">
      {filas.map((f, i) => (
        <li key={`${f.etiqueta}-${i}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{f.etiqueta}</span>
            <span className="shrink-0 tabular-nums">
              {formato(f.valor)}
              {f.detalle && <span className="ml-1 text-xs text-tinta-suave">{f.detalle}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fondo">
            <div
              className="h-full rounded-full bg-rosa-500"
              style={{ width: `${Math.max((f.valor / max) * 100, f.valor > 0 ? 2 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Columnas por día o por mes. Muestra el valor al pasar el mouse. */
export function Columnas({
  filas,
  formato,
}: {
  filas: { etiqueta: string; valor: number }[]
  formato: (n: number) => string
}) {
  if (filas.length === 0) {
    return <p className="mt-2 text-sm text-tinta-suave">Sin datos en este rango.</p>
  }
  const max = Math.max(...filas.map((f) => Math.abs(f.valor)), 0) || 1

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="flex h-40 min-w-full items-end gap-1" style={{ minWidth: filas.length * 18 }}>
        {filas.map((f, i) => (
          <div
            key={`${f.etiqueta}-${i}`}
            className="group relative flex h-full flex-1 flex-col items-center justify-end"
            title={`${f.etiqueta}: ${formato(f.valor)}`}
          >
            <div
              className={`w-full rounded-t ${f.valor < 0 ? 'bg-alerta' : 'bg-rosa-500'} transition group-hover:opacity-80`}
              style={{ height: `${Math.max((Math.abs(f.valor) / max) * 100, f.valor !== 0 ? 2 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-tinta-suave">
        <span>{filas[0].etiqueta}</span>
        {filas.length > 1 && <span>{filas[filas.length - 1].etiqueta}</span>}
      </div>
    </div>
  )
}

export const BOTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rosa-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60'
export const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rosa-300 bg-white px-4 py-2 text-sm font-medium text-rosa-700 transition hover:bg-rosa-50 disabled:opacity-60'
export const BOTON_SUAVE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-linea bg-white px-3 py-2 text-sm text-tinta-suave transition hover:bg-rosa-50 hover:text-tinta disabled:opacity-60'
export const CAMPO = 'campo mt-1 focus:campo-foco disabled:bg-fondo'
