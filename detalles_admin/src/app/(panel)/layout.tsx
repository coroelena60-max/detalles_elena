import Navegacion from '@/components/Navegacion'
import { modulosVisibles } from '@/lib/modulos'
import { exigirSesion } from '@/lib/sesion'
import { salir } from '@/app/login/acciones'

export default async function LayoutPanel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirSesion()

  // Se muestra solo lo que la persona puede abrir. Igual, quien decide de
  // verdad es RLS: esto es para no ofrecer puertas cerradas.
  const enlaces = modulosVisibles(sesion.permisos)

  const sinRol = sesion.permisos.size === 0

  return (
    <div className="min-h-dvh">
      <header className="border-b border-linea bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-rosa-100 text-rosa-700"
            >
              ❀
            </span>
            <span className="text-sm font-semibold">Detalles Elena</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-tinta-suave sm:inline">
              {sesion.nombre}
            </span>
            <form action={salir}>
              <button
                type="submit"
                className="rounded-lg border border-linea px-3 py-1.5 text-sm text-tinta-suave transition hover:bg-rosa-50 hover:text-rosa-700"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <Navegacion enlaces={enlaces} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {sinRol ? (
          <div className="tarjeta p-6">
            <h1 className="text-base font-semibold">
              Tu cuenta todavía no tiene rol
            </h1>
            <p className="mt-2 text-sm text-tinta-suave">
              Entraste bien, pero nadie te asignó todavía qué podés hacer. Pedile
              a la administradora que te dé un rol desde Administración.
            </p>
            <p className="mt-3 text-xs text-tinta-suave">
              Tu correo: <strong>{sesion.email}</strong>
            </p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
