# Detalles Elena — Sistema

Monorepo ligero (dos apps independientes, sin workspace compartido por ahora).

| Carpeta | Qué es | Puerto dev |
|---|---|---|
| `catalogo_web/` | Catálogo público. El cliente elige productos, arma el carrito, se crea el pedido en BD y se envía el código del pedido al WhatsApp de la tienda. | 3000 |
| `detalles_admin/` | Panel administrativo de la tienda (productos, precios, insumos, cotizador, pedidos). | 3001 |

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage) vía `@supabase/ssr`
- Gestor de paquetes: **pnpm** (no usar npm)

## Puesta en marcha (Windows, PowerShell)
```powershell
cd catalogo_web
copy .env.local.example .env.local   # llenar valores
pnpm install
pnpm dev
```
Lo mismo en `detalles_admin` (arranca en el puerto 3001).

## Estado
Proyectos recién inicializados. Pendiente: delimitación sustantiva, requerimientos
funcionales y diseño de la base de datos antes de escribir código de dominio.
