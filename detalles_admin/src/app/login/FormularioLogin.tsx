'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrar, type ResultadoLogin } from './acciones'

function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 w-full rounded-lg bg-rosa-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rosa-700 disabled:opacity-60"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

function IconoOjo({ abierto }: { abierto: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {abierto ? (
        <>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.75" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.4 4" />
          <path d="M6.6 7.5C3.9 9.2 2 12 2 12s3.6 6.5 10 6.5a10.6 10.6 0 0 0 4-.75" />
          <path d="M9.9 10.2a2.75 2.75 0 0 0 3.9 3.9" />
        </>
      )}
    </svg>
  )
}

export default function FormularioLogin({ volver }: { volver: string }) {
  const [estado, accion] = useActionState<ResultadoLogin | null, FormData>(
    entrar,
    null,
  )
  const [verClave, setVerClave] = useState(false)

  return (
    <form action={accion} className="tarjeta w-full max-w-sm p-7">
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full bg-rosa-100 text-xl text-rosa-700"
      >
        ❀
      </span>
      <h1 className="mt-4 text-lg font-semibold">Detalles Elena</h1>

      <input type="hidden" name="volver" value={volver} />

      <label htmlFor="email" className="mt-6 block text-sm font-medium">
        Correo
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        className="campo mt-1 focus:campo-foco"
      />

      <label htmlFor="password" className="mt-4 block text-sm font-medium">
        Contraseña
      </label>
      <div className="relative mt-1">
        <input
          id="password"
          name="password"
          type={verClave ? 'text' : 'password'}
          autoComplete="current-password"
          required
          className="campo pr-11 focus:campo-foco"
        />
        <button
          type="button"
          onClick={() => setVerClave((v) => !v)}
          aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          aria-pressed={verClave}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-tinta-suave transition hover:text-rosa-700"
        >
          <IconoOjo abierto={verClave} />
        </button>
      </div>

      {estado && !estado.ok && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta"
        >
          {estado.mensaje}
        </p>
      )}

      <BotonEntrar />
    </form>
  )
}
