'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Las pestañas de un módulo. La activa es la de prefijo más largo que calce
 * con la ruta: así /compras/insumos/12 marca "Insumos" y no "Compras".
 */
export default function Pestanas({
  secciones,
}: {
  secciones: { href: string; etiqueta: string }[]
}) {
  const ruta = usePathname()
  if (secciones.length < 2) return null

  const activa = secciones
    .filter((s) => ruta === s.href || ruta.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <nav aria-label="Secciones" className="mt-4 flex gap-1 overflow-x-auto border-b border-linea">
      {secciones.map((s) => {
        const esta = s.href === activa
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={esta ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
              esta
                ? 'border-rosa-600 font-medium text-rosa-700'
                : 'border-transparent text-tinta-suave hover:text-tinta'
            }`}
          >
            {s.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
