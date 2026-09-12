import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresca la sesión en cada request y cierra el panel a quien no entró.
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

  // getUser() valida el token contra Supabase; getSession() solo lee la cookie
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ruta = request.nextUrl.pathname
  const esLogin = ruta.startsWith('/login')

  if (!user && !esLogin) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.searchParams.set('volver', ruta)
    return NextResponse.redirect(destino)
  }

  if (user && esLogin) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: [
    // todo menos archivos estáticos e imágenes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
