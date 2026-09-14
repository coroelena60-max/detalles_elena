import { NextResponse, type NextRequest } from 'next/server'
import { rangoDeParams } from '@/lib/fechas'
import { obtenerSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'

/**
 * Descarga de reportes para Excel. Se arma un CSV con separador ";" y coma
 * decimal (lo que espera Excel en español) y BOM para que respete los acentos.
 * Los datos salen de las mismas RPC que las pantallas, con la sesión de quien
 * descarga: si no tiene el permiso, la base se lo niega igual.
 */

type Celda = string | number | null | undefined
type Hoja = { titulo: string; columnas: string[]; filas: Celda[][] }

function celda(v: Celda): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return String(Math.round(v * 100) / 100).replace('.', ',')
  // un texto que empieza con = + - @ Excel lo ejecuta como fórmula (el nombre de
  // un cliente del catálogo podría ser "=HYPERLINK(...)"): se lo marca como texto
  const t = /^[=+\-@\t\r]/.test(String(v)) ? `'${String(v)}` : String(v)
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

function csv(hojas: Hoja[], encabezado: string): string {
  const partes = [celda(encabezado), '']
  for (const h of hojas) {
    partes.push(celda(h.titulo), h.columnas.map(celda).join(';'))
    for (const f of h.filas) partes.push(f.map(celda).join(';'))
    partes.push('')
  }
  return '﻿' + partes.join('\r\n')
}

const n = (v: unknown) => Number(v ?? 0)

const REPORTES: Record<
  string,
  { permiso: string; nombre: string; armar: (desde: string, hasta: string) => Promise<Hoja[]> }
> = {
  gastos: {
    permiso: 'contabilidad.ver',
    nombre: 'gastos',
    async armar(desde, hasta) {
      const sb = await clienteServidor()
      const { data, error } = await sb
        .from('gasto')
        .select('codigo, fecha, descripcion, monto, metodo, comprobante, estado, motivo_anulacion, categoria:categoria_gasto_id (nombre)')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha')
      if (error) throw new Error(error.message)
      return [
        {
          titulo: 'Gastos',
          columnas: ['Código', 'Fecha', 'Tipo', 'Descripción', 'Monto (Bs)', 'Método', 'Comprobante', 'Estado', 'Motivo de anulación'],
          filas: (data ?? []).map((g) => [
            g.codigo, g.fecha, (g.categoria as { nombre: string } | null)?.nombre, g.descripcion,
            n(g.monto), g.metodo, g.comprobante, g.estado, g.motivo_anulacion,
          ]),
        },
      ]
    },
  },
  'ventas-confirmadas': {
    permiso: 'contabilidad.ver',
    nombre: 'ventas-confirmadas',
    async armar(desde, hasta) {
      const sb = await clienteServidor()
      const { data, error } = await sb.rpc('reporte_ventas_confirmadas', { p_desde: desde, p_hasta: hasta })
      if (error) throw new Error(error.message)
      const r = data as unknown as {
        cobros_por_metodo: { metodo: string; pagos: number; total: number }[]
        ventas: { codigo: string; dia: string; cliente: string | null; estado: string; canal: string; total: number; pagado: number; saldo: number; estado_pago: string }[]
      }
      return [
        {
          titulo: 'Ventas confirmadas',
          columnas: ['Código', 'Día', 'Cliente', 'Canal', 'Estado', 'Total (Bs)', 'Cobrado (Bs)', 'Saldo (Bs)', 'Pago'],
          filas: r.ventas.map((v) => [
            v.codigo, v.dia, v.cliente === 'S/N' ? 'S/C' : v.cliente, v.canal === 'mostrador' ? 'Mostrador' : 'Catálogo web',
            v.estado, n(v.total), n(v.pagado), n(v.saldo), v.estado_pago,
          ]),
        },
        {
          titulo: 'Cobros por método',
          columnas: ['Método', 'Pagos', 'Total (Bs)'],
          filas: r.cobros_por_metodo.map((c) => [c.metodo, n(c.pagos), n(c.total)]),
        },
      ]
    },
  },
  ganancias: {
    permiso: 'contabilidad.ver',
    nombre: 'ganancias',
    async armar(desde, hasta) {
      const sb = await clienteServidor()
      const { data, error } = await sb.rpc('reporte_ganancias', { p_desde: desde, p_hasta: hasta })
      if (error) throw new Error(error.message)
      const r = data as unknown as {
        ventas: number; compras: number; utilidad_bruta: number; gastos: number; ganancia: number; margen_pct: number | null
        gastos_por_categoria: { categoria: string; gastos: number; total: number }[]
        por_mes: { mes: string; ventas: number; compras: number; gastos: number; ganancia: number }[]
      }
      return [
        {
          titulo: 'Resumen',
          columnas: ['Concepto', 'Bs'],
          filas: [
            ['Ventas confirmadas', n(r.ventas)],
            ['(−) Compras recibidas', n(r.compras)],
            ['Utilidad bruta', n(r.utilidad_bruta)],
            ['(−) Gastos', n(r.gastos)],
            ['Ganancia', n(r.ganancia)],
            ['Margen %', r.margen_pct === null ? null : n(r.margen_pct)],
          ],
        },
        {
          titulo: 'Por mes',
          columnas: ['Mes', 'Ventas', 'Compras', 'Gastos', 'Ganancia'],
          filas: r.por_mes.map((m) => [m.mes, n(m.ventas), n(m.compras), n(m.gastos), n(m.ganancia)]),
        },
        {
          titulo: 'Gastos por tipo',
          columnas: ['Tipo', 'Gastos', 'Total (Bs)'],
          filas: r.gastos_por_categoria.map((g) => [g.categoria, n(g.gastos), n(g.total)]),
        },
      ]
    },
  },
  ventas: {
    permiso: 'reporte.ver',
    nombre: 'reporte-ventas',
    async armar(desde, hasta) {
      const sb = await clienteServidor()
      const { data, error } = await sb.rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta })
      if (error) throw new Error(error.message)
      const r = data as unknown as {
        resumen: Record<string, number>
        por_dia: { dia: string; pedidos: number; total: number }[]
        productos: { nombre: string; unidades: number; vendido: number }[]
        extras: { nombre: string; unidades: number; vendido: number }[]
        personalizados: { unidades: number; vendido: number }
      }
      return [
        {
          titulo: 'Resumen',
          columnas: ['Concepto', 'Valor'],
          filas: Object.entries(r.resumen).map(([k, v]) => [k.replace(/_/g, ' '), n(v)]),
        },
        {
          titulo: 'Por día',
          columnas: ['Día', 'Pedidos', 'Total (Bs)'],
          filas: r.por_dia.map((d) => [d.dia, n(d.pedidos), n(d.total)]),
        },
        {
          titulo: 'Productos',
          columnas: ['Producto', 'Unidades', 'Vendido (Bs)'],
          filas: [
            ...r.productos.map((p) => [p.nombre, n(p.unidades), n(p.vendido)] as Celda[]),
            ['Ramos personalizados', n(r.personalizados?.unidades), n(r.personalizados?.vendido)],
          ],
        },
        {
          titulo: 'Extras sueltos',
          columnas: ['Extra', 'Unidades', 'Vendido (Bs)'],
          filas: r.extras.map((e) => [e.nombre, n(e.unidades), n(e.vendido)]),
        },
      ]
    },
  },
  compras: {
    permiso: 'reporte.ver',
    nombre: 'reporte-compras',
    async armar(desde, hasta) {
      const sb = await clienteServidor()
      const { data, error } = await sb.rpc('reporte_compras', { p_desde: desde, p_hasta: hasta })
      if (error) throw new Error(error.message)
      const r = data as unknown as {
        por_proveedor: { proveedor: string; compras: number; total: number }[]
        por_insumo: { nombre: string; unidad: string; cantidad: number; total: number; costo_promedio: number }[]
        compras: { codigo: string; fecha: string; estado: string; total: number; documento: string | null; proveedor: string | null }[]
      }
      return [
        {
          titulo: 'Compras',
          columnas: ['Código', 'Fecha', 'Proveedor', 'Documento', 'Estado', 'Total (Bs)'],
          filas: r.compras.map((c) => [c.codigo, c.fecha, c.proveedor, c.documento, c.estado, n(c.total)]),
        },
        {
          titulo: 'Por insumo',
          columnas: ['Insumo', 'Unidad', 'Cantidad', 'Total (Bs)', 'Costo promedio (Bs)'],
          filas: r.por_insumo.map((i) => [i.nombre, i.unidad, n(i.cantidad), n(i.total), n(i.costo_promedio)]),
        },
        {
          titulo: 'Por proveedor',
          columnas: ['Proveedor', 'Compras', 'Total (Bs)'],
          filas: r.por_proveedor.map((p) => [p.proveedor, n(p.compras), n(p.total)]),
        },
      ]
    },
  },
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const reporte = REPORTES[tipo]
  if (!reporte) return NextResponse.json({ error: 'Reporte desconocido' }, { status: 404 })

  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  if (!sesion.permisos.has(reporte.permiso)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const q = request.nextUrl.searchParams
  const { desde, hasta } = rangoDeParams({ desde: q.get('desde') ?? undefined, hasta: q.get('hasta') ?? undefined })

  try {
    const hojas = await reporte.armar(desde, hasta)
    const cuerpo = csv(hojas, `Detalles Elena · ${reporte.nombre} · del ${desde} al ${hasta}`)
    return new NextResponse(cuerpo, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="detalles-elena-${reporte.nombre}-${desde}_${hasta}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
