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
export interface Seccion {
  href: string
  etiqueta: string
  /** alcanza con tener uno de estos */
  permisos: string[]
}

export interface Modulo {
  clave: string
  etiqueta: string
  /** prefijo de ruta que marca el módulo como activo */
  base: string
  secciones: Seccion[]
}

export const MODULOS: Modulo[] = [
  {
    clave: 'tablero',
    etiqueta: 'Tablero',
    base: '/',
    secciones: [{ href: '/', etiqueta: 'Tablero', permisos: [] }],
  },
  {
    clave: 'administracion',
    etiqueta: 'Administración',
    base: '/usuarios',
    secciones: [
      { href: '/usuarios', etiqueta: 'Usuarios', permisos: ['usuario.ver'] },
      { href: '/usuarios/roles', etiqueta: 'Roles', permisos: ['rol.ver'] },
      { href: '/usuarios/permisos', etiqueta: 'Permisos', permisos: ['rol.ver'] },
      { href: '/usuarios/bitacora', etiqueta: 'Bitácora', permisos: ['bitacora.ver'] },
    ],
  },
  {
    clave: 'inventario',
    etiqueta: 'Inventario',
    base: '/inventario',
    secciones: [
      { href: '/inventario', etiqueta: 'Stock de productos', permisos: ['inventario.ver'] },
      { href: '/inventario/extras', etiqueta: 'Stock de extras', permisos: ['inventario.ver'] },
      { href: '/inventario/movimientos', etiqueta: 'Movimientos', permisos: ['inventario.ver'] },
    ],
  },
  {
    clave: 'maestro',
    etiqueta: 'Productos',
    base: '/productos',
    secciones: [
      { href: '/productos', etiqueta: 'Productos', permisos: ['maestro.ver'] },
      {
        href: '/productos/personalizado',
        etiqueta: 'Producto personalizado',
        permisos: ['maestro.ver'],
      },
      { href: '/productos/categorias', etiqueta: 'Categorías', permisos: ['maestro.ver'] },
    ],
  },
  {
    clave: 'compra',
    etiqueta: 'Compras',
    base: '/compras',
    secciones: [
      { href: '/compras', etiqueta: 'Compras', permisos: ['compra.ver'] },
      { href: '/compras/insumos', etiqueta: 'Insumos', permisos: ['insumo.ver'] },
      { href: '/compras/proveedores', etiqueta: 'Proveedores', permisos: ['proveedor.ver'] },
    ],
  },
  {
    clave: 'venta',
    etiqueta: 'Ventas',
    base: '/ventas',
    secciones: [
      { href: '/ventas', etiqueta: 'Ventas', permisos: ['venta.ver'] },
      { href: '/ventas/clientes', etiqueta: 'Clientes', permisos: ['cliente.ver'] },
    ],
  },
  {
    clave: 'contabilidad',
    etiqueta: 'Contabilidad',
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
    return [{ href: abiertas[0].href, etiqueta: m.etiqueta, base: m.base }]
  })
}

export function seccionesDe(clave: string, permisos: Set<string>): Seccion[] {
  const modulo = MODULOS.find((m) => m.clave === clave)
  return (modulo?.secciones ?? []).filter((s) => puedeAbrir(s, permisos))
}
