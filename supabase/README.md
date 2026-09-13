# Base de datos — Detalles Elena

Una sola base para las dos apps: el catálogo web (anónimo) y el panel admin
(autenticado). Fuente de verdad del esquema. No editar tablas a mano en el dashboard.

## Aplicar
- **Base real** (`nrwamzgxwttgvaqqodfp`, ya tiene las 24): se aplica **solo la migración
  nueva**. Supabase → SQL Editor → pegar ese único archivo → Run. Nunca todas juntas.
- **Proyecto vacío o prueba local**: `node supabase/generar-base-nueva.mjs` arma
  `base-nueva.sql` (no se versiona). Si la base ya tiene tablas, se frena solo sin tocar nada.

`APLICAR_TODO.sql` se eliminó el 2026-09-13: correrlo entero sobre la base real pisó
precios y fotos editados en el panel (ver `../CLAUDE.md` §4).

## Fotos
1. Storage → bucket `catalogo` (lo crea la migración 0006).
2. Subir el contenido de `../assets/catalogo/` manteniendo las subcarpetas
   `productos/`, `extras/`, `marca/`.
3. Correr `migrations/0009_seed_imagenes.sql`.

## Primer administrador
El panel usa Supabase Auth. La persona se registra y después, en el SQL Editor:

```sql
select public.asignar_rol('correo@de.elena', 'admin');
```

Sin rol asignado, un usuario logueado no ve nada: todas las políticas preguntan por
un permiso concreto (`public.tiene_permiso('venta.editar')`).

## Qué hay, en orden
| Migración | Contenido |
|---|---|
| 0001–0009 | Catálogo web: maestro, pedidos, `crear_pedido()`, RLS pública, storage y seeds |
| 0010 | Usuarios, roles, permisos y bitácora |
| 0011 | Proveedores, insumos y compras |
| 0012 | Kardex de inventario y existencias |
| 0013 | Recetas, costos y el cotizador (`costear_configuracion()`) |
| 0014 | Pagos, gestión del pedido y vistas de reporte |
| 0015 | RLS y grants del panel |
| 0016 | Seed de roles y permisos |
| 0017 | Permisos de solo lectura, roles protegidos y el maestro listo para CRUD |
| 0018 | Endurecer privilegios heredados (`TRUNCATE` fuera de `anon`) |
| 0019–0020 | Usuarios del panel, candados de administradores y rol `superadmin` invisible |
| 0021 | Candados de permiso en las RPC, gastos, anulaciones y reportes por rango |
| 0022 | Cliente genérico S/N para ventas de mostrador sin cliente |
| 0023 | Cotización (calculadora de costo y precio) |
| 0024 | Permisos `pedido.*` separados de `venta.*`, agenda y respaldo |

## Agregar una migración
1. Crear `migrations/NNNN_descripcion.sql` (idempotente).
2. Probarla antes de aplicarla en el proyecto real.
3. Aplicarla sola en la base real (SQL Editor → ese archivo → Run).

## Reglas que no se rompen
- `anon` solo puede **leer** el catálogo publicado y ejecutar `crear_pedido()` y
  `marcar_pedido_enviado_whatsapp()`. Nada más.
- Los precios se recalculan siempre en la base; el navegador manda ids y cantidades.
- La existencia de inventario no se guarda como número: es la suma de
  `movimiento_inventario`.
- El catálogo de `permiso` es fijo: se cambia por migración, nunca desde el panel.
  El panel gestiona roles y qué permisos tiene cada rol.
- Toda migración tiene que poder re-ejecutarse sin error. Si agregás un trigger, probá
  la base completa en local (`generar-base-nueva.mjs`) antes de aplicarla.
- Los seeds son **solo carga inicial**: insertan si la tabla está vacía y nunca pisan
  lo que la dueña edita desde el panel (precios, nombres, estados, fotos).
