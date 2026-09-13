'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

/**
 * Barrita informativa de privacidad: no bloquea el catálogo y se cierra con un
 * toque. El consentimiento que vale es la casilla del formulario de pedido;
 * esto solo avisa. Se recuerda en localStorage (no es una cookie).
 */

const CLAVE_STORAGE = 'detalles-elena:aviso-privacidad:v1'

// Donde no hace falta: el formulario ya tiene su casilla, el armador tiene su
// propia barra fija abajo y en las páginas legales ya se está leyendo.
const RUTAS_SIN_AVISO = [
  '/pedido/confirmar',
  '/pedido/personalizado',
  '/terminos',
  '/privacidad',
]

const suscriptores = new Set<() => void>()
let cerradoEnMemoria = false

function suscribir(avisar: () => void) {
  suscriptores.add(avisar)
  return () => {
    suscriptores.delete(avisar)
  }
}

function estaCerrado(): boolean {
  if (cerradoEnMemoria) return true
  try {
    return localStorage.getItem(CLAVE_STORAGE) === '1'
  } catch {
    // storage bloqueado (modo privado): se muestra hasta que lo cierren
    return false
  }
}

function cerrar() {
  cerradoEnMemoria = true
  try {
    localStorage.setItem(CLAVE_STORAGE, '1')
  } catch {
    // sin storage vale lo de memoria durante la visita
  }
  suscriptores.forEach((avisar) => avisar())
}

export default function AvisoPrivacidad() {
  const ruta = usePathname()
  // en el servidor e hidratación cuenta como cerrado: evita el parpadeo y el mismatch
  const cerrado = useSyncExternalStore(suscribir, estaCerrado, () => true)

  if (cerrado || RUTAS_SIN_AVISO.some((r) => ruta.startsWith(r))) return null

  return (
    <div
      role="region"
      aria-label="Aviso de privacidad"
      className="fixed inset-x-3 bottom-3 z-30 mb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:right-4 sm:max-w-sm"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-rosa-200 bg-white p-3 pl-4 shadow-lg shadow-tinta/10">
        <p className="text-xs leading-relaxed text-tinta-suave">
          Usamos tus datos solo para gestionar tu pedido.{' '}
          <Link href="/terminos" className="text-rosa-700 underline">
            Términos
          </Link>{' '}
          ·{' '}
          <Link href="/privacidad" className="text-rosa-700 underline">
            Privacidad
          </Link>
        </p>
        <button
          type="button"
          onClick={cerrar}
          className="shrink-0 rounded-full bg-rosa-500 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-rosa-600"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
