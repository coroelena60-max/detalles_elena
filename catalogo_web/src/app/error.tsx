'use client'

export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="contenedor py-16 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 text-sm text-tinta-suave">
        No pudimos cargar esta parte del catálogo. Probá de nuevo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white"
      >
        Reintentar
      </button>
    </div>
  )
}
