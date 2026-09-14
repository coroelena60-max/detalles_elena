import { seccionesDe } from '@/lib/modulos'
import Ayuda from './Ayuda'
import Pestanas from './Pestanas'

/**
 * Cabecera común de toda pantalla de módulo: título, acciones a la derecha y
 * las pestañas del módulo debajo. La descripción NO se muestra suelta: queda
 * detrás del "?" para que la pantalla arranque con lo que hay que hacer.
 */
export default function Encabezado({
  titulo,
  descripcion,
  modulo,
  permisos,
  children,
}: {
  titulo: string
  descripcion?: string
  modulo?: string
  permisos?: Set<string>
  children?: React.ReactNode
}) {
  const secciones =
    modulo && permisos
      ? seccionesDe(modulo, permisos).map((s) => ({ href: s.href, etiqueta: s.etiqueta }))
      : []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          {descripcion && <Ayuda>{descripcion}</Ayuda>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <Pestanas secciones={secciones} />
    </div>
  )
}
