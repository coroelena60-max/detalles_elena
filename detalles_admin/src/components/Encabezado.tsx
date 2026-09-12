import { seccionesDe } from '@/lib/modulos'
import Pestanas from './Pestanas'

/**
 * Cabecera común de toda pantalla de módulo: título, una línea de ayuda,
 * acciones a la derecha y las pestañas del módulo debajo.
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-tinta-suave">{descripcion}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <Pestanas secciones={secciones} />
    </div>
  )
}
