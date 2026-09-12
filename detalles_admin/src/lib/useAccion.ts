'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

/**
 * El patrón de siempre para un botón que llama a una server action:
 * deshabilitar mientras corre, mostrar el mensaje que devuelve y refrescar
 * la página si salió bien (los datos los vuelve a leer el servidor).
 */
export function useAccion() {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  function ejecutar<T extends { ok: boolean; mensaje: string }>(
    fn: () => Promise<T>,
    alTerminar?: (r: T) => void,
  ) {
    setAviso(null)
    iniciar(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) router.refresh()
      alTerminar?.(r)
    })
  }

  return { pendiente, aviso, setAviso, ejecutar, router }
}
