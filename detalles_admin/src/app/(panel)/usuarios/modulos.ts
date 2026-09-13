/**
 * Los módulos con los que la base agrupa los permisos (`permiso.modulo`),
 * escritos como se leen en la pantalla. Si una migración agrega un módulo
 * nuevo y acá falta, se muestra el código crudo: no rompe nada.
 */
export const ETIQUETA_MODULO: Record<string, string> = {
  administracion: 'Administración',
  maestro: 'Productos',
  cotizacion: 'Cotización',
  inventario: 'Inventario',
  compra: 'Compras',
  pedido: 'Pedidos',
  venta: 'Ventas',
  reporte: 'Reportes',
  contabilidad: 'Contabilidad',
}

/** Orden en el que conviene leerlos: primero lo de todos los días. */
export const ORDEN_MODULO = [
  'pedido',
  'venta',
  'maestro',
  'cotizacion',
  'inventario',
  'compra',
  'contabilidad',
  'reporte',
  'administracion',
]

export function ordenarModulos(modulos: string[]): string[] {
  return [...modulos].sort((a, b) => {
    const ia = ORDEN_MODULO.indexOf(a)
    const ib = ORDEN_MODULO.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
  })
}
