'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface Estado {
  pendientes: number
  ultimo: { id: number; codigo: string; total: number; cliente: string | null } | null
}

const CADA_MS = 30_000

/** Un "ding" corto con Web Audio: sin archivos que descargar. */
function sonar() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    for (const [i, frecuencia] of [880, 1320].entries()) {
      const osc = ctx.createOscillator()
      const vol = ctx.createGain()
      osc.frequency.value = frecuencia
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35)
      osc.connect(vol).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.4)
    }
  } catch {
    // sin audio (el navegador lo bloquea hasta que la persona toca la página): igual queda el aviso
  }
}

export default function Navegacion({
  enlaces,
  vigilarPedidos = false,
}: {
  enlaces: { href: string; etiqueta: string; base: string }[]
  vigilarPedidos?: boolean
}) {
  const ruta = usePathname()
  const router = useRouter()
  const [pendientes, setPendientes] = useState(0)
  const [nuevo, setNuevo] = useState<Estado['ultimo']>(null)
  const ultimoVisto = useRef<number | null>(null)

  useEffect(() => {
    if (!vigilarPedidos) return
    let vivo = true

    async function consultar() {
      if (document.visibilityState === 'hidden' && ultimoVisto.current !== null) return
      try {
        const r = await fetch('/api/pedidos/pendientes', { cache: 'no-store' })
        if (!r.ok || !r.headers.get('content-type')?.includes('json')) return
        const d = (await r.json()) as Estado
        if (!vivo) return
        setPendientes(d.pendientes)
        const id = d.ultimo?.id ?? 0
        if (ultimoVisto.current !== null && id > ultimoVisto.current) {
          setNuevo(d.ultimo)
          sonar()
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nuevo pedido del catálogo', {
              body: `${d.ultimo?.codigo} · ${d.ultimo?.cliente ?? ''}`,
              icon: '/icon.png',
            })
          }
          router.refresh()
        }
        ultimoVisto.current = Math.max(ultimoVisto.current ?? 0, id)
      } catch {
        // sin conexión: se reintenta en la próxima vuelta
      }
    }

    void consultar()
    const reloj = setInterval(consultar, CADA_MS)
    const alVolver = () => document.visibilityState === 'visible' && void consultar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo = false
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [vigilarPedidos, router])

  // el número también en la pestaña del navegador: "(2) Panel · Detalles Elena"
  useEffect(() => {
    if (!vigilarPedidos) return
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = pendientes > 0 ? `(${pendientes}) ${base}` : base
  }, [pendientes, vigilarPedidos, ruta])

  return (
    <>
      <nav aria-label="Módulos" className="overflow-x-auto">
        <ul className="flex gap-1">
          {enlaces.map((e) => {
            const activo = e.base === '/' ? ruta === '/' : ruta.startsWith(e.base)
            const contador = e.base === '/pedidos' && pendientes > 0 ? pendientes : 0
            return (
              <li key={e.base}>
                <Link
                  href={e.href}
                  aria-current={activo ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                    activo
                      ? 'bg-rosa-100 font-medium text-rosa-700'
                      : 'text-tinta-suave hover:bg-rosa-50 hover:text-tinta'
                  }`}
                >
                  {e.etiqueta}
                  {contador > 0 && (
                    <span
                      className="grid min-w-5 place-items-center rounded-full bg-rosa-600 px-1.5 text-[0.7rem] font-semibold leading-5 text-white"
                      aria-label={`${contador} por atender`}
                    >
                      {contador}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {nuevo && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-rosa-300 bg-white p-4 shadow-xl">
          <p className="text-sm font-semibold">🌸 ¡Entró un pedido nuevo!</p>
          <p className="mt-1 text-sm">
            <span className="font-mono">{nuevo.codigo}</span>
            {nuevo.cliente && <> · {nuevo.cliente}</>}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/pedidos/${nuevo.codigo}`}
              onClick={() => setNuevo(null)}
              className="rounded-lg bg-rosa-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rosa-700"
            >
              Ver pedido
            </Link>
            <button type="button" onClick={() => setNuevo(null)} className="text-sm text-tinta-suave hover:text-tinta">
              Cerrar
            </button>
            {'Notification' in globalThis && typeof Notification !== 'undefined' && Notification.permission === 'default' && (
              <button
                type="button"
                onClick={() => void Notification.requestPermission()}
                className="ml-auto text-xs text-rosa-700 hover:underline"
              >
                Avisarme aunque esté en otra pestaña
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
