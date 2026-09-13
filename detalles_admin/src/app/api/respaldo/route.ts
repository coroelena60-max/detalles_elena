import { NextResponse } from 'next/server'
import { hoyBolivia } from '@/lib/fechas'
import { obtenerSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Database } from '@/types/database'

/**
 * Respaldo de los datos en un archivo JSON: todas las tablas del esquema
 * public, leídas con la sesión de quien descarga (RLS: el superadmin ve todo).
 * No incluye las fotos del bucket ni las contraseñas (esas viven en Supabase).
 */

type Tabla = keyof Database['public']['Tables']

const TABLAS: Tabla[] = [
  // catálogo
  'categoria', 'estilo', 'tamano', 'envoltorio', 'extra_categoria', 'extra', 'producto',
  'producto_imagen', 'producto_extra', 'zona_envio',
  // clientes y ventas
  'cliente', 'pedido', 'pedido_item', 'pedido_item_extra', 'entrega', 'pago',
  // compras, inventario y costos
  'proveedor', 'insumo', 'compra', 'compra_item', 'movimiento_inventario',
  'extra_insumo', 'envoltorio_insumo', 'producto_insumo', 'parametro',
  // contabilidad y cotización
  'categoria_gasto', 'gasto', 'cotizacion', 'cotizacion_material', 'cotizacion_extra',
  // administración
  'perfil', 'rol', 'permiso', 'rol_permiso', 'usuario_rol', 'bitacora',
]

const PAGINA = 1000

export async function GET() {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  if (!sesion.permisos.has('respaldo.descargar')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const sb = await clienteServidor()
  const datos: Record<string, unknown[]> = {}
  const errores: Record<string, string> = {}

  for (const tabla of TABLAS) {
    const filas: unknown[] = []
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await sb.from(tabla).select('*').range(desde, desde + PAGINA - 1)
      if (error) {
        errores[tabla] = error.message
        break
      }
      filas.push(...(data ?? []))
      if (!data || data.length < PAGINA) break
    }
    datos[tabla] = filas
  }

  const respaldo = {
    tienda: 'Detalles Elena',
    generado: new Date().toISOString(),
    por: sesion.email,
    nota: 'Datos de la base (esquema public). No incluye fotos ni contraseñas.',
    cantidades: Object.fromEntries(Object.entries(datos).map(([t, f]) => [t, f.length])),
    ...(Object.keys(errores).length ? { errores } : {}),
    datos,
  }

  return new NextResponse(JSON.stringify(respaldo, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="detalles-elena-respaldo-${hoyBolivia()}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
