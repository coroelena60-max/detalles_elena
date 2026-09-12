'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Marca from '@/components/Marca'
import { useCarrito } from '@/lib/carrito/CarritoProvider'

const ENLACES = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/productos', etiqueta: 'Productos' },
  { href: '/extras', etiqueta: 'Extras' },
  { href: '/informacion', etiqueta: 'Información' },
]

export default function Encabezado() {
  const ruta = usePathname()
  const { cantidad, listo } = useCarrito()

  return (
    <header className="sticky top-0 z-40 border-b border-rosa-200 bg-white/90 backdrop-blur">
      <div className="contenedor flex items-center justify-between gap-3 py-3">
        <Link href="/" aria-label="Detalles Elena, ir al inicio">
          <Marca />
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {ENLACES.map((e) => {
              const activo = e.href === '/' ? ruta === '/' : ruta.startsWith(e.href)
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    aria-current={activo ? 'page' : undefined}
                    className={`rounded-full px-3 py-2 text-sm transition ${
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

        <Link
          href="/pedido"
          className="relative inline-flex items-center gap-2 rounded-full bg-rosa-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rosa-600"
        >
          Mi pedido
          {listo && cantidad > 0 && (
            <span
              aria-label={`${cantidad} artículos en el pedido`}
              className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-xs font-semibold text-rosa-700"
            >
              {cantidad}
            </span>
          )}
        </Link>
      </div>

      {/* Navegación móvil */}
      <nav aria-label="Principal móvil" className="md:hidden">
        <ul className="contenedor flex gap-1 overflow-x-auto pb-2">
          {ENLACES.map((e) => {
            const activo = e.href === '/' ? ruta === '/' : ruta.startsWith(e.href)
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  aria-current={activo ? 'page' : undefined}
                  className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                    activo
                      ? 'bg-rosa-100 font-medium text-rosa-700'
                      : 'text-tinta-suave'
                  }`}
                >
                  {e.etiqueta}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
