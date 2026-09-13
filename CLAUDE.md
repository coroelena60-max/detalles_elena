# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Detalles Elena** — flores y detalles hechos a mano. Todo el contexto del proyecto vive
en este archivo: leerlo completo antes de tocar código.

---

## 1. Qué es esto

Emprendimiento de flores y detalles hechos a mano (Cotoca / Santa Cruz, Bolivia).
Dos aplicaciones independientes sobre una sola base de datos Supabase.

| Carpeta | Qué es | Puerto dev | Estado |
|---|---|---|---|
| `catalogo_web/` | Catálogo público. El cliente elige productos, arma el carrito, confirma y se crea el pedido en BD. El código del pedido se manda al WhatsApp de la tienda y la venta se cierra ahí. | 3000 | **EN CURSO** |
| `detalles_admin/` | Panel administrativo de la tienda. | 3001 | **Todos los módulos construidos**, falta probarlos con datos reales |
| `supabase/` | Migraciones SQL de la base de datos (fuente de verdad del esquema). | — | Escritas y probadas; falta aplicarlas en el proyecto real |
| `assets/catalogo/` | 33 fotos optimizadas a WebP, listas para subir al bucket `catalogo`. | — | Listas |

**El catálogo web está terminado y en uso** (ya entran pedidos reales). La prioridad
ahora es el panel admin, módulo por módulo, siguiendo el diagrama del dueño:
administración, inventario, maestro, compra, venta y reportes.

---

## 2. Reglas duras

1. **Usar `pnpm`. Nunca `npm` ni `yarn`.** Ambos proyectos tienen
   `packageManager: pnpm@12.4.1` en su `package.json`.
2. **La base de datos se cambia solo por migración.** Nada de editar tablas a mano en
   el dashboard: se crea un archivo nuevo en `supabase/migrations/NNNN_descripcion.sql`,
   se prueba, y se regenera `supabase/APLICAR_TODO.sql`. Las migraciones son
   **idempotentes** (se pueden volver a ejecutar sin romper nada).
3. **La `service_role` key nunca llega al navegador.** Solo en variables de servidor del
   panel admin. El catálogo web usa únicamente la clave publicable (anon).
4. **Los precios se calculan en el servidor.** El catálogo nunca manda montos: manda
   ids y cantidades a la función `crear_pedido()`, que recalcula todo desde la BD.
5. **Mobile-first.** El tráfico entra desde el link en bio de TikTok, en 4G.
   Imágenes comprimidas, carga rápida, todo usable con una mano.
6. Todo el dominio (tablas, campos, textos de UI) **en español**. Código en inglés
   donde sea convención (`useState`, `handleSubmit`), dominio en español
   (`producto`, `pedido`, `extra`).
7. Moneda: **bolivianos (Bs)**, `numeric(10,2)` en BD, nunca float.

---

## 3. Stack

- Next.js 16.3.4 (App Router, `src/`, Turbopack) + React 19 + TypeScript strict
- Tailwind CSS v4, ESLint (config de Next)
- Supabase: Postgres + Storage (+ Auth en fase 2 para el admin)
- `@supabase/supabase-js` + `@supabase/ssr`
- Admin además: `zod` + `react-hook-form`
- Alias de imports: `@/*` → `src/*`

### Comandos

`pnpm` **no está en el PATH** de esta máquina: hay Node v24 y corepack, y pnpm@12.4.1
(el que fija `packageManager`) ya está descargado por corepack. Dos formas de usarlo:

```powershell
corepack pnpm <script>    # funciona tal cual, sin tocar nada global
corepack enable pnpm      # (opcional, una vez) deja disponible el comando `pnpm` suelto
```

Las dependencias de las dos apps ya están instaladas (`node_modules` + `pnpm-lock.yaml`
presentes). En los comandos de abajo, donde dice `pnpm` usar `corepack pnpm` mientras el
shim global no esté habilitado.

Dentro de cada app (`catalogo_web/`, `detalles_admin/`):

| Comando | Qué hace |
|---|---|
| `pnpm dev` | servidor de desarrollo (catálogo en :3000, admin en :3001) |
| `pnpm build` | build de producción |
| `pnpm start` | sirve el build |
| `pnpm type-check` | `tsc --noEmit` — correrlo antes de dar algo por terminado |
| `pnpm lint` / `pnpm lint:fix` | ESLint (config de Next) |

No hay framework de tests configurado (ni Jest, ni Vitest, ni Playwright). La verificación
hoy es `type-check` + `lint` + `build` + prueba manual del flujo en el navegador.
Si se agregan tests, documentar acá cómo correr uno solo.

Regenerar los tipos de la BD (solo después de aplicar las migraciones):

```powershell
cd catalogo_web
pnpm dlx supabase gen types typescript --project-id nrwamzgxwttgvaqqodfp > src/types/database.ts
```

### Variables de entorno

`catalogo_web/.env.local` (plantilla en `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://nrwamzgxwttgvaqqodfp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_WHATSAPP_NUMBER=591...        # sin +, configurable, NUNCA hardcodeado
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`detalles_admin/.env.local` agrega `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).

---

## 4. Base de datos

Fuente de verdad: `supabase/migrations/`. Probadas contra Postgres 16 local
(16 productos, 18 extras, RLS y `crear_pedido()` verificados).

| Archivo | Contenido |
|---|---|
| `0001_tipos_y_utilidades.sql` | enums, `slugify()`, `normalizar_telefono()`, trigger `updated_at` |
| `0002_catalogo_maestro.sql` | `categoria`, `estilo`, `tamano`, `envoltorio`, `extra_categoria`, `extra`, `producto`, `producto_imagen`, `producto_extra` |
| `0003_pedidos.sql` | `cliente`, `zona_envio`, `pedido`, `pedido_item`, `pedido_item_extra`, `entrega` |
| `0004_vistas_y_rpc.sql` | vista `v_catalogo_producto`, funciones `crear_pedido()` y `marcar_pedido_enviado_whatsapp()` |
| `0005_rls_y_permisos.sql` | RLS y grants |
| `0006_storage.sql` | bucket `catalogo` (público de solo lectura) |
| `0007_seed_catalogo.sql` | categorías, estilos, tamaños, envoltorios, extras, zonas |
| `0008_seed_productos.sql` | los 16 productos definidos + su composición |
| `0009_seed_imagenes.sql` | URLs de las fotos (correr **después** de subir `assets/catalogo/` al bucket) |
| `0010_admin_usuarios_roles.sql` | `perfil` (1-1 con `auth.users`), `rol`, `permiso`, `rol_permiso`, `usuario_rol`, `bitacora`, `tiene_permiso()`, `asignar_rol()` |
| `0011_compras_insumos.sql` | `proveedor`, `insumo`, `compra`, `compra_item` (totales por trigger) |
| `0012_inventario.sql` | `movimiento_inventario` (kardex único), vistas de existencia, `recibir_compra()`, `registrar_salida_pedido()` |
| `0013_produccion_y_costos.sql` | `parametro`, recetas (`extra_insumo`, `envoltorio_insumo`, `producto_insumo`), vistas de costo y margen, `costear_configuracion()`, `producir_extra()` |
| `0014_ventas_pagos_reportes.sql` | `pago`, campos de gestión en `pedido`, `registrar_pago()`, `cambiar_estado_pedido()`, `crear_venta_mostrador()`, vistas de reporte y `v_tablero_admin` |
| `0015_rls_panel_admin.sql` | RLS y grants del panel: todo para `authenticated` según permiso; `anon` no gana nada |
| `0016_seed_roles_permisos.sql` | 21 permisos y los roles admin / vendedor / producción |
| `0017_permisos_fijos_y_maestro.sql` | permisos de solo lectura, protección de roles de sistema, `definir_permisos_rol()`, slug y código automáticos, foto principal única, políticas de Storage por permiso, `v_producto_admin` |
| `0018_endurecer_privilegios.sql` | quita `TRUNCATE`/`TRIGGER`/`REFERENCES` heredados de `anon` y `authenticated` |
| `0019_usuarios_panel.sql` | `v_usuario_admin`, `v_rol_admin`, `cantidad_admins()` y los candados para no quedarse sin ningún administrador |
| `0020_superadmin.sql` | rol `superadmin` con acceso total; el rol y las cuentas que lo tienen quedan **invisibles** para todos los demás |
| `0021_contabilidad_reportes_y_candados.sql` | candado de permiso en todas las RPC del panel, `gasto` + `categoria_gasto`, `anular_compra()`/`anular_gasto()`, reportes por rango (`reporte_ventas`, `reporte_compras`, `reporte_ventas_confirmadas`, `reporte_ganancias`, `reporte_bitacora`), vistas `v_kardex` y `v_cliente_resumen`, bitácora sin cambios vacíos |

### Cómo aplicarlas

Supabase → SQL Editor → pegar `supabase/APLICAR_TODO.sql` → Run.
(Es la concatenación de las 21 en orden. Si se agrega una migración, regenerarlo.)

Storage: crear/usar el bucket `catalogo` y subir `assets/catalogo/` manteniendo las
subcarpetas `productos/`, `extras/`, `marca/`. Recién después correr `0009`.

### Modelo, en corto

- `producto` = ramo/detalle ya definido y fotografiado, con **precio propio** y
  `descripcion` editable. Su composición está en `producto_extra`.
- `extra` = ítem que se agrega a un ramo y también se vende suelto (rosa Bs 4,
  girasol Bs 5, Hot Wheels Bs 15, corona Bs 15…). Tiene `espacios` = volumen que ocupa.
- `envoltorio` = `estilo` × `tamano` (cono S…XXXL, abanico XS…XXL, cartera, caja corazón),
  con `precio_base` y `espacios` = capacidad.
- **Regla de capacidad ("mochila"):** los extras de un ramo no pueden sumar más
  `espacios` que la capacidad del envoltorio. Rosa 1, girasol 2, margarita 1,
  Hot Wheels 2, peluche 8, corona/tarjeta 0. Está validada en `crear_pedido()`.
  Como "todo combina con todo", **no hay matriz de compatibilidad**: la única regla es el espacio.
- `pedido` → `pedido_item` → `pedido_item_extra`. Los nombres y precios de las líneas son
  **snapshot**: si mañana cambia el precio de la rosa, los pedidos viejos no se mueven.
- `pedido.codigo` es generado: `PED-00456`. Es lo que se manda por WhatsApp.

### Seguridad (ya implementada, no romperla)

- RLS activo en todas las tablas.
- Con la clave anon **solo** se puede: leer el catálogo publicado
  (`estado in ('activo','agotado','temporada')`) y llamar a dos funciones.
- `pedido`, `pedido_item`, `pedido_item_extra`, `cliente`, `entrega`:
  sin políticas y con `grant` revocado para anon. **Nadie lee pedidos desde el navegador.**
- Escribir un pedido se hace **solo** por `crear_pedido(p_cliente, p_items, p_entrega, p_nota)`,
  que es `security definer` y valida: nombre, teléfono (7–15 dígitos), dirección si es envío,
  productos/extras publicados, cantidades (1–99), máximo 50 líneas y la regla de espacios.
  Devuelve `{id, codigo, subtotal, total, estado}`.
- `marcar_pedido_enviado_whatsapp(codigo)` se llama cuando el cliente abre WhatsApp
  (sirve para medir conversión: pedidos armados vs. pedidos que llegaron).

Ejemplo de llamada desde el catálogo:

```ts
const { data, error } = await supabase.rpc('crear_pedido', {
  p_cliente: { nombre, telefono, email },
  p_items: [
    { tipo: 'producto', producto_id: 3, cantidad: 1, dedicatoria: 'Feliz cumple' },
    { tipo: 'extra', extra_id: 11, cantidad: 1 },
    { tipo: 'personalizado', envoltorio_id: 9, cantidad: 1,
      extras: [{ extra_id: 1, cantidad: 10 }, { extra_id: 3, cantidad: 1 }] },
  ],
  p_entrega: { tipo: 'envio', direccion: '...', referencia: '...', fecha_entrega: '2026-09-20' },
  p_nota: 'Entregar en la tarde',
})
```

---

### Lo que la base ya le da al panel admin

Una sola base para las dos apps. Cada módulo del diagrama tiene su lugar:

| Módulo | Tablas | Funciones / vistas |
|---|---|---|
| Administración | `perfil`, `rol`, `permiso`, `rol_permiso`, `usuario_rol`, `bitacora` | `tiene_permiso()`, `es_admin()`, `mis_permisos()`, `asignar_rol()`, `definir_permisos_rol()`, `v_usuario_admin`, `v_rol_admin`, `v_rol_permiso` |
| Inventario | `movimiento_inventario` | `registrar_movimiento()`, `v_existencia_insumo/_extra/_producto`, `v_stock_bajo` |
| Maestro | las del catálogo + recetas (`extra_insumo`, `envoltorio_insumo`, `producto_insumo`) | `v_costo_extra`, `v_costo_envoltorio`, `v_costo_producto`, `v_margen_producto` |
| Compra | `proveedor`, `insumo`, `compra`, `compra_item` | `recibir_compra()`, `recalcular_compra()` |
| Venta | `pedido` (+ `descuento`, `atendido_por`, `entregado_at`, `nota_interna`), `pago`, `cliente` | `registrar_pago()`, `cambiar_estado_pedido()`, `crear_venta_mostrador()`, `recalcular_pedido()`, `v_pedido_saldo` |
| Contabilidad | `gasto`, `categoria_gasto` | `anular_gasto()`, `reporte_ventas_confirmadas()`, `reporte_ganancias()` |
| Reporte | — | `reporte_ventas()`, `reporte_compras()`, `reporte_bitacora()` (por rango de fechas) y las vistas `v_reporte_*`, `v_tablero_admin` |

Decisiones que conviene no re-discutir:

- **La identidad la maneja Supabase Auth.** `perfil` se crea solo con un trigger sobre
  `auth.users`. El panel nunca guarda contraseñas.
- **Autorización por permiso, no por rol.** Las políticas RLS preguntan
  `tiene_permiso('venta.editar')`, nunca "es admin".
- **El catálogo de permisos es FIJO.** `permiso` es de solo lectura incluso para el
  admin (grant revocado, política solo de `select`). Los 21 permisos se definen en la
  migración 0016; agregar uno nuevo es una migración, no una pantalla. Lo que el panel
  gestiona es **roles**: crearlos, borrarlos y decidir qué permisos tiene cada uno
  (`rol_permiso`, la vista `v_rol_permiso` y la función `definir_permisos_rol()`, que
  recibe la lista final de códigos).
- **Candados contra quedarse afuera**: los roles `es_sistema` (admin, vendedor,
  producción) no se pueden borrar, y al rol admin no se le pueden quitar permisos;
  `sincronizar_permisos_admin()` le reparte los permisos nuevos que traiga una
  migración futura.
- **Nombrar al primer administrador**: la persona se registra en el panel y después,
  en el SQL Editor, `select public.asignar_rol('correo@de.elena','admin');`
  (esa función está revocada para anon y authenticated a propósito).
- **La existencia nunca se guarda como número.** Es la suma de `movimiento_inventario`,
  así siempre se puede explicar. `recibir_compra()` y `registrar_salida_pedido()` son
  idempotentes por la columna `referencia`.
- **El costo sube por receta**: insumo → extra → producto. `costear_configuracion()`
  recibe el mismo payload que el armador del catálogo (envoltorio + extras) y devuelve
  costo, minutos y precio sugerido redondeado a múltiplo de 5. Es el motor compartido
  del que habla la §6: adentro costo, afuera precio.
- **Gestionar producto (CRUD)** tiene el trabajo sucio resuelto en la base:
  el `slug` y el `codigo` (AB-M-003) se generan solos si el panel no los manda;
  renombrar un producto **no** le cambia el slug (la URL ya circula por TikTok) — para
  regenerarlo a propósito se manda `slug = ''`; marcar una foto como principal desmarca
  la anterior; y `v_producto_admin` trae la grilla completa (todos los estados, fotos,
  costo, margen, existencia) en una sola consulta. Las fotos se suben y se borran del
  bucket `catalogo` con permiso `maestro.editar`.
- **Ojo con los triggers al re-ejecutar seeds**: el de slug solo desambigua cuando el
  slug se genera desde el nombre, y el de foto principal no toca la fila que un
  `on conflict` va a actualizar. Sin esas dos salvedades, `APLICAR_TODO.sql` deja de ser
  idempotente (pasó, y por eso está probado).
- **Venta de mostrador y pedido web son la misma tabla**, se distinguen por `canal`.
- Las recetas y los insumos están **vacíos**: el esquema existe, los datos los carga la
  dueña desde el panel. Mientras tanto `v_costo_producto` solo cuenta la mano de obra
  (por eso AB-XS-001 ya aparece a pérdida: Bs 20 de precio contra Bs 23,33 de tiempo).

## 5. Requerimientos del catálogo web

1. El cliente **no se registra**. Entra y ve todos los productos.
2. Puede armar un pedido con varios productos y/o extras en un carrito.
3. Al **confirmar la compra** se le pide sus datos personales y, si es envío,
   los datos de entrega.
4. Se crea el pedido en la BD y **el código del pedido se manda al WhatsApp de la tienda**.
   La venta se concluye en WhatsApp. Sin pasarela de pagos.
5. El envío **no** entra en el total: se cotiza por WhatsApp. Mostrarlo así en la UI.

### Estructura de páginas (definida por el dueño)

```
INICIO        bienvenida · más vendidos · lista de categorías · lista de extras
PRODUCTOS     lista de ramos por categoría
PEDIDO        carrito · pedido personalizado
COMPRAR       confirmar pedido · formulario (nombre del cliente, datos de envío)
INFORMACION   datos de la tienda · contacto y redes
```

### Detalles que importan

- El mensaje de WhatsApp debe ser **corto**: saludo + código del pedido + nombre.
  No volcar todo el detalle en la URL: `wa.me/...?text=` se degrada pasando
  ~1.500–2.000 caracteres y un pedido grande la revienta. El detalle se consulta
  por el código.
- El número de WhatsApp viene de `NEXT_PUBLIC_WHATSAPP_NUMBER`. Nunca escrito en el código.
- Estados de producto: `activo`, `agotado`, `temporada` se muestran distinto en la UI
  (`agotado` no se puede agregar al carrito).
- `precio_desde = true` → mostrar "desde Bs X" en vez de precio fijo.
- Mostrar el plazo de entrega (`lead_time_dias`) en la ficha del producto.

---

### Cómo está construido el catálogo (mapa del código)

Tres caminos y ninguno más. Respetarlos es lo que sostiene la regla de que los precios
se calculan en el servidor:

1. **Lectura** — solo Server Components, y solo a través de `src/lib/consultas.ts`
   (`obtenerProductos`, `obtenerDestacados`, `obtenerProductoPorSlug`,
   `obtenerComposicion`, `obtenerExtras`, `obtenerZonasEnvio`…). Es el único módulo que
   habla con Supabase para leer; usa `clienteServidor()` (clave anon, sin sesión).
   Nada de consultar la BD desde un componente de cliente.
2. **Carrito** — vive *solo* en el navegador. `src/lib/carrito/almacen.ts` es un store
   externo sobre `localStorage` (clave `detalles-elena:carrito:v1`; cada línea se valida
   al leer) que `CarritoProvider` expone con `useSyncExternalStore`; los componentes usan
   `useCarrito()`. `listo` es `false` durante SSR e hidratación: usarlo para no pintar
   cantidades que provoquen mismatch. Los precios guardados en el carrito son **solo de
   referencia visual**.
3. **Escritura** — un único punto: `src/app/pedido/acciones.ts` (`'use server'`).
   `crearPedido()` valida en grueso y llama a la RPC `crear_pedido`, que recalcula todo.
   `marcarEnviadoWhatsapp()` es la métrica de conversión. Nunca hacer `insert` desde un
   componente.

Flujo de compra: `/pedido` (`VistaCarrito`) → `/pedido/confirmar` (`FormularioPedido`,
form nativo + `useTransition`) → `crearPedido()` → `vaciar()` → `router.push`
`/pedido/[codigo]?n=<nombre>&t=<total>` → `BotonWhatsapp` abre `wa.me` y marca el pedido.
La página del código **no lee la BD** (anon no puede leer `pedido`): el nombre y el total
viajan en la query string.

Convenciones de UI:
- Los tokens de diseño están en `src/app/globals.css` con `@theme` (Tailwind v4, sin
  `tailwind.config`): `rosa-50…700`, `tinta`, `tinta-suave`, `verde-wa` y la utilidad
  `contenedor`. Usar esas clases, no hex sueltos.
- Fotos: siempre `<ImagenCatalogo>`, que cae en el marcador ❀ cuando todavía no hay URL.
  `next.config.ts` deriva el host permitido de `NEXT_PUBLIC_SUPABASE_URL`.
- Montos: siempre `bs()` / `precioProducto()` de `src/lib/formato.ts`.
- Si una consulta de catálogo falla, la página renderiza `<AvisoError>` en vez de
  reventar (es lo que se ve mientras la BD no esté aplicada).
- `src/lib/env.ts` tira error al importarse si falta la URL o la clave de Supabase.

**Armado personalizado** (`/pedido/personalizado`): `ArmadoPersonalizado.tsx` es el paso
de envoltorio + extras. Una línea `personalizado` del carrito lleva `referenciaId` =
`envoltorio_id` y su lista de `extras`; su clave se arma con la receta
(`clavePersonalizado()` en `carrito/tipos.ts`), así dos ramos iguales suman cantidad y
uno distinto es otra línea. La regla de espacios está **repetida** en el front solo para
guiar (deshabilita el `+` y el botón de agregar); la que manda sigue siendo la de
`crear_pedido()`. Si cambia la regla en la BD, actualizar también `cabe()` en ese
componente.

Cuidado con la regla de espacios: `crear_pedido()` compara los extras **que manda el
cliente** contra la capacidad del envoltorio, sin descontar los que el producto ya trae
en `producto_extra`. Si alguna vez se permite sumarle extras a un producto ya armado,
eso se arregla en una migración nueva, no en el front.

## 5.5 El panel admin (`detalles_admin/`)

Construido sobre el mismo Supabase, pero con sesión: el panel usa la clave publicable
**más la sesión del usuario**, nunca la `service_role`. Quien autoriza es RLS.

| Archivo | Para qué |
|---|---|
| `src/proxy.ts` | Refresca la sesión en cada request y manda al login si no hay. En Next 16 esto reemplaza a `middleware.ts` (mismo archivo, función `proxy`). |
| `src/lib/supabase/servidor.ts` | Cliente para Server Components y server actions, con las cookies de la sesión. |
| `src/lib/sesion.ts` | `obtenerSesion()` (perfil + permisos vía la RPC `mis_permisos`), `exigirSesion()` y `exigirPermiso('venta.ver')`. |
| `src/lib/estados.ts` | Etiquetas y colores de cada estado, el siguiente paso natural del pedido, y la lista de MÓDULOS con el permiso que abre cada uno. |
| `src/app/(panel)/layout.tsx` | Shell: cabecera, navegación filtrada por permiso y el aviso de "tu cuenta no tiene rol". |
| `src/types/database.ts` | **Generado** con `supabase gen types`. A diferencia del catálogo, acá los tipos salen de la base. Regenerar después de cada migración. |

Reglas del panel:

- **Esconder un botón no es proteger nada.** La UI se filtra por permiso para no ofrecer
  puertas cerradas, pero la que dice que no es RLS. Toda página de módulo empieza con
  `await exigirPermiso(...)`.
- **Las escrituras con reglas de negocio van por RPC**, no por `update` suelto:
  `cambiar_estado_pedido()` (que al entregar descuenta inventario y escribe la bitácora),
  `registrar_pago()`, `recibir_compra()`, `producir_extra()`. El panel no calcula montos
  ni estados a mano, igual que el catálogo.
- **No hay registro público.** Las cuentas se crean en Supabase (Authentication → Add
  user) y se les asigna rol con `select public.asignar_rol('correo','admin')`. El primer
  admin se nombra así por única vez; de ahí en más los roles se dan desde `/usuarios`.
- **Los candados están en la base, no en la pantalla.** Nadie se quita a sí mismo el rol
  admin, nadie se desactiva a sí mismo y no se puede dejar la tienda sin ningún
  administrador activo (triggers de la 0019/0020). La UI solo traduce esos errores.
- **Hay dos escalones: `superadmin` y `admin`.** Para quien no es superadmin, el rol
  `superadmin` y las personas que lo tienen **no existen**: no aparecen en `rol`,
  `perfil`, `usuario_rol`, `rol_permiso`, `bitacora` ni en las vistas del panel, y
  tampoco se pueden asignar a mano por la API (0020). No es la UI escondiendo botones:
  son políticas RLS, así que la sesión de un admin no las ve ni consultando a mano.
  Como el admin igual tiene los 21 permisos, la diferencia práctica entre los dos roles
  es exactamente esa visibilidad.
- **Toda RPC del panel empieza con `perform public.exigir_permiso('...')`.** Las funciones
  son `security definer` y eso se saltea RLS: sin el candado, cualquier cuenta con sesión
  podía cobrar, entregar pedidos o mover stock (pasó hasta la 0021). Si se escribe una
  función nueva que escribe datos, lleva su `exigir_permiso` en la primera línea.
- **Gasto ≠ compra.** Una compra trae insumos que entran al inventario; un gasto es plata
  que sale y no vuelve como mercadería (alquiler, luz, delivery, publicidad). Un gasto no
  se edita ni se borra (grant revocado): se anula con motivo.
- **Ganancia = ventas confirmadas − compras recibidas − gastos**, por fecha de calendario
  de Bolivia. "Venta confirmada" = estado `confirmado`, `en_produccion`, `listo` o
  `entregado` (`estados_venta_confirmada()`). Es caja simple: no descuenta el stock que
  sobró. Si se cambia la definición, se cambia en esas funciones, no en la pantalla.
- **Los reportes son RPC con su propio permiso** (`reporte.ver`, `contabilidad.ver`) y
  devuelven jsonb agregado: quien los ve no necesita permiso sobre cada tabla de abajo.
- **Un pedido entregado no vuelve atrás** (ya descontó inventario).
- **Los dos roles de arriba siempre tienen todo**: `definir_permisos_rol()` rechaza a
  `admin` y a `superadmin`, y `sincronizar_permisos_admin()` les reparte los permisos
  que traiga una migración futura.

Estructura: `src/lib/modulos.ts` es el mapa del panel (calcado del diagrama del dueño).
De esa lista salen la barra de módulos y las pestañas de cada uno (`<Encabezado modulo=…>`).
Una pantalla nueva se agrega ahí. Piezas compartidas: `components/ui.tsx` (cifras,
barras, avisos, clases de botón), `components/FiltroFechas.tsx` (rango en la URL, con
atajos), `lib/fechas.ts` (fechas de calendario de Bolivia como texto AAAA-MM-DD, nunca
`new Date('2026-09-01')`), `lib/useAccion.ts` (botón → server action → aviso → refresh) y
`lib/acciones.ts` (`traducirError`).

Módulos construidos (todos los del diagrama):

| Módulo | Rutas |
|---|---|
| Administración | `/usuarios` (usuarios), `/usuarios/roles`, `/usuarios/permisos`, `/usuarios/bitacora` (reporte por fechas + usuario + entidad) |
| Inventario | `/inventario` (stock de productos), `/inventario/extras` (con "producir" que descuenta la receta), `/inventario/movimientos` (kardex) |
| Productos (maestro) | `/productos` (CRUD, fotos, composición), `/productos/personalizado` (extras con receta y foto, envoltorios, `/cotizador`), `/productos/categorias` |
| Compras | `/compras` (borrador → insumos → recibir/anular), `/compras/insumos`, `/compras/proveedores` |
| Ventas | `/ventas` (pedidos; antes `/pedidos`), `/ventas/nueva` (mostrador), `/ventas/clientes` |
| Contabilidad | `/contabilidad` (gastos), `/contabilidad/ventas` (confirmadas), `/contabilidad/ganancias` |
| Reportes | `/reportes` (ventas), `/reportes/compras` |

Detalles de UX que son decisiones, no descuidos:
- Mover stock no pide "cantidades con signo": se elige *Entrada*, *Conté* (se escribe lo
  que hay y el sistema ajusta la diferencia), *Merma* o *Devolución*.
- Los componentes de cliente no reciben funciones desde el servidor (no se serializan):
  se pasan prefijos de ruta o server actions con `.bind`.
- Las fotos que sube el panel a `catalogo/extras/` llevan prefijo `panel-`; solo esas se
  borran del bucket al reemplazarlas (las del seed no se tocan).

## 6. Contexto de negocio que cambia decisiones

Viene del análisis en los docs del proyecto Claude (`analisis-alcance-v1`,
`analisis-datos-precios-v2`, `analisis-costos-margenes-v3`). Lo esencial:

- Las flores **se fabrican a mano** (no se compran). Son semielaborados con su propia
  receta y tiempo. Esto importa para el cotizador del admin, no para el catálogo.
- **Sus precios no siguen una fórmula**: son intuición anclada en múltiplos de 5, con
  desvíos de −20% a +68% respecto de la suma de envoltorio + extras. Por eso el cotizador
  del admin deberá calcular **costo** y *sugerir* precio, no repetir precios de lista.
- **4 de 20 productos se venden a pérdida** con mano de obra a Bs 20/h; los de Bs 20
  (abanico XS y cono S con 1 girasol) pierden ~Bs 12 cada uno. Ojo si se los usa
  como gancho de "desde Bs 20" en el catálogo.
- El cotizador del admin y el "armá tu ramo" del catálogo son **el mismo motor de
  configuración**: adentro muestra costo, afuera muestra precio. Si se construyen
  separados, divergen a los dos meses. Por eso `envoltorio` + `extra` + `espacios`
  ya están en el esquema compartido.
- Capacidad del taller ≈ 420–480 minutos/día. Relevante para la agenda del admin.

---

## 7. Datos pendientes de confirmar con la dueña

Marcados como `estado = 'borrador'` en la tabla `extra` (no salen al catálogo):
peluche oso dormilón (Bs 70 sugerido), peluche Stitch (Bs 100), luz led (Bs 15),
porta tarjeta (Bs 5). Son precios propuestos, no confirmados.

Además faltan en el catálogo (existen en PRECIOS.docx pero **sin foto**, así que no se
cargaron): cono M con 1 girasol y 7 rosas (Bs 60), cono M con 3 girasoles (Bs 55),
cono L con 5 girasoles (Bs 85), cono S con 1 girasol (Bs 20), caja corazón (Bs 130).

El extra "Hot Wheels" a Bs 15 probablemente se vende a pérdida (la caja sola cuesta
Bs 8,33 y falta el costo del autito).

---

## 8. Estado y próximos pasos

Hecho (último corte: 2026-09-12):
- [x] Los dos proyectos Next.js scaffoldeados; `pnpm install` corrido en ambos
- [x] Esquema completo de BD + RLS + `crear_pedido()`
- [x] **Migraciones 0001–0009 aplicadas en el proyecto real** (`nrwamzgxwttgvaqqodfp`,
      Postgres 17.6): 16 productos, 24 filas de composición, 18 extras, 14 envoltorios,
      4 categorías, 3 zonas
- [x] **Las 33 fotos subidas al bucket `catalogo`** (productos/, extras/, marca/) y la
      0009 corrida: 17 imágenes de producto (16/16 con principal) y 14 extras con foto
- [x] **Catálogo web completo**, incluido el armado personalizado
      (`/pedido/personalizado`): inicio, productos por categoría, ficha con galería y
      composición, extras, carrito, armador, confirmación, código de pedido con botón de
      WhatsApp, información, 404 y error boundary
- [x] Flujo probado de punta a punta desde el navegador: ramo armado (Cono L + 6
      girasoles) → PED-00001 con total Bs 70 exacto en la tabla `pedido` → enlace
      `wa.me/59163398762`. El pedido de prueba se borró y el contador quedó en 1.
- [x] `type-check`, `lint` y `build` pasan en limpio
- [x] **Esquema del panel admin aplicado** (migraciones 0010–0016): usuarios/roles/
      permisos/bitácora, proveedores, insumos, compras, kardex de inventario, recetas y
      costeo, pagos y reportes. 31 tablas y 17 vistas, todas con RLS.
- [x] Circuito del panel probado: compra recibida → stock y costo promedio; receta →
      costo del extra Bs 2,20 y cotización de un Cono L con 10 flores (Bs 22 de costo,
      Bs 35 sugerido); cobro parcial + total; entrega que descuenta stock y queda en la
      bitácora. Todos los datos de prueba se borraron y los contadores quedaron en 1.
- [x] Auditoría de seguridad: `anon` solo tiene SELECT sobre el catálogo publicado;
      cero tablas sin RLS
- [x] **Permisos fijos** (0017): el panel gestiona roles y su composición, no permisos
- [x] **Maestro listo para el CRUD** (0017): slug/código automáticos, slug estable al
      renombrar, foto principal única, Storage por permiso y `v_producto_admin`
- [x] **Privilegios heredados cerrados** (0018): `anon` tenía `TRUNCATE` sobre
      `producto`, `pedido` y `cliente` por los defaults de Supabase — y TRUNCATE no
      respeta RLS
- [x] `APLICAR_TODO.sql` (18 migraciones) re-ejecutado entero sobre la base ya
      aplicada: pasa sin tocar un dato
- [x] **Panel admin arrancado**: auth con Supabase (login + proxy de sesión), tipos
      generados desde la base, shell con navegación por permiso, tablero, módulo de
      pedidos y módulo de productos (CRUD + fotos + composición). `type-check`, `lint`
      y `build` en limpio, y las 13 consultas del panel validadas contra la base real.
- [x] **Cuenta del dueño**: `corojosue91@gmail.com` con el rol **superadmin**
      (acceso total). Es la única cuenta, así que los candados la protegen de sí misma.
- [x] **Módulo de administración** (0019 + 0020 + `/usuarios`): usuarios, roles,
      permisos y bitácora, en el orden del diagrama. Circuito probado contra la base
      real como usuario autenticado (crear rol → permisos → asignar → quitar → borrar)
      y los candados verificados: auto-quitarse el admin, auto-desactivarse, recortar
      al rol admin e inventar un permiso.
- [x] **Contabilidad, reportes y candados de RPC** (0021) y **todos los módulos del
      panel** construidos. Circuito de negocio probado contra la base real y revertido:
      compra 20 pliegos × Bs 1,50 → recibir → receta de la rosa (Bs 2,75) → producir 10
      (descuenta 5 pliegos) → conteo corrige −2 → venta de mostrador 3 rosas Bs 12 →
      cobro QR → entrega baja el stock → gasto Bs 7 → ganancia del día −25 exacto. Las 11
      RPC rechazan a una cuenta sin rol (42501). `build` con 36 rutas en limpio.
      Ojo: un test revertido igual consume ids; después de probar se re-sincronizan los
      contadores con `setval(..., max(id))` para que PED/COM/GAS no salten códigos.
- [x] **Superadmin probado de punta a punta** (0020): con una cuenta admin temporal y
      sesión real se comprobó que el rol `superadmin` y la cuenta que lo tiene no
      aparecen ni en las vistas ni en las tablas crudas ni en la matriz de permisos,
      que el admin no puede auto-ascenderse (RLS lo rechaza con 42501) ni desactivar
      el rol reservado, y que lo demás sigue funcionando igual. La cuenta de prueba
      se borró.

Pendiente, en orden:
1. Mirar el catálogo con ojo de dueña y ajustar textos y precios de portada
   (ojo con el gancho "desde Bs 20": ver §6, ese producto ya figura a pérdida).
2. Confirmar con Elena los 4 extras en `borrador` (§7) y cargar los 5 productos que
   están en PRECIOS.docx pero sin foto.
3. **Cargar insumos, proveedores y recetas** desde el panel (o por seed) para que el
   costeo deje de contar solo la mano de obra.
4. Seguir el panel admin por módulos. Hecho: login + tablero + ventas + productos +
   administración (usuarios, roles, permisos, bitácora).
   **Hecho: todos los módulos del diagrama.** Sigue: probarlos con datos reales
   (cargar insumos, proveedores y recetas) y ajustar lo que la dueña encuentre.
   Para sumar a Elena: crear su cuenta en Supabase (Authentication → Add user) y darle
   el rol desde `/usuarios`; el SQL Editor ya no hace falta.
5. Tipos de la BD: `catalogo_web/src/types/database.ts` sigue escrito a mano y
   funciona. Regenerarlos con `supabase gen types` obliga a reescribir los imports del
   catálogo, así que es tarea aparte. El panel, que arranca de cero, sí conviene que
   use los tipos generados.
6. Deploy del catálogo (Vercel) con las variables de `.env.local` y
   `NEXT_PUBLIC_SITE_URL` apuntando al dominio real.

## 9. Notas de entorno

- Repo: **un solo repositorio en la raíz**, `https://github.com/coroelena60-max/detalles_elena`
  (rama `main`). Las dos apps son subcarpetas: en Vercel cada una es un proyecto aparte
  con su *Root Directory* (`catalogo_web` o `detalles_admin`). El `.gitignore` de la raíz
  deja afuera `.env*` (salvo los `.example`) y `.secrets.local.md`.
- `.secrets.local.md` en la raíz guarda credenciales en claro: no copiar su contenido a
  ningún archivo versionado.
- El `README.md` de la raíz quedó desactualizado (dice "proyectos recién inicializados");
  este archivo es la fuente de verdad del estado.
- Esta carpeta vive en `C:\Users\LENOVO\source\detalles-elena\` (Windows).
- Las migraciones se validaron en un Postgres 16 local con roles `anon`,
  `authenticated` y `service_role` simulados; útil para repetir la prueba antes
  de aplicar cambios en el proyecto real.
