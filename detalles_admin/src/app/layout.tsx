import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Panel · Detalles Elena',
    template: '%s · Panel Detalles Elena',
  },
  description: 'Panel administrativo de Detalles Elena.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#9d4159',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-BO" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
