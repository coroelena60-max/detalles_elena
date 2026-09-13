import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { CarritoProvider } from '@/lib/carrito/CarritoProvider'
import AvisoPrivacidad from '@/components/AvisoPrivacidad'
import Encabezado from '@/components/Encabezado'
import PieDePagina from '@/components/PieDePagina'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Detalles Elena · Ramos y detalles hechos a mano',
    template: '%s · Detalles Elena',
  },
  description:
    'Ramos, carteras y detalles con flores hechas a mano en Cotoca y Santa Cruz. Armá tu pedido y lo cerramos por WhatsApp.',
  openGraph: {
    title: 'Detalles Elena',
    description: 'Ramos y detalles con flores hechas a mano.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#f0b6c1',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-BO">
      <body className="flex min-h-dvh flex-col">
        <CarritoProvider>
          <Encabezado />
          <main className="flex-1 pb-16">{children}</main>
          <PieDePagina />
        </CarritoProvider>
        <AvisoPrivacidad />
        <Analytics />
      </body>
    </html>
  )
}
