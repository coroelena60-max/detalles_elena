'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navegacion({
  enlaces,
}: {
  enlaces: { href: string; etiqueta: string; base: string }[]
}) {
  const ruta = usePathname()

  return (
    <nav aria-label="Módulos" className="overflow-x-auto">
      <ul className="flex gap-1">
        {enlaces.map((e) => {
          const activo = e.base === '/' ? ruta === '/' : ruta.startsWith(e.base)
          return (
            <li key={e.base}>
              <Link
                href={e.href}
                aria-current={activo ? 'page' : undefined}
                className={`inline-block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  activo
                    ? 'bg-rosa-100 font-medium text-rosa-700'
                    : 'text-tinta-suave hover:bg-rosa-50 hover:text-tinta'
                }`}
              >
                {e.etiqueta}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
