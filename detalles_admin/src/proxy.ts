import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  COOKIE_ACTIVIDAD,
  COOKIE_INICIO,
  evaluarSesion,
  inicioDeSesion,
  opcionesCookieSesion,
  type MotivoCierre,
} from '@/lib/limitesSesion'
import { opcionesCookiesSesion } from '@/lib/supabase/cookies'

/** consultas automáticas del panel: no cuentan como que la persona está usándolo */
const SONDEOS = ['/api/pedidos/pendientes']

/**
 * Refresca la sesión en cada request, cierra el panel a quien no entró y vence
 * las sesiones por inactividad o por duración (ver lib/limitesSesion.ts).
 * (En Next 16 esto es `proxy`, antes se llamaba `middleware`.)
 * La autorización fina (qué módulo puede ver cada uno) la hace RLS en la base
 * y el layout del panel; acá solo se decide "hay sesión o no".
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: opcionesCookiesSesion,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(nuevas) {
          for (const { name, value } of nuevas) {
            request.cookies.set(name, value)
          }
          respuesta = NextResponse.next({ request })
          for (const { name, value, options } of nuevas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getClaims() valida el token (no solo lee la cookie) y trae cuándo se entró
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  const ruta = request.nextUrl.pathname
  const esLogin = ruta.startsWith('/login')
  const esApi = ruta.startsWith('/api/')

  if (!claims && !esLogin) {
    return esApi ? NextResponse.json({ error: 'Sin sesión' }, { status: 401 }) : aLogin(request, ruta)
  }

  if (claims) {
    const ahora = Date.now()
    const inicio = inicioDeSesion(claims.amr, request.cookies.get(COOKIE_INICIO)?.value)
    const actividad = Number(request.cookies.get(COOKIE_ACTIVIDAD)?.value) || null
    const motivo = evaluarSesion(inicio, actividad, ahora)

    if (motivo) {
      // solo esta sesión: las de otros dispositivos siguen con su propio reloj
      await supabase.auth.signOut({ scope: 'local' })
      const salida = esApi
        ? NextResponse.json({ error: 'Sesión vencida', motivo }, { status: 401 })
        : aLogin(request, esLogin ? '/' : ruta, motivo)
      for (const cookie of respuesta.cookies.getAll()) salida.cookies.set(cookie)
      salida.cookies.delete(COOKIE_INICIO)
      salida.cookies.delete(COOKIE_ACTIVIDAD)
      return salida
    }

    if (esLogin) {
      const destino = request.nextUrl.clone()
      destino.pathname = '/'
      destino.search = ''
      return NextResponse.redirect(destino)
    }

    if (!SONDEOS.includes(ruta)) {
      respuesta.cookies.set(COOKIE_ACTIVIDAD, String(ahora), opcionesCookieSesion())
    }
  }

  return respuesta
}

function aLogin(request: NextRequest, volver: string, motivo?: MotivoCierre) {
  const destino = request.nextUrl.clone()
  destino.pathname = '/login'
  destino.search = ''
  if (volver !== '/') destino.searchParams.set('volver', volver)
  if (motivo) destino.searchParams.set('motivo', motivo)
  return NextResponse.redirect(destino)
}

export const config = {
  matcher: [
    // todo menos archivos estáticos e imágenes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
