/**
 * El mapa del panel, calcado del diagrama de la tienda.
 *
 * Una sola lista alimenta la barra de módulos y las pestañas de cada módulo:
 * si mañana se agrega una pantalla, se agrega acá y aparece en los dos lados.
 *
 * Un módulo se muestra si la persona puede abrir AL MENOS una de sus
 * secciones, y su enlace lleva a la primera que puede abrir. Igual, quien
 * decide de verdad es la base (RLS y los candados de las funciones).
 */
import type { NombreIcono } from '@/components/Icono'

export interface Seccion {
  href: string
  etiqueta: string
  /** alcanza con tener uno de estos */
  permisos: string[]
}

export interface Modulo {
  clave: string
  etiqueta: string
  icono: NombreIcono
  /** los del día a día van a la vista en la barra; el resto, dentro de "Más" */
  principal?: boolean
  /** prefijo de ruta que marca el módulo como activo */
  base: string
  secciones: Seccion[]
}

export const MODULOS: Modulo[] = [
  {
    clave: 'tablero',
    etiqueta: 'Inicio',
    icono: 'inicio',
    principal: true,
    base: '/',
    secciones: [{ href: '/', etiqueta: 'Inicio', permisos: [] }],
  },
  {
    clave: 'administracion',
    etiqueta: 'Administración',
    icono: 'personas',
    base: '/usuarios',
    secciones: [
      { href: '/usuarios', etiqueta: 'Usuarios', permisos: ['usuario.ver'] },
      { href: '/usuarios/roles', etiqueta: 'Roles', permisos: ['rol.ver'] },
      { href: '/usuarios/permisos', etiqueta: 'Permisos', permisos: ['rol.ver'] },
      { href: '/usuarios/bitacora', etiqueta: 'Bitácora', permisos: ['bitacora.ver'] },
      { href: '/usuarios/respaldo', etiqueta: 'Respaldo', permisos: ['respaldo.descargar'] },
    ],
  },
  {
    clave: 'inventario',
    etiqueta: 'Inventario',
    icono: 'caja',
    base: '/inventario',
    secciones: [
      { href: '/inventario', etiqueta: 'Ramos', permisos: ['inventario.ver'] },
      { href: '/inventario/extras', etiqueta: 'Flores y extras', permisos: ['inventario.ver'] },
      { href: '/inventario/movimientos', etiqueta: 'Movimientos', permisos: ['inventario.ver'] },
    ],
  },
  {
    clave: 'maestro',
    etiqueta: 'Productos',
    icono: 'flor',
    principal: true,
    base: '/productos',
    secciones: [
      { href: '/productos', etiqueta: 'Productos', permisos: ['maestro.ver'] },
      {
        href: '/productos/personalizado',
        etiqueta: 'Flores y envoltorios',
        permisos: ['maestro.ver'],
      },
      { href: '/productos/categorias', etiqueta: 'Categorías', permisos: ['maestro.ver'] },
    ],
  },
  {
    clave: 'cotizacion',
    etiqueta: 'Cotización',
    icono: 'calculadora',
    base: '/cotizacion',
    secciones: [{ href: '/cotizacion', etiqueta: 'Cotizaciones', permisos: ['cotizacion.ver'] }],
  },
  {
    clave: 'compra',
    etiqueta: 'Compras',
    icono: 'camion',
    base: '/compras',
    secciones: [
      { href: '/compras', etiqueta: 'Compras', permisos: ['compra.ver'] },
      { href: '/compras/insumos', etiqueta: 'Materiales', permisos: ['insumo.ver'] },
      { href: '/compras/proveedores', etiqueta: 'Proveedores', permisos: ['proveedor.ver'] },
    ],
  },
  {
    clave: 'pedido',
    etiqueta: 'Pedidos',
    icono: 'pedidos',
    principal: true,
    base: '/pedidos',
    secciones: [
      { href: '/pedidos', etiqueta: 'Pedidos del catálogo', permisos: ['pedido.ver'] },
      { href: '/pedidos/agenda', etiqueta: 'Agenda', permisos: ['pedido.ver', 'venta.ver'] },
    ],
  },
  {
    clave: 'venta',
    etiqueta: 'Ventas',
    icono: 'vender',
    principal: true,
    base: '/ventas',
    secciones: [
      { href: '/ventas', etiqueta: 'Ventas en tienda', permisos: ['venta.ver'] },
      { href: '/ventas/clientes', etiqueta: 'Clientes', permisos: ['cliente.ver'] },
    ],
  },
  {
    clave: 'contabilidad',
    etiqueta: 'Contabilidad',
    icono: 'billetera',
    base: '/contabilidad',
    secciones: [
      {
        href: '/contabilidad',
        etiqueta: 'Gastos',
        permisos: ['contabilidad.ver', 'gasto.registrar'],
      },
      {
        href: '/contabilidad/ventas',
        etiqueta: 'Ventas confirmadas',
        permisos: ['contabilidad.ver'],
      },
      {
        href: '/contabilidad/ganancias',
        etiqueta: 'Ganancias',
        permisos: ['contabilidad.ver'],
      },
    ],
  },
  {
    clave: 'reporte',
    etiqueta: 'Reportes',
    icono: 'grafico',
    base: '/reportes',
    secciones: [
      { href: '/reportes', etiqueta: 'Reporte de ventas', permisos: ['reporte.ver'] },
      { href: '/reportes/compras', etiqueta: 'Reporte de compras', permisos: ['reporte.ver'] },
    ],
  },
]

export function puedeAbrir(seccion: Seccion, permisos: Set<string>): boolean {
  return seccion.permisos.length === 0 || seccion.permisos.some((p) => permisos.has(p))
}

/** Los módulos que la persona ve, cada uno apuntando a su primera sección abierta. */
export function modulosVisibles(permisos: Set<string>) {
  return MODULOS.flatMap((m) => {
    const abiertas = m.secciones.filter((s) => puedeAbrir(s, permisos))
    if (abiertas.length === 0) return []
    return [{ href: abiertas[0].href, etiqueta: m.etiqueta, base: m.base, icono: m.icono, principal: Boolean(m.principal) }]
  })
}

export function seccionesDe(clave: string, permisos: Set<string>): Seccion[] {
  const modulo = MODULOS.find((m) => m.clave === clave)
  return (modulo?.secciones ?? []).filter((s) => puedeAbrir(s, permisos))
}
