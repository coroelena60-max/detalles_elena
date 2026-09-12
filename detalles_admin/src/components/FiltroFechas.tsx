import Link from 'next/link'
import { atajosDeRango, describirRango } from '@/lib/fechas'
import { BOTON } from './ui'

/**
 * Filtro "de tal fecha a tal fecha". Es un formulario GET: el rango queda en
 * la URL, así un reporte se puede recargar, compartir o dejar en favoritos.
 *
 * `extras` son otros parámetros que el filtro tiene que conservar al usar un
 * atajo (el usuario elegido en la bitácora, por ejemplo). `children` son
 * campos adicionales que se dibujan junto a las fechas.
 */
export default function FiltroFechas({
  ruta,
  desde,
  hasta,
  extras = {},
  children,
}: {
  ruta: string
  desde: string
  hasta: string
  extras?: Record<string, string | undefined>
  children?: React.ReactNode
}) {
  const conservar = Object.entries(extras).filter(([, v]) => v) as [string, string][]

  function enlace(d: string, h: string) {
    const q = new URLSearchParams([...conservar, ['desde', d], ['hasta', h]])
    return `${ruta}?${q.toString()}`
  }

  return (
    <section className="tarjeta mt-4 p-4">
      <form action={ruta} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="desde" className="block text-xs font-medium text-tinta-suave">
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desde}
            required
            className="campo mt-1 w-40 focus:campo-foco"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="block text-xs font-medium text-tinta-suave">
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hasta}
            required
            className="campo mt-1 w-40 focus:campo-foco"
          />
        </div>
        {children}
        <button type="submit" className={BOTON}>
          Ver
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        {atajosDeRango().map((a) => {
          const activo = a.desde === desde && a.hasta === hasta
          return (
            <Link
              key={a.etiqueta}
              href={enlace(a.desde, a.hasta)}
              aria-current={activo ? 'true' : undefined}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                activo
                  ? 'bg-rosa-100 font-medium text-rosa-700'
                  : 'bg-fondo text-tinta-suave hover:bg-rosa-50 hover:text-tinta'
              }`}
            >
              {a.etiqueta}
            </Link>
          )
        })}
        <span className="ml-auto text-xs text-tinta-suave">{describirRango(desde, hasta)}</span>
      </div>
    </section>
  )
}
