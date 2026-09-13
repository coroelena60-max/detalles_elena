import Link from 'next/link'

/** Filtro de las dos pantallas de stock: todo, lo que hay que reponer, o sin stock. */
export default function FiltroStock({
  ruta,
  activo,
  conteos,
  q,
}: {
  ruta: string
  activo: string
  conteos: Record<string, number>
  q?: string
}) {
  const opciones = [
    { clave: 'todos', etiqueta: 'Todo' },
    { clave: 'reponer', etiqueta: 'Para reponer' },
    { clave: 'sin', etiqueta: 'Sin stock' },
  ]

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <nav className="flex gap-1">
        {opciones.map((o) => (
          <Link
            key={o.clave}
            href={o.clave === 'todos' ? ruta : `${ruta}?ver=${o.clave}`}
            aria-current={activo === o.clave ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              activo === o.clave ? 'bg-rosa-100 font-medium text-rosa-700' : 'text-tinta-suave hover:bg-white'
            }`}
          >
            {o.etiqueta}
            <span className="ml-1 text-xs opacity-70">{conteos[o.clave] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <form action={ruta} className="flex gap-2">
        {activo !== 'todos' && <input type="hidden" name="ver" value={activo} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar…"
          aria-label="Buscar por nombre"
          className="campo w-44 focus:campo-foco"
        />
      </form>
    </div>
  )
}
