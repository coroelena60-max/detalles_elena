import Icono from './Icono'

/**
 * Las explicaciones quedan escondidas detrás de un "?" y se abren al tocarlo.
 * Es un <details> nativo: funciona sin JavaScript y en Server Components.
 */
export default function Ayuda({ children }: { children: React.ReactNode }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        aria-label="Ver ayuda"
        title="Ver ayuda"
        className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-tinta-suave transition hover:bg-rosa-50 hover:text-rosa-700 group-open:bg-rosa-100 group-open:text-rosa-700 [&::-webkit-details-marker]:hidden"
      >
        <Icono nombre="ayuda" className="size-5" />
      </summary>
      <div className="fixed inset-x-4 z-30 mt-1 rounded-xl sm:absolute sm:inset-x-auto sm:left-0 sm:w-80 border border-linea bg-white p-3 text-sm font-normal text-tinta-suave shadow-lg">
        {children}
      </div>
    </details>
  )
}
