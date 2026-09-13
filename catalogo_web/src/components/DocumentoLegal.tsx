import Link from 'next/link'
import { FECHA_LEGAL } from '@/lib/legal'

/** Molde de las páginas legales: columna angosta y legible en el celular. */
export function DocumentoLegal({
  titulo,
  resumen,
  children,
}: {
  titulo: string
  resumen: string
  children: React.ReactNode
}) {
  return (
    <article className="contenedor max-w-2xl py-8">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="mt-1 text-xs text-tinta-suave">
        Última actualización: {FECHA_LEGAL}
      </p>
      <p className="mt-5 rounded-2xl border border-rosa-200 bg-white p-4 text-sm">
        {resumen}
      </p>
      <div className="mt-6 space-y-4">{children}</div>
      <p className="mt-8 text-xs text-tinta-suave">
        Ver también:{' '}
        <Link href="/terminos" className="text-rosa-700 hover:underline">
          Términos y condiciones
        </Link>{' '}
        ·{' '}
        <Link href="/privacidad" className="text-rosa-700 hover:underline">
          Política de privacidad
        </Link>
      </p>
    </article>
  )
}

export function Seccion({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-rosa-200 bg-white p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-tinta-suave [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-tinta [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  )
}
