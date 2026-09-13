import { NextResponse } from 'next/server'
import { obtenerSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

/**
 * Cuántos pedidos del catálogo esperan que alguien los atienda y cuál es el
 * último que entró. La barra del panel lo consulta cada rato para avisar.
 */
export async function GET() {
  const sesion = await obtenerSesion()
  if (!sesion || !sesion.permisos.has('pedido.ver')) {
    return NextResponse.json({ pendientes: 0, ultimo: null }, { status: sesion ? 403 : 401 })
  }

  const sb = await clienteServidor()
  const [{ count }, { data: ultimo }] = await Promise.all([
    sb
      .from('pedido')
      .select('id', { count: 'exact', head: true })
      .neq('canal', 'mostrador')
      .in('estado', ['nuevo', 'enviado_whatsapp']),
    sb
      .from('pedido')
      .select('id, codigo, total, cliente:cliente_id (nombre)')
      .neq('canal', 'mostrador')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return NextResponse.json(
    {
      pendientes: count ?? 0,
      ultimo: ultimo
        ? {
            id: ultimo.id,
            codigo: ultimo.codigo,
            total: Number(ultimo.total),
            cliente: (ultimo.cliente as { nombre: string } | null)?.nombre ?? null,
          }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
