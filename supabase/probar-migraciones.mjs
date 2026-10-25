// Corre TODAS las migraciones sobre una base vacía en PGlite (Postgres compilado
// a WASM: no hace falta Docker ni un Postgres instalado) y después prueba el
// circuito de venta con precio editable (migración 0028).
//
// Para qué: antes de aplicar una migración nueva en la base real conviene ver
// que el archivo entra sin error en una base limpia y que lo que ya andaba
// sigue andando. No reemplaza probar en el panel con datos reales.
//
// Uso, desde la raíz del repo (PGlite no está en el repo, se baja aparte):
//   mkdir -p ../tmp-pglite && cd ../tmp-pglite
//   corepack pnpm init && corepack pnpm add @electric-sql/pglite
//   node <ruta>/supabase/probar-migraciones.mjs <ruta>/supabase/migrations
//
// Lo que no es real acá: auth.users, auth.uid(), storage y los roles de
// Supabase son imitaciones (ver abajo), y unaccent es un reemplazo casero.
// Todo lo demás es Postgres de verdad.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// PGlite no es dependencia del repo (este script se corre a mano), así que se
// busca donde se lo haya instalado: al lado del script o en la carpeta desde
// donde se lo llama.
const PGlite = await cargarPglite()

async function cargarPglite() {
  const intentos = [
    '@electric-sql/pglite',
    pathToFileURL(path.join(process.cwd(), 'node_modules/@electric-sql/pglite/dist/index.js')).href,
  ]
  for (const donde of intentos) {
    try {
      return (await import(donde)).PGlite
    } catch {
      // se prueba el siguiente
    }
  }
  console.error(
    [
      'Falta PGlite. Desde una carpeta vacía fuera del repo:',
      '  corepack pnpm init && corepack pnpm add @electric-sql/pglite',
      '  node <repo>/supabase/probar-migraciones.mjs <repo>/supabase/migrations',
    ].join('\n'),
  )
  process.exit(1)
}

const carpeta = process.argv[2]
const db = new PGlite()
const fallos = []
const pasos = []

function ok(nombre, condicion, detalle = '') {
  pasos.push(`${condicion ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`)
  if (!condicion) fallos.push(nombre)
}

async function uno(sql, params) {
  const r = await db.query(sql, params)
  return r.rows[0]
}

// --- stubs de lo que pone Supabase (auth, storage, roles) --------------------
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  grant anon, authenticated, service_role to postgres;

  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    email_confirmed_at timestamptz default now(),
    last_sign_in_at timestamptz,
    created_at timestamptz default now()
  );
  -- en Supabase sale del JWT; acá, de una variable de sesión
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('prueba.uid', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  create schema if not exists storage;
  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text, owner uuid, created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select on storage.objects to anon, authenticated;
  grant all on storage.objects to service_role;

  -- pgcrypto/unaccent no vienen en PGlite: no se usa nada de pgcrypto y
  -- unaccent se llama siempre como public.unaccent()
  create or replace function public.unaccent(text) returns text language sql immutable as $$
    select translate($1, 'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                         'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')
  $$;
`)

// --- migraciones en orden ----------------------------------------------------
const archivos = fs.readdirSync(carpeta).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
for (const f of archivos) {
  let sql = fs.readFileSync(path.join(carpeta, f), 'utf8')
  sql = sql.replace(/^\s*create extension[^;]+;/gim, '') // ver stub de arriba
  try {
    await db.exec(sql)
  } catch (e) {
    console.error(`\n*** ${f} falló:\n${e.message}\n`)
    process.exit(1)
  }
}
pasos.push(`OK   ${archivos.length} migraciones aplicadas (hasta ${archivos.at(-1)})`)

// --- usuario de prueba con rol admin ----------------------------------------
const u = await uno(`insert into auth.users (email) values ('prueba@detalles.test') returning id`)
await db.exec(`select public.asignar_rol('prueba@detalles.test', 'admin')`)
await db.exec(`set prueba.uid = '${u.id}'`)

const perfil = await uno(`select count(*)::int as n from public.perfil where id = $1`, [u.id])
ok('el perfil se crea solo al registrarse', perfil.n === 1)

// a partir de acá, todo como lo haría el panel: sesión de usuario, no superusuario
await db.exec(`set role authenticated`)
const permisos = await uno(`select count(*)::int as n from public.mis_permisos()`)
ok('el usuario tiene permisos de admin', permisos.n >= 21, `${permisos.n} permisos`)

// --- datos de referencia -----------------------------------------------------
const prod = await uno(`select id, nombre, precio from public.producto where estado = 'activo' order by precio desc limit 1`)
const prod2 = await uno(`select id, nombre, precio from public.producto where estado = 'activo' and id <> $1 order by precio limit 1`, [prod.id])
const extra = await uno(`select id, nombre, precio from public.extra where estado = 'activo' order by precio desc limit 1`)
pasos.push(`     datos: ${prod.nombre} Bs ${prod.precio} · ${prod2.nombre} Bs ${prod2.precio} · extra ${extra.nombre} Bs ${extra.precio}`)

// =============================================================================
// 1. Vender con precio rebajado + extra escrito a mano
// =============================================================================
const items = JSON.stringify([
  // rebajado: de su precio de lista a 50, más un globo de 15
  { tipo: 'producto', producto_id: prod.id, cantidad: 2, precio_unitario: 50,
    extras_libres: [{ nombre: 'Globo feliz cumple', precio: 15 }] },
  // sin tocar: tiene que seguir saliendo el precio de lista
  { tipo: 'producto', producto_id: prod2.id, cantidad: 1 },
  // un extra suelto, rebajado a 0 (regalo)
  { tipo: 'extra', extra_id: extra.id, cantidad: 3, precio_unitario: 0 },
])
const venta = await uno(`select public.crear_venta_mostrador('{"sin_cliente": true}'::jsonb, $1::jsonb, 'prueba') as v`, [items])
const v = venta.v
const lineas = (await db.query(
  `select i.id, i.nombre, i.cantidad, i.precio_unitario, i.precio_lista, i.subtotal,
          (select coalesce(sum(subtotal),0) from public.pedido_item_extra e
            where e.pedido_item_id = i.id and e.extra_id is null) as libres
     from public.pedido_item i where i.pedido_id = $1 order by i.id`, [v.id])).rows

ok('la venta se creó', v.codigo?.startsWith('PED-'), v.codigo)
ok('línea rebajada: 50 + 15 de globo = 65 c/u', Number(lineas[0].precio_unitario) === 65,
   `precio_unitario=${lineas[0].precio_unitario}`)
ok('línea rebajada: subtotal 65 × 2 = 130', Number(lineas[0].subtotal) === 130)
ok('línea rebajada: guarda el precio de lista', Number(lineas[0].precio_lista) === Number(prod.precio),
   `precio_lista=${lineas[0].precio_lista} (lista ${prod.precio})`)
ok('el globo quedó como extra de la línea', Number(lineas[0].libres) === 15)
ok('línea sin tocar: precio de lista intacto', Number(lineas[1].precio_unitario) === Number(prod2.precio))
ok('línea sin tocar: precio_lista vacío', lineas[1].precio_lista === null)
ok('extra regalado queda en 0', Number(lineas[2].precio_unitario) === 0 && Number(lineas[2].subtotal) === 0)

const esperado = 130 + Number(prod2.precio)
const cab = await uno(`select subtotal, total, estado, canal from public.pedido where id = $1`, [v.id])
ok('el total del pedido cuadra', Number(cab.total) === esperado, `total=${cab.total} esperado=${esperado}`)
ok('nace confirmada y de mostrador', cab.estado === 'confirmado' && cab.canal === 'mostrador')

// =============================================================================
// 2. Ajustar después (la ficha de la venta)
// =============================================================================
await db.query(`select public.ajustar_item_venta($1, 40, '[{"nombre":"Tarjeta escrita","precio":5}]'::jsonb)`, [lineas[0].id])
const l0 = await uno(`select precio_unitario, precio_lista, subtotal from public.pedido_item where id = $1`, [lineas[0].id])
ok('ajuste posterior: 40 + 5 = 45 c/u', Number(l0.precio_unitario) === 45, `precio_unitario=${l0.precio_unitario}`)
ok('ajuste posterior: el globo se reemplazó, no se acumuló', Number(l0.subtotal) === 90)
ok('ajuste posterior: precio_lista no se pisa', Number(l0.precio_lista) === Number(prod.precio))
const cab2 = await uno(`select total from public.pedido where id = $1`, [v.id])
ok('el total se recalcula solo', Number(cab2.total) === 90 + Number(prod2.precio), `total=${cab2.total}`)

const rebaja = await uno(
  `select rebaja_unit, rebaja_total, extras_libres, precio_ramo
     from public.v_pedido_item_precio where pedido_item_id = $1`, [lineas[0].id])
ok('la vista calcula la rebaja', Number(rebaja.rebaja_unit) === Number(prod.precio) - 40,
   `rebaja_unit=${rebaja.rebaja_unit}`)
ok('la vista separa los extras a mano', Number(rebaja.extras_libres) === 5 && Number(rebaja.precio_ramo) === 40)

const bit = await uno(`select count(*)::int as n from public.bitacora where accion = 'ajuste_precio'`)
ok('el ajuste queda en la bitácora', bit.n === 1)

// =============================================================================
// 3. Candados
// =============================================================================
async function debeFallar(nombre, sql, params) {
  try {
    await db.query(sql, params)
    ok(nombre, false, 'no dio error')
  } catch (e) {
    ok(nombre, true, e.message.split('\n')[0])
  }
}
await debeFallar('precio absurdo rechazado', `select public.ajustar_item_venta($1, 999999)`, [lineas[0].id])
await debeFallar('extra sin nombre rechazado',
  `select public.ajustar_item_venta($1, null, '[{"nombre":"","precio":5}]'::jsonb)`, [lineas[0].id])
await debeFallar('el panel no puede llamar al motor interno',
  `select public.aplicar_precio_item($1, 1)`, [lineas[0].id])

// entregada: ya descontó inventario, no se toca más
await db.query(`select public.cambiar_estado_pedido($1, 'entregado')`, [v.id])
await debeFallar('venta entregada: no se cambia el precio', `select public.ajustar_item_venta($1, 10)`, [lineas[0].id])

// el catálogo anónimo sigue sin poder poner precios
await db.exec(`reset role; set prueba.uid = ''; set role anon`)
const anon = await uno(
  `select public.crear_pedido('{"nombre":"Ana Prueba","telefono":"70000000"}'::jsonb,
     $1::jsonb, '{"tipo":"recojo_tienda"}'::jsonb, null) as v`,
  [JSON.stringify([{ tipo: 'producto', producto_id: prod.id, cantidad: 1, precio_unitario: 1,
                     extras_libres: [{ nombre: 'gratis', precio: -100 }] }])])
await debeFallar('anon no puede ajustar precios', `select public.ajustar_item_venta($1, 1)`, [lineas[0].id])
await db.exec(`reset role; set prueba.uid = '${u.id}'; set role authenticated`)
const anonLinea = await uno(`select precio_unitario, precio_lista from public.pedido_item where pedido_id = $1`, [anon.v.id])
ok('el catálogo web sigue cobrando el precio de lista', Number(anonLinea.precio_unitario) === Number(prod.precio),
   `cobró ${anonLinea.precio_unitario}, lista ${prod.precio}`)
ok('y no deja rastro de ajuste', anonLinea.precio_lista === null)

// =============================================================================
// 4. El reporte muestra las rebajas
// =============================================================================
const rep = await uno(`select public.reporte_ventas(current_date - 1, current_date + 1) as r`)
const resumen = rep.r.resumen
ok('reporte_ventas trae "rebajas"', Number(resumen.rebajas) > 0, `rebajas=${resumen.rebajas}`)
ok('reporte_ventas sigue trayendo lo de siempre',
   resumen.vendido !== undefined && resumen.descuentos !== undefined && resumen.ticket_promedio !== undefined)

// inventario: el globo escrito a mano no mueve stock
const movs = await uno(
  `select count(*)::int as n from public.movimiento_inventario where pedido_id = $1`, [v.id])
ok('la entrega movió inventario solo de lo que existe en el sistema', movs.n > 0, `${movs.n} movimientos`)

// =============================================================================
// 5. Un ramo armado a mano (envoltorio + extras del maestro) rebajado
// =============================================================================
const env = await uno(`select id, precio_base, espacios from public.envoltorio where activo order by espacios desc limit 1`)
const flor = await uno(`select id, nombre, precio, espacios from public.extra where estado = 'activo' and espacios > 0 order by precio limit 1`)
const armado = await uno(
  `select public.crear_venta_mostrador('{"sin_cliente": true}'::jsonb, $1::jsonb, null) as v`,
  [JSON.stringify([
    { tipo: 'personalizado', envoltorio_id: env.id, cantidad: 1,
      extras: [{ extra_id: flor.id, cantidad: 2 }],
      precio_unitario: 99, extras_libres: [{ nombre: 'Chocolate', precio: 10 }] },
  ])])
const lArmado = await uno(
  `select precio_unitario, precio_lista, subtotal from public.pedido_item where pedido_id = $1`, [armado.v.id])
const sinAjuste = Number(env.precio_base) + Number(flor.precio) * 2
ok('ramo armado: 99 del ramo + 10 de chocolate', Number(lArmado.precio_unitario) === 109,
   `precio_unitario=${lArmado.precio_unitario}`)
ok('ramo armado: precio_lista = envoltorio + sus flores', Number(lArmado.precio_lista) === sinAjuste,
   `precio_lista=${lArmado.precio_lista} esperado=${sinAjuste}`)
ok('ramo armado: el total del pedido es el de la linea', Number(armado.v.total) === 109)

await db.query(`select public.cambiar_estado_pedido($1, 'entregado')`, [armado.v.id])
const stockFlor = await uno(
  `select coalesce(sum(cantidad), 0) as n from public.movimiento_inventario
    where pedido_id = $1 and extra_id = $2`, [armado.v.id, flor.id])
ok('ramo armado: las flores del sistema igual descuentan stock', Number(stockFlor.n) === -2,
   `movimiento=${stockFlor.n}`)
const movChoco = await uno(
  `select count(*)::int as n from public.movimiento_inventario where pedido_id = $1 and extra_id is null`,
  [armado.v.id])
ok('ramo armado: el chocolate escrito a mano no mueve stock', movChoco.n === 0)

console.log('\n' + pasos.join('\n'))
console.log(fallos.length === 0 ? `\nTODO BIEN (${pasos.length} pasos)` : `\nFALLAN ${fallos.length}: ${fallos.join(' | ')}`)
process.exit(fallos.length === 0 ? 0 : 1)
