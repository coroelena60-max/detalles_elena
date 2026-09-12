-- =============================================================================
-- Detalles Elena · BASE DE DATOS COMPLETA (catálogo web + panel admin)
-- Generado: 2026-09-12T21:17:23Z
-- Pegar TODO este archivo en Supabase > SQL Editor > Run. Es idempotente.
-- 0009 (imágenes) sólo funciona bien después de subir assets/catalogo/ al bucket.
-- Después de aplicar, nombrar al primer administrador:
--   select public.asignar_rol('correo@de.elena', 'admin');
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0001_tipos_y_utilidades.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0001 · Tipos, extensiones y utilidades comunes
-- =============================================================================
-- Convenciones del proyecto:
--   * Todo en el esquema public, nombres en snake_case y en español.
--   * Claves primarias bigint identity (legibles: "pedido 456").
--   * Dinero: numeric(10,2) en bolivianos (Bs). Nunca float.
--   * Toda tabla lleva created_at / updated_at con trigger.
--   * RLS activo en todas las tablas (ver 0004).
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- Enumerados
-- ---------------------------------------------------------------------------
do $$ begin
  create type estado_publicacion as enum ('borrador','activo','agotado','temporada','inactivo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum ('nuevo','enviado_whatsapp','confirmado','en_produccion','listo','entregado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_entrega as enum ('recojo_tienda','envio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_item_pedido as enum ('producto','extra','personalizado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- slug: "Ramo Abanico XS con 1 girasol" -> "ramo-abanico-xs-con-1-girasol"
-- ---------------------------------------------------------------------------
create or replace function public.slugify(p_texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
           regexp_replace(
             lower(public.unaccent(coalesce(p_texto,''))),
             '[^a-z0-9]+', '-', 'g'
           )
         );
$$;

-- ---------------------------------------------------------------------------
-- Normalización de teléfono boliviano: deja solo dígitos
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_telefono(p_tel text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_tel,''), '[^0-9]', '', 'g'), '');
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0002_catalogo_maestro.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0002 · Maestro del catálogo
--   categoria · estilo · tamano · envoltorio · extra · producto · composición
-- =============================================================================

-- ---------------------------------------------------------------------------
-- categoria: agrupador comercial del catálogo (Ramos, Carteras, Cajas, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.categoria (
  id           bigint generated always as identity primary key,
  nombre       text        not null,
  slug         text        not null,
  descripcion  text,
  imagen_url   text,
  orden        integer     not null default 0,
  activa       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint categoria_nombre_uk unique (nombre),
  constraint categoria_slug_uk   unique (slug),
  constraint categoria_nombre_ck check (length(btrim(nombre)) > 0)
);

-- ---------------------------------------------------------------------------
-- estilo: forma del envoltorio (cono, abanico, cartera, caja corazón)
-- ---------------------------------------------------------------------------
create table if not exists public.estilo (
  id          bigint generated always as identity primary key,
  nombre      text        not null,
  slug        text        not null,
  descripcion text,
  orden       integer     not null default 0,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint estilo_nombre_uk unique (nombre),
  constraint estilo_slug_uk   unique (slug)
);

-- ---------------------------------------------------------------------------
-- tamano: talla normalizada (XS..XXXL) con su etiqueta comercial
-- ---------------------------------------------------------------------------
create table if not exists public.tamano (
  id         bigint generated always as identity primary key,
  codigo     text        not null,          -- XS, S, M, L, XL, XXL, XXXL
  nombre     text        not null,          -- CHICO, MEDIANO, GRANDE, JUMBO...
  orden      integer     not null default 0,
  activo     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tamano_codigo_uk unique (codigo)
);

-- ---------------------------------------------------------------------------
-- envoltorio: estilo × tamaño. Es lo que ella cobra como base del ramo.
--   precio_base  = precio de venta del envoltorio solo
--   espacios     = capacidad (modelo de mochila del configurador)
-- ---------------------------------------------------------------------------
create table if not exists public.envoltorio (
  id         bigint generated always as identity primary key,
  estilo_id  bigint      not null references public.estilo (id) on delete restrict,
  tamano_id  bigint      not null references public.tamano (id) on delete restrict,
  precio_base numeric(10,2) not null default 0,
  espacios    numeric(6,2),
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint envoltorio_uk unique (estilo_id, tamano_id),
  constraint envoltorio_precio_ck   check (precio_base >= 0),
  constraint envoltorio_espacios_ck check (espacios is null or espacios > 0)
);

-- ---------------------------------------------------------------------------
-- extra_categoria: agrupador de extras (Flores, Follaje, Accesorios, Peluches)
-- ---------------------------------------------------------------------------
create table if not exists public.extra_categoria (
  id         bigint generated always as identity primary key,
  nombre     text        not null,
  slug       text        not null,
  orden      integer     not null default 0,
  activa     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extra_categoria_nombre_uk unique (nombre),
  constraint extra_categoria_slug_uk   unique (slug)
);

-- ---------------------------------------------------------------------------
-- extra: ítem que se agrega a un ramo y también se vende suelto
--   espacios = cuánto volumen ocupa (rosa 1, girasol 2, peluche 8, corona 0)
-- ---------------------------------------------------------------------------
create table if not exists public.extra (
  id                 bigint generated always as identity primary key,
  extra_categoria_id bigint references public.extra_categoria (id) on delete set null,
  nombre             text        not null,
  slug               text        not null,
  descripcion        text,
  precio             numeric(10,2) not null,
  espacios           numeric(6,2)  not null default 1,
  unidad             text        not null default 'unidad',
  imagen_url         text,
  estado             estado_publicacion not null default 'activo',
  orden              integer     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint extra_nombre_uk   unique (nombre),
  constraint extra_slug_uk     unique (slug),
  constraint extra_precio_ck   check (precio >= 0),
  constraint extra_espacios_ck check (espacios >= 0)
);
create index if not exists extra_categoria_idx on public.extra (extra_categoria_id);
create index if not exists extra_estado_idx    on public.extra (estado);

-- ---------------------------------------------------------------------------
-- producto: ramo/detalle ya definido y fotografiado que se publica
--   precio_desde = true  -> el catálogo muestra "desde Bs X"
--   lead_time_dias       -> promesa de entrega al cliente
--   minutos_armado       -> costo de mano de obra y capacidad del taller
-- ---------------------------------------------------------------------------
create table if not exists public.producto (
  id              bigint generated always as identity primary key,
  categoria_id    bigint      not null references public.categoria (id) on delete restrict,
  envoltorio_id   bigint      references public.envoltorio (id) on delete set null,
  codigo          text        not null,
  nombre          text        not null,
  slug            text        not null,
  descripcion     text,
  precio          numeric(10,2) not null,
  precio_desde    boolean     not null default false,
  estado          estado_publicacion not null default 'borrador',
  destacado       boolean     not null default false,
  lead_time_dias  integer,
  minutos_armado  integer,
  orden           integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint producto_codigo_uk unique (codigo),
  constraint producto_slug_uk   unique (slug),
  constraint producto_precio_ck check (precio >= 0),
  constraint producto_lead_ck   check (lead_time_dias is null or lead_time_dias >= 0),
  constraint producto_min_ck    check (minutos_armado is null or minutos_armado > 0)
);
create index if not exists producto_categoria_idx  on public.producto (categoria_id);
create index if not exists producto_envoltorio_idx on public.producto (envoltorio_id);
create index if not exists producto_estado_idx     on public.producto (estado);
create index if not exists producto_destacado_idx  on public.producto (destacado) where destacado;

-- ---------------------------------------------------------------------------
-- producto_imagen: galería. Una sola principal por producto.
-- ---------------------------------------------------------------------------
create table if not exists public.producto_imagen (
  id            bigint generated always as identity primary key,
  producto_id   bigint      not null references public.producto (id) on delete cascade,
  storage_path  text,
  url           text        not null,
  alt           text,
  orden         integer     not null default 0,
  es_principal  boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists producto_imagen_producto_idx on public.producto_imagen (producto_id, orden);
create unique index if not exists producto_imagen_principal_uk
  on public.producto_imagen (producto_id) where es_principal;

-- ---------------------------------------------------------------------------
-- producto_extra: composición del producto definido (cuántas flores lleva)
-- ---------------------------------------------------------------------------
create table if not exists public.producto_extra (
  id          bigint generated always as identity primary key,
  producto_id bigint       not null references public.producto (id) on delete cascade,
  extra_id    bigint       not null references public.extra (id)    on delete restrict,
  cantidad    numeric(8,2) not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  constraint producto_extra_uk          unique (producto_id, extra_id),
  constraint producto_extra_cantidad_ck check (cantidad > 0)
);
create index if not exists producto_extra_extra_idx on public.producto_extra (extra_id);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categoria','estilo','tamano','envoltorio','extra_categoria',
                           'extra','producto','producto_imagen','producto_extra']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0003_pedidos.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0003 · Pedidos del catálogo web
--   El cliente NO se registra. El pedido se guarda acá, se le da un código,
--   y la venta se cierra por WhatsApp con ese código.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- cliente: no es una cuenta de usuario, es la ficha de contacto del pedido.
--   Se identifica por teléfono normalizado (sin +, sin espacios).
-- ---------------------------------------------------------------------------
create table if not exists public.cliente (
  id         bigint generated always as identity primary key,
  nombre     text        not null,
  telefono   text        not null,
  email      text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cliente_telefono_uk unique (telefono),
  constraint cliente_nombre_ck   check (length(btrim(nombre)) > 0),
  constraint cliente_telefono_ck check (telefono ~ '^[0-9]{7,15}$'),
  constraint cliente_email_ck    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ---------------------------------------------------------------------------
-- zona_envio: Cotoca, Santa Cruz, etc. El costo final se cotiza por WhatsApp,
--   acá va solo un costo de referencia informativo.
-- ---------------------------------------------------------------------------
create table if not exists public.zona_envio (
  id                bigint generated always as identity primary key,
  nombre            text        not null,
  costo_referencia  numeric(10,2),
  activa            boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint zona_envio_nombre_uk unique (nombre),
  constraint zona_envio_costo_ck  check (costo_referencia is null or costo_referencia >= 0)
);

-- ---------------------------------------------------------------------------
-- pedido: cabecera. El código es el que se manda por WhatsApp (PED-00456).
--   Los importes quedan congelados (snapshot) al momento de crear el pedido:
--   si mañana sube el precio de la rosa, este pedido no cambia de monto.
-- ---------------------------------------------------------------------------
create table if not exists public.pedido (
  id                  bigint generated always as identity primary key,
  codigo              text generated always as ('PED-' || lpad(id::text, 5, '0')) stored,
  cliente_id          bigint      references public.cliente (id) on delete set null,
  estado              estado_pedido not null default 'nuevo',
  tipo_entrega        tipo_entrega  not null default 'recojo_tienda',
  subtotal            numeric(10,2) not null default 0,
  costo_envio         numeric(10,2) not null default 0,
  total               numeric(10,2) not null default 0,
  nota_cliente        text,
  canal               text        not null default 'catalogo_web',
  enviado_whatsapp_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pedido_codigo_uk    unique (codigo),
  constraint pedido_subtotal_ck  check (subtotal >= 0),
  constraint pedido_envio_ck     check (costo_envio >= 0),
  constraint pedido_total_ck     check (total >= 0)
);
create index if not exists pedido_cliente_idx on public.pedido (cliente_id);
create index if not exists pedido_estado_idx  on public.pedido (estado);
create index if not exists pedido_fecha_idx   on public.pedido (created_at desc);

-- ---------------------------------------------------------------------------
-- pedido_item: línea del carrito. Tres formas:
--   'producto'      -> un ramo ya definido del catálogo
--   'extra'         -> un extra vendido suelto (una rosa, una corona)
--   'personalizado' -> envoltorio elegido + extras en pedido_item_extra
--   nombre / precio_unitario son snapshot: no dependen del maestro a futuro.
-- ---------------------------------------------------------------------------
create table if not exists public.pedido_item (
  id              bigint generated always as identity primary key,
  pedido_id       bigint      not null references public.pedido (id) on delete cascade,
  tipo            tipo_item_pedido not null,
  producto_id     bigint      references public.producto (id)   on delete set null,
  extra_id        bigint      references public.extra (id)      on delete set null,
  envoltorio_id   bigint      references public.envoltorio (id) on delete set null,
  nombre          text        not null,
  precio_unitario numeric(10,2) not null,
  cantidad        integer     not null default 1,
  subtotal        numeric(10,2) not null,
  dedicatoria     text,
  nota            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pedido_item_cantidad_ck check (cantidad > 0),
  constraint pedido_item_precio_ck   check (precio_unitario >= 0),
  constraint pedido_item_subtotal_ck check (subtotal >= 0),
  -- coherencia entre tipo y referencias
  constraint pedido_item_tipo_ck check (
    (tipo = 'producto'      and producto_id is not null and extra_id is null) or
    (tipo = 'extra'         and extra_id    is not null and producto_id is null) or
    (tipo = 'personalizado' and producto_id is null     and extra_id is null)
  )
);
create index if not exists pedido_item_pedido_idx   on public.pedido_item (pedido_id);
create index if not exists pedido_item_producto_idx on public.pedido_item (producto_id);
create index if not exists pedido_item_extra_idx    on public.pedido_item (extra_id);

-- ---------------------------------------------------------------------------
-- pedido_item_extra: extras agregados a una línea (ramo personalizado o
--   extra sumado a un producto definido). También snapshot de precio.
-- ---------------------------------------------------------------------------
create table if not exists public.pedido_item_extra (
  id              bigint generated always as identity primary key,
  pedido_item_id  bigint      not null references public.pedido_item (id) on delete cascade,
  extra_id        bigint      references public.extra (id) on delete set null,
  nombre          text        not null,
  cantidad        numeric(8,2) not null,
  precio_unitario numeric(10,2) not null,
  subtotal        numeric(10,2) not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pedido_item_extra_cantidad_ck check (cantidad > 0),
  constraint pedido_item_extra_precio_ck   check (precio_unitario >= 0),
  constraint pedido_item_extra_subtotal_ck check (subtotal >= 0)
);
create index if not exists pedido_item_extra_item_idx on public.pedido_item_extra (pedido_item_id);

-- ---------------------------------------------------------------------------
-- entrega: 1 a 1 con pedido. Solo se llena cuando tipo_entrega = 'envio'.
-- ---------------------------------------------------------------------------
create table if not exists public.entrega (
  pedido_id      bigint primary key references public.pedido (id) on delete cascade,
  zona_envio_id  bigint      references public.zona_envio (id) on delete set null,
  destinatario   text,
  telefono       text,
  direccion      text        not null,
  referencia     text,
  fecha_entrega  date,
  franja_horaria text,
  instrucciones  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint entrega_direccion_ck check (length(btrim(direccion)) > 0),
  constraint entrega_telefono_ck  check (telefono is null or telefono ~ '^[0-9]{7,15}$')
);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cliente','zona_envio','pedido','pedido_item',
                           'pedido_item_extra','entrega']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0004_vistas_y_rpc.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0004 · Vistas públicas del catálogo + RPC de creación de pedido
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Vista: catálogo público de productos (lo único que ve el cliente)
-- ---------------------------------------------------------------------------
create or replace view public.v_catalogo_producto
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  p.slug,
  p.descripcion,
  p.precio,
  p.precio_desde,
  p.destacado,
  p.lead_time_dias,
  p.estado,
  p.orden,
  c.id    as categoria_id,
  c.nombre as categoria_nombre,
  c.slug   as categoria_slug,
  e.nombre as estilo_nombre,
  t.codigo as tamano_codigo,
  t.nombre as tamano_nombre,
  env.espacios as espacios_capacidad,
  (select pi.url from public.producto_imagen pi
     where pi.producto_id = p.id
     order by pi.es_principal desc, pi.orden, pi.id
     limit 1) as imagen_principal
from public.producto p
join public.categoria c        on c.id = p.categoria_id
left join public.envoltorio env on env.id = p.envoltorio_id
left join public.estilo e       on e.id = env.estilo_id
left join public.tamano t       on t.id = env.tamano_id
where p.estado in ('activo','agotado','temporada')
  and c.activa;

comment on view public.v_catalogo_producto is
  'Catálogo público. Solo productos publicados. Usada por catalogo_web.';

-- ---------------------------------------------------------------------------
-- RPC: crear_pedido
--   Único camino por el que el catálogo web escribe en la base.
--   Recalcula TODOS los precios en el servidor: el navegador no define montos.
--   Devuelve {id, codigo, subtotal, total} para armar el mensaje de WhatsApp.
--
--   p_cliente : {"nombre":"...", "telefono":"...", "email":"..."}
--   p_entrega : {"tipo":"recojo_tienda"|"envio", "direccion":"...", ...}
--   p_items   : [
--     {"tipo":"producto","producto_id":1,"cantidad":1,"dedicatoria":"...",
--      "extras":[{"extra_id":3,"cantidad":2}]},
--     {"tipo":"extra","extra_id":5,"cantidad":3},
--     {"tipo":"personalizado","envoltorio_id":7,"cantidad":1,
--      "extras":[{"extra_id":1,"cantidad":5}]}
--   ]
-- ---------------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_cliente jsonb,
  p_items   jsonb,
  p_entrega jsonb default '{}'::jsonb,
  p_nota    text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre        text := btrim(coalesce(p_cliente->>'nombre',''));
  v_telefono      text := public.normalizar_telefono(p_cliente->>'telefono');
  v_email         text := nullif(btrim(coalesce(p_cliente->>'email','')),'');
  v_tipo_entrega  tipo_entrega;
  v_cliente_id    bigint;
  v_pedido_id     bigint;
  v_item          jsonb;
  v_extra         jsonb;
  v_tipo          tipo_item_pedido;
  v_cantidad      integer;
  v_nombre_item   text;
  v_base          numeric(10,2);
  v_extras_unit   numeric(10,2);
  v_espacios_uso  numeric(10,2);
  v_espacios_cap  numeric(10,2);
  v_item_id       bigint;
  v_subtotal      numeric(10,2) := 0;
  v_rec           record;
  v_ex            record;
  v_ext_cant      numeric(8,2);
  v_ext_sub       numeric(10,2);
begin
  -- ---- validaciones de cabecera -------------------------------------------
  if length(v_nombre) < 2 then
    raise exception 'El nombre del cliente es obligatorio' using errcode = '22023';
  end if;
  if v_telefono is null or v_telefono !~ '^[0-9]{7,15}$' then
    raise exception 'Teléfono inválido' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados items en el pedido' using errcode = '22023';
  end if;

  v_tipo_entrega := coalesce(nullif(p_entrega->>'tipo',''), 'recojo_tienda')::tipo_entrega;

  if v_tipo_entrega = 'envio'
     and length(btrim(coalesce(p_entrega->>'direccion',''))) < 5 then
    raise exception 'Para envío se requiere la dirección' using errcode = '22023';
  end if;

  -- ---- cliente (upsert por teléfono) --------------------------------------
  insert into public.cliente (nombre, telefono, email)
  values (v_nombre, v_telefono, v_email)
  on conflict (telefono) do update
     set nombre = excluded.nombre,
         email  = coalesce(excluded.email, public.cliente.email)
  returning id into v_cliente_id;

  -- ---- cabecera del pedido ------------------------------------------------
  insert into public.pedido (cliente_id, estado, tipo_entrega, nota_cliente, canal)
  values (v_cliente_id, 'nuevo', v_tipo_entrega, nullif(btrim(coalesce(p_nota,'')),''), 'catalogo_web')
  returning id into v_pedido_id;

  -- ---- items --------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_tipo     := (v_item->>'tipo')::tipo_item_pedido;
    v_cantidad := greatest(1, coalesce((v_item->>'cantidad')::integer, 1));
    if v_cantidad > 99 then
      raise exception 'Cantidad fuera de rango' using errcode = '22023';
    end if;

    v_base         := 0;
    v_extras_unit  := 0;
    v_espacios_uso := 0;
    v_espacios_cap := null;

    if v_tipo = 'producto' then
      select p.id, p.nombre, p.precio, env.espacios
        into v_rec
        from public.producto p
        left join public.envoltorio env on env.id = p.envoltorio_id
       where p.id = (v_item->>'producto_id')::bigint
         and p.estado in ('activo','temporada');
      if not found then
        raise exception 'Producto no disponible: %', v_item->>'producto_id' using errcode = '22023';
      end if;
      v_nombre_item  := v_rec.nombre;
      v_base         := v_rec.precio;
      v_espacios_cap := v_rec.espacios;

    elsif v_tipo = 'extra' then
      select e.id, e.nombre, e.precio
        into v_rec
        from public.extra e
       where e.id = (v_item->>'extra_id')::bigint
         and e.estado in ('activo','temporada');
      if not found then
        raise exception 'Extra no disponible: %', v_item->>'extra_id' using errcode = '22023';
      end if;
      v_nombre_item := v_rec.nombre;
      v_base        := v_rec.precio;

    else -- personalizado
      select env.id, env.precio_base, env.espacios,
             es.nombre || ' ' || tm.codigo as nombre
        into v_rec
        from public.envoltorio env
        join public.estilo es on es.id = env.estilo_id
        join public.tamano tm on tm.id = env.tamano_id
       where env.id = (v_item->>'envoltorio_id')::bigint
         and env.activo;
      if not found then
        raise exception 'Envoltorio no disponible: %', v_item->>'envoltorio_id' using errcode = '22023';
      end if;
      v_nombre_item  := 'Ramo personalizado ' || v_rec.nombre;
      v_base         := v_rec.precio_base;
      v_espacios_cap := v_rec.espacios;
    end if;

    insert into public.pedido_item
      (pedido_id, tipo, producto_id, extra_id, envoltorio_id,
       nombre, precio_unitario, cantidad, subtotal, dedicatoria, nota)
    values
      (v_pedido_id, v_tipo,
       case when v_tipo = 'producto' then (v_item->>'producto_id')::bigint end,
       case when v_tipo = 'extra'    then (v_item->>'extra_id')::bigint end,
       case when v_tipo = 'personalizado' then (v_item->>'envoltorio_id')::bigint end,
       v_nombre_item, v_base, v_cantidad, v_base * v_cantidad,
       nullif(btrim(coalesce(v_item->>'dedicatoria','')),''),
       nullif(btrim(coalesce(v_item->>'nota','')),''))
    returning id into v_item_id;

    -- ---- extras de la línea ----------------------------------------------
    if jsonb_typeof(coalesce(v_item->'extras','null'::jsonb)) = 'array' then
      for v_extra in select * from jsonb_array_elements(v_item->'extras')
      loop
        v_ext_cant := coalesce((v_extra->>'cantidad')::numeric, 1);
        if v_ext_cant <= 0 or v_ext_cant > 200 then
          raise exception 'Cantidad de extra fuera de rango' using errcode = '22023';
        end if;

        select e.id, e.nombre, e.precio, e.espacios
          into v_ex
          from public.extra e
         where e.id = (v_extra->>'extra_id')::bigint
           and e.estado in ('activo','temporada');
        if not found then
          raise exception 'Extra no disponible: %', v_extra->>'extra_id' using errcode = '22023';
        end if;

        v_ext_sub      := round(v_ex.precio * v_ext_cant, 2);
        v_extras_unit  := v_extras_unit + v_ext_sub;
        v_espacios_uso := v_espacios_uso + (v_ex.espacios * v_ext_cant);

        insert into public.pedido_item_extra
          (pedido_item_id, extra_id, nombre, cantidad, precio_unitario, subtotal)
        values
          (v_item_id, v_ex.id, v_ex.nombre, v_ext_cant, v_ex.precio, v_ext_sub);
      end loop;

      -- regla de la "mochila": los extras no pueden exceder la capacidad
      if v_espacios_cap is not null and v_espacios_uso > v_espacios_cap then
        raise exception 'No caben tantos extras en ese tamaño (usa % de % espacios)',
          v_espacios_uso, v_espacios_cap using errcode = '22023';
      end if;

      -- el precio unitario de la línea incluye sus extras
      update public.pedido_item
         set precio_unitario = v_base + v_extras_unit,
             subtotal        = (v_base + v_extras_unit) * v_cantidad
       where id = v_item_id;
    end if;

    v_subtotal := v_subtotal + ((v_base + v_extras_unit) * v_cantidad);
  end loop;

  -- ---- entrega ------------------------------------------------------------
  if v_tipo_entrega = 'envio' then
    insert into public.entrega
      (pedido_id, zona_envio_id, destinatario, telefono, direccion,
       referencia, fecha_entrega, franja_horaria, instrucciones)
    values
      (v_pedido_id,
       nullif(p_entrega->>'zona_envio_id','')::bigint,
       nullif(btrim(coalesce(p_entrega->>'destinatario','')),''),
       public.normalizar_telefono(p_entrega->>'telefono'),
       btrim(p_entrega->>'direccion'),
       nullif(btrim(coalesce(p_entrega->>'referencia','')),''),
       nullif(p_entrega->>'fecha_entrega','')::date,
       nullif(btrim(coalesce(p_entrega->>'franja_horaria','')),''),
       nullif(btrim(coalesce(p_entrega->>'instrucciones','')),''));
  end if;

  -- ---- totales (el envío se cotiza por WhatsApp: no se suma acá) ----------
  update public.pedido
     set subtotal = v_subtotal,
         total    = v_subtotal
   where id = v_pedido_id;

  return (
    select jsonb_build_object(
             'id', p.id,
             'codigo', p.codigo,
             'subtotal', p.subtotal,
             'total', p.total,
             'estado', p.estado
           )
    from public.pedido p where p.id = v_pedido_id
  );
end;
$$;

comment on function public.crear_pedido(jsonb,jsonb,jsonb,text) is
  'Crea el pedido del catálogo web recalculando precios en el servidor. Devuelve el código para WhatsApp.';

-- ---------------------------------------------------------------------------
-- RPC: marcar_pedido_enviado_whatsapp
--   El catálogo la llama cuando el cliente efectivamente abre WhatsApp.
--   Sirve para medir conversión (pedidos armados vs. pedidos que llegaron).
-- ---------------------------------------------------------------------------
create or replace function public.marcar_pedido_enviado_whatsapp(p_codigo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pedido
     set estado = case when estado = 'nuevo' then 'enviado_whatsapp' else estado end,
         enviado_whatsapp_at = coalesce(enviado_whatsapp_at, now())
   where codigo = upper(btrim(p_codigo));
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0005_rls_y_permisos.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0005 · Row Level Security y permisos
--
-- Principio: con la clave pública (anon) SOLO se puede LEER el catálogo
-- publicado y CREAR un pedido a través de la función crear_pedido().
-- Nadie puede leer pedidos ni datos de clientes desde el navegador.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS activo en todo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categoria','estilo','tamano','envoltorio','extra_categoria','extra',
    'producto','producto_imagen','producto_extra',
    'cliente','zona_envio','pedido','pedido_item','pedido_item_extra','entrega']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Lectura pública del catálogo publicado
-- ---------------------------------------------------------------------------
drop policy if exists categoria_lectura_publica on public.categoria;
create policy categoria_lectura_publica on public.categoria
  for select to anon, authenticated using (activa);

drop policy if exists estilo_lectura_publica on public.estilo;
create policy estilo_lectura_publica on public.estilo
  for select to anon, authenticated using (activo);

drop policy if exists tamano_lectura_publica on public.tamano;
create policy tamano_lectura_publica on public.tamano
  for select to anon, authenticated using (activo);

drop policy if exists envoltorio_lectura_publica on public.envoltorio;
create policy envoltorio_lectura_publica on public.envoltorio
  for select to anon, authenticated using (activo);

drop policy if exists extra_categoria_lectura_publica on public.extra_categoria;
create policy extra_categoria_lectura_publica on public.extra_categoria
  for select to anon, authenticated using (activa);

drop policy if exists extra_lectura_publica on public.extra;
create policy extra_lectura_publica on public.extra
  for select to anon, authenticated using (estado in ('activo','agotado','temporada'));

drop policy if exists producto_lectura_publica on public.producto;
create policy producto_lectura_publica on public.producto
  for select to anon, authenticated using (estado in ('activo','agotado','temporada'));

drop policy if exists producto_imagen_lectura_publica on public.producto_imagen;
create policy producto_imagen_lectura_publica on public.producto_imagen
  for select to anon, authenticated using (
    exists (select 1 from public.producto p
             where p.id = producto_imagen.producto_id
               and p.estado in ('activo','agotado','temporada'))
  );

drop policy if exists producto_extra_lectura_publica on public.producto_extra;
create policy producto_extra_lectura_publica on public.producto_extra
  for select to anon, authenticated using (
    exists (select 1 from public.producto p
             where p.id = producto_extra.producto_id
               and p.estado in ('activo','agotado','temporada'))
  );

drop policy if exists zona_envio_lectura_publica on public.zona_envio;
create policy zona_envio_lectura_publica on public.zona_envio
  for select to anon, authenticated using (activa);

-- ---------------------------------------------------------------------------
-- 3. Pedidos y clientes: sin políticas para anon.
--    RLS sin política = nada. Solo entran por crear_pedido() (security definer)
--    y los lee el panel admin con service_role / políticas propias (fase 2).
-- ---------------------------------------------------------------------------
revoke insert, update, delete on
  public.categoria, public.estilo, public.tamano, public.envoltorio,
  public.extra_categoria, public.extra, public.producto,
  public.producto_imagen, public.producto_extra, public.zona_envio
from anon;

revoke select, insert, update, delete on
  public.cliente, public.pedido, public.pedido_item,
  public.pedido_item_extra, public.entrega
from anon;

-- ---------------------------------------------------------------------------
-- 4. Funciones expuestas al catálogo web
-- ---------------------------------------------------------------------------
revoke all on function public.crear_pedido(jsonb,jsonb,jsonb,text) from public;
grant execute on function public.crear_pedido(jsonb,jsonb,jsonb,text) to anon, authenticated;

revoke all on function public.marcar_pedido_enviado_whatsapp(text) from public;
grant execute on function public.marcar_pedido_enviado_whatsapp(text) to anon, authenticated;

grant select on public.v_catalogo_producto to anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0006_storage.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0006 · Storage de imágenes
--   Bucket público de solo lectura. La escritura la hace el panel admin
--   autenticado (o el service_role en la carga inicial).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists catalogo_lectura_publica on storage.objects;
create policy catalogo_lectura_publica on storage.objects
  for select to anon, authenticated using (bucket_id = 'catalogo');

drop policy if exists catalogo_escritura_autenticada on storage.objects;
create policy catalogo_escritura_autenticada on storage.objects
  for insert to authenticated with check (bucket_id = 'catalogo');

drop policy if exists catalogo_update_autenticada on storage.objects;
create policy catalogo_update_autenticada on storage.objects
  for update to authenticated using (bucket_id = 'catalogo');


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0007_seed_catalogo.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0007 · Carga inicial del catálogo (idempotente)
--   Datos tomados de PRECIOS.docx y de los nombres/precios de las fotos.
--   Precios en Bs. Los espacios vienen del análisis v3 (modelo de mochila).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
insert into public.categoria (nombre, slug, descripcion, orden, activa) values
  ('Ramos cono',        'ramos-cono',        'Ramos armados en envoltorio cono, de chico a súper jumbo.', 1, true),
  ('Ramos abanico',     'ramos-abanico',     'Ramos armados en envoltorio abanico, de extra chico a súper jumbo.', 2, true),
  ('Carteras',          'carteras',          'Carteras de regalo con flores hechas a mano.', 3, true),
  ('Cajas y corazones', 'cajas-y-corazones', 'Cajas decoradas y cajas corazón con flores y chocolates.', 4, true)
on conflict (slug) do update
  set nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden;

-- ---------------------------------------------------------------------------
-- Estilos de envoltorio
-- ---------------------------------------------------------------------------
insert into public.estilo (nombre, slug, descripcion, orden, activo) values
  ('Cono',         'cono',         'Envoltorio cónico de papel coreano.', 1, true),
  ('Abanico',      'abanico',      'Envoltorio abierto en abanico.',      2, true),
  ('Cartera',      'cartera',      'Caja tipo cartera con asa.',          3, true),
  ('Caja corazón', 'caja-corazon', 'Caja en forma de corazón.',           4, true)
on conflict (slug) do update set nombre = excluded.nombre, orden = excluded.orden;

-- ---------------------------------------------------------------------------
-- Tamaños
-- ---------------------------------------------------------------------------
insert into public.tamano (codigo, nombre, orden, activo) values
  ('XS',   'Extra chico', 1, true),
  ('S',    'Chico',       2, true),
  ('M',    'Mediano',     3, true),
  ('L',    'Grande',      4, true),
  ('XL',   'Jumbo',       5, true),
  ('XXL',  'Súper jumbo', 6, true),
  ('XXXL', 'Mega jumbo',  7, true),
  ('U',    'Único',       8, true)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;

-- ---------------------------------------------------------------------------
-- Envoltorios (precio base + capacidad en espacios)
-- ---------------------------------------------------------------------------
with datos(estilo_slug, tamano_codigo, precio_base, espacios) as (
  values
    ('cono',        'S',    20.00,  8.0),
    ('cono',        'M',    30.00, 10.0),
    ('cono',        'L',    40.00, 12.0),
    ('cono',        'XL',   50.00, 22.0),
    ('cono',        'XXL',  60.00, 28.0),
    ('cono',        'XXXL', 80.00, 40.0),
    ('abanico',     'XS',   10.00,  3.0),
    ('abanico',     'S',    15.00,  4.0),
    ('abanico',     'M',    20.00,  7.0),
    ('abanico',     'L',    25.00,  9.0),
    ('abanico',     'XL',   35.00, 12.0),
    ('abanico',     'XXL',  50.00, 24.0),
    ('cartera',     'U',    30.00, 11.0),
    ('caja-corazon','U',    80.00, 14.0)
)
insert into public.envoltorio (estilo_id, tamano_id, precio_base, espacios, activo)
select e.id, t.id, d.precio_base, d.espacios, true
from datos d
join public.estilo e on e.slug   = d.estilo_slug
join public.tamano t on t.codigo = d.tamano_codigo
on conflict (estilo_id, tamano_id) do update
  set precio_base = excluded.precio_base, espacios = excluded.espacios;

-- ---------------------------------------------------------------------------
-- Categorías de extras
-- ---------------------------------------------------------------------------
insert into public.extra_categoria (nombre, slug, orden, activa) values
  ('Flores',     'flores',     1, true),
  ('Follaje',    'follaje',    2, true),
  ('Accesorios', 'accesorios', 3, true),
  ('Juguetes',   'juguetes',   4, true),
  ('Peluches',   'peluches',   5, true)
on conflict (slug) do update set nombre = excluded.nombre, orden = excluded.orden;

-- ---------------------------------------------------------------------------
-- Extras (precio de venta actual · espacios = volumen que ocupa)
--   estado 'borrador' = falta confirmar precio con Elena, no sale al catálogo.
-- ---------------------------------------------------------------------------
with datos(nombre, cat_slug, precio, espacios, estado, orden, descripcion) as (
  values
    ('Rosa',                  'flores',     4.00, 1.00,  'activo',   1, 'Rosa hecha a mano. Disponible en varios colores.'),
    ('Rosa semirealista',     'flores',     5.00, 1.00,  'activo',   2, 'Rosa semirealista hecha a mano, acabado más fino.'),
    ('Girasol',               'flores',     5.00, 2.00,  'activo',   3, 'Girasol hecho a mano.'),
    ('Margarita (3 tallos)',  'flores',     3.00, 1.00,  'activo',   4, 'Ramillete de margaritas de 3 tallos.'),
    ('Flor lirio',            'flores',     4.00, 1.50,  'activo',   5, 'Lirio hecho a mano.'),
    ('Flor limpiapipa',       'flores',     1.00, 0.50,  'activo',   6, 'Florcita de limpiapipas.'),
    ('Follaje papel de arroz','follaje',    1.00, 0.50,  'activo',   7, 'Follaje de papel de arroz.'),
    ('Follaje de hojas',      'follaje',    1.00, 0.50,  'activo',   8, 'Follaje de hojas decorativas.'),
    ('Malla',                 'follaje',    1.00, 0.50,  'activo',   9, 'Malla tul decorativa.'),
    ('Mariposa',              'accesorios', 2.00, 0.25,  'activo',  10, 'Mariposa decorativa.'),
    ('Corona',                'accesorios',15.00, 0.00,  'activo',  11, 'Corona decorativa de plástico.'),
    ('Corona metálica',       'accesorios',50.00, 0.00,  'activo',  12, 'Corona metálica.'),
    ('Tarjeta',               'accesorios', 4.00, 0.00,  'activo',  13, 'Tarjeta con dedicatoria.'),
    ('Hot Wheels',            'juguetes',  15.00, 2.00,  'activo',  14, 'Autito Hot Wheels en su caja.'),
    ('Peluche oso dormilón',  'peluches',  70.00, 8.00,  'borrador',15, 'PRECIO A CONFIRMAR. Costo 32,50 Bs; sugerido 70 Bs.'),
    ('Peluche Stitch',        'peluches', 100.00, 8.00,  'borrador',16, 'PRECIO A CONFIRMAR. Costo 50 Bs; sugerido 100 Bs.'),
    ('Luz led',               'accesorios',15.00, 0.00,  'borrador',17, 'PRECIO A CONFIRMAR. Costo 5 Bs; sugerido 15 Bs.'),
    ('Porta tarjeta',         'accesorios', 5.00, 0.00,  'borrador',18, 'PRECIO A CONFIRMAR. Costo 2 Bs; sugerido 5 Bs.')
)
insert into public.extra (extra_categoria_id, nombre, slug, descripcion, precio, espacios, estado, orden)
select ec.id, d.nombre, public.slugify(d.nombre), d.descripcion,
       d.precio, d.espacios, d.estado::estado_publicacion, d.orden
from datos d
join public.extra_categoria ec on ec.slug = d.cat_slug
on conflict (nombre) do update
  set precio      = excluded.precio,
      espacios    = excluded.espacios,
      descripcion = excluded.descripcion,
      orden       = excluded.orden,
      extra_categoria_id = excluded.extra_categoria_id;

-- ---------------------------------------------------------------------------
-- Zonas de envío (el costo final se cotiza por WhatsApp)
-- ---------------------------------------------------------------------------
insert into public.zona_envio (nombre, costo_referencia, activa) values
  ('Cotoca',               null, true),
  ('Santa Cruz de la Sierra', null, true),
  ('Otra zona',            null, true)
on conflict (nombre) do nothing;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0008_seed_productos.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0008 · Productos ya definidos (los 16 fotografiados)
--   Nombre y precio salen del nombre de archivo de cada foto.
--   La composición (cuántas flores lleva) sale del mismo nombre y de PRECIOS.docx.
--   'descripcion' queda con un texto base para que Elena lo edite en el panel.
-- =============================================================================

with datos(codigo, nombre, cat_slug, estilo_slug, tamano, precio,
           lead_time_dias, minutos_armado, destacado, orden, descripcion) as (
  values
    -- ---- Ramos abanico -----------------------------------------------------
    ('AB-XS-001','Ramo abanico XS con 1 girasol',                  'ramos-abanico','abanico','XS',   20.00, 1,  70, false,  1,'Ramo abanico extra chico con 1 girasol hecho a mano. Ideal para un detalle sencillo.'),
    ('AB-S-001', 'Ramo abanico S con 3 rosas',                     'ramos-abanico','abanico','S',    35.00, 1,  75, true,   2,'Ramo abanico chico con 3 rosas hechas a mano.'),
    ('AB-M-001', 'Ramo abanico M con 5 rosas',                     'ramos-abanico','abanico','M',    45.00, 1,  85, true,   3,'Ramo abanico mediano con 5 rosas hechas a mano.'),
    ('AB-M-002', 'Ramo abanico M con 3 rosas y 2 Hot Wheels',      'ramos-abanico','abanico','M',    75.00, 1,  75, false,  4,'Ramo abanico mediano con 3 rosas y 2 autitos Hot Wheels. Para niños y coleccionistas.'),
    ('AB-L-001', 'Ramo abanico L con 3 girasoles',                 'ramos-abanico','abanico','L',    55.00, 1,  90, false,  5,'Ramo abanico grande con 3 girasoles hechos a mano.'),
    ('AB-L-002', 'Ramo abanico L con 3 rosas y 3 Hot Wheels',      'ramos-abanico','abanico','L',   100.00, 1,  75, false,  6,'Ramo abanico grande con 3 rosas y 3 autitos Hot Wheels.'),
    ('AB-XL-001','Ramo abanico XL jumbo con 5 girasoles',          'ramos-abanico','abanico','XL',   85.00, 2, 170, true,   7,'Ramo abanico jumbo con 5 girasoles hechos a mano.'),
    ('AB-XXL-001','Ramo abanico XXL súper jumbo con 14 rosas y peluche oso dormilón','ramos-abanico','abanico','XXL',250.00,2,190,true,8,'Ramo abanico súper jumbo con 14 rosas hechas a mano y peluche oso dormilón. Regalo grande para fecha especial.'),
    -- ---- Ramos cono --------------------------------------------------------
    ('CO-S-001', 'Ramo cono S con 7 rosas',                        'ramos-cono','cono','S',    40.00, 1,  95, true,   9,'Ramo cono chico con 7 rosas hechas a mano.'),
    ('CO-L-001', 'Ramo cono L con 1 girasol y 8 rosas',            'ramos-cono','cono','L',    85.00, 1, 110, false, 10,'Ramo cono grande con 1 girasol y 8 rosas hechas a mano.'),
    ('CO-XL-001','Ramo cono XL con 20 rosas y 2 mariposas',        'ramos-cono','cono','XL',  140.00, 2, 160, true,  11,'Ramo cono jumbo con 20 rosas hechas a mano y 2 mariposas decorativas.'),
    ('CO-XXL-001','Ramo cono XXL jumbo con 7 girasoles',           'ramos-cono','cono','XXL', 160.00, 2, 190, false, 12,'Ramo cono súper jumbo con 7 girasoles hechos a mano.'),
    ('CO-XXXL-001','Ramo cono XXXL súper jumbo con 20 girasoles',  'ramos-cono','cono','XXXL',280.00, 3, 320, true,  13,'Ramo cono mega jumbo con 20 girasoles hechos a mano. El más grande del catálogo.'),
    -- ---- Carteras ----------------------------------------------------------
    ('CA-U-001', 'Cartera negra con 3 girasoles y 5 margaritas',   'carteras','cartera','U',    70.00, 1, 120, false, 14,'Cartera negra de regalo con 3 girasoles y 5 margaritas hechas a mano.'),
    ('CA-U-002', 'Cartera rosada con 3 girasoles y 4 rosas',       'carteras','cartera','U',    80.00, 1, 110, true,  15,'Cartera rosada de regalo con 3 girasoles y 4 rosas hechas a mano.'),
    ('CA-U-003', 'Cartera blanca con 4 girasoles y 1 margarita',   'carteras','cartera','U',    80.00, 1, 106, false, 16,'Cartera blanca de regalo con 4 girasoles y 1 margarita hechas a mano.')
)
insert into public.producto (categoria_id, envoltorio_id, codigo, nombre, slug, descripcion,
                             precio, precio_desde, estado, destacado, lead_time_dias,
                             minutos_armado, orden)
select c.id, env.id, d.codigo, d.nombre, public.slugify(d.nombre), d.descripcion,
       d.precio, false, 'activo'::estado_publicacion, d.destacado, d.lead_time_dias,
       d.minutos_armado, d.orden
from datos d
join public.categoria c  on c.slug = d.cat_slug
join public.estilo  e    on e.slug = d.estilo_slug
join public.tamano  t    on t.codigo = d.tamano
join public.envoltorio env on env.estilo_id = e.id and env.tamano_id = t.id
on conflict (codigo) do update
  set nombre         = excluded.nombre,
      slug           = excluded.slug,
      descripcion    = excluded.descripcion,
      precio         = excluded.precio,
      categoria_id   = excluded.categoria_id,
      envoltorio_id  = excluded.envoltorio_id,
      destacado      = excluded.destacado,
      lead_time_dias = excluded.lead_time_dias,
      minutos_armado = excluded.minutos_armado,
      orden          = excluded.orden,
      estado         = 'activo';

-- ---------------------------------------------------------------------------
-- Composición: qué lleva cada producto
-- ---------------------------------------------------------------------------
with comp(producto_codigo, extra_nombre, cantidad) as (
  values
    ('AB-XS-001',  'Girasol',                 1),
    ('AB-S-001',   'Rosa',                    3),
    ('AB-M-001',   'Rosa',                    5),
    ('AB-M-002',   'Rosa',                    3),
    ('AB-M-002',   'Hot Wheels',              2),
    ('AB-L-001',   'Girasol',                 3),
    ('AB-L-002',   'Rosa',                    3),
    ('AB-L-002',   'Hot Wheels',              3),
    ('AB-XL-001',  'Girasol',                 5),
    ('AB-XXL-001', 'Rosa',                   14),
    ('AB-XXL-001', 'Peluche oso dormilón',    1),
    ('CO-S-001',   'Rosa',                    7),
    ('CO-L-001',   'Girasol',                 1),
    ('CO-L-001',   'Rosa',                    8),
    ('CO-XL-001',  'Rosa',                   20),
    ('CO-XL-001',  'Mariposa',                2),
    ('CO-XXL-001', 'Girasol',                 7),
    ('CO-XXXL-001','Girasol',                20),
    ('CA-U-001',   'Girasol',                 3),
    ('CA-U-001',   'Margarita (3 tallos)',    5),
    ('CA-U-002',   'Girasol',                 3),
    ('CA-U-002',   'Rosa',                    4),
    ('CA-U-003',   'Girasol',                 4),
    ('CA-U-003',   'Margarita (3 tallos)',    1)
)
insert into public.producto_extra (producto_id, extra_id, cantidad)
select p.id, e.id, c.cantidad
from comp c
join public.producto p on p.codigo = c.producto_codigo
join public.extra    e on e.nombre = c.extra_nombre
on conflict (producto_id, extra_id) do update set cantidad = excluded.cantidad;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0009_seed_imagenes.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0009 · Imágenes del catálogo
--   Requisito previo: subir la carpeta assets/catalogo/ al bucket 'catalogo'
--   del Storage de Supabase, manteniendo las subcarpetas productos/ extras/ marca/.
--   Los nombres de archivo son el código del producto en minúscula (ab-s-001.webp)
--   o el slug del extra (girasol.webp).
-- =============================================================================

-- para poder re-ejecutar sin duplicar
alter table public.producto_imagen
  drop constraint if exists producto_imagen_path_uk;
alter table public.producto_imagen
  add constraint producto_imagen_path_uk unique (producto_id, storage_path);

-- ---------------------------------------------------------------------------
-- Imágenes de producto
-- ---------------------------------------------------------------------------
with base(url) as (
  values ('https://nrwamzgxwttgvaqqodfp.supabase.co/storage/v1/object/public/catalogo/')
),
datos(producto_codigo, archivo, orden, es_principal) as (
  values
    ('AB-XS-001',   'productos/ab-xs-001.webp',   1, true),
    ('AB-S-001',    'productos/ab-s-001.webp',    1, true),
    ('AB-M-001',    'productos/ab-m-001.webp',    1, true),
    ('AB-M-002',    'productos/ab-m-002.webp',    1, true),
    ('AB-L-001',    'productos/ab-l-001.webp',    1, true),
    ('AB-L-002',    'productos/ab-l-002.webp',    1, true),
    ('AB-XL-001',   'productos/ab-xl-001.webp',   1, true),
    ('AB-XL-001',   'productos/ab-xl-001-2.webp', 2, false),
    ('AB-XXL-001',  'productos/ab-xxl-001.webp',  1, true),
    ('CO-S-001',    'productos/co-s-001.webp',    1, true),
    ('CO-L-001',    'productos/co-l-001.webp',    1, true),
    ('CO-XL-001',   'productos/co-xl-001.webp',   1, true),
    ('CO-XXL-001',  'productos/co-xxl-001.webp',  1, true),
    ('CO-XXXL-001', 'productos/co-xxxl-001.webp', 1, true),
    ('CA-U-001',    'productos/ca-u-001.webp',    1, true),
    ('CA-U-002',    'productos/ca-u-002.webp',    1, true),
    ('CA-U-003',    'productos/ca-u-003.webp',    1, true)
)
insert into public.producto_imagen (producto_id, storage_path, url, alt, orden, es_principal)
select p.id, d.archivo, b.url || d.archivo, p.nombre, d.orden, d.es_principal
from datos d
cross join base b
join public.producto p on p.codigo = d.producto_codigo
on conflict (producto_id, storage_path) do update
  set url = excluded.url, alt = excluded.alt, orden = excluded.orden;

-- ---------------------------------------------------------------------------
-- Imágenes de extras
-- ---------------------------------------------------------------------------
update public.extra e
   set imagen_url = 'https://nrwamzgxwttgvaqqodfp.supabase.co/storage/v1/object/public/catalogo/extras/'
                    || d.archivo
from (values
    ('Rosa',                  'rosa.webp'),
    ('Rosa semirealista',     'rosa-semirealista.webp'),
    ('Girasol',               'girasol.webp'),
    ('Margarita (3 tallos)',  'margarita-3-tallos.webp'),
    ('Flor lirio',            'flor-lirio.webp'),
    ('Flor limpiapipa',       'flor-limpiapipa.webp'),
    ('Follaje papel de arroz','follaje-papel-de-arroz.webp'),
    ('Follaje de hojas',      'follaje-de-hojas.webp'),
    ('Malla',                 'malla.webp'),
    ('Mariposa',              'mariposa.webp'),
    ('Corona',                'corona.webp'),
    ('Corona metálica',       'corona-metalica.webp'),
    ('Tarjeta',               'tarjeta.webp'),
    ('Hot Wheels',            'hot-wheels.webp')
) as d(nombre, archivo)
where e.nombre = d.nombre;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0010_admin_usuarios_roles.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0010 · Módulo de administración
--   Usuarios, roles, permisos y bitácora del panel admin.
--
--   La identidad la maneja Supabase Auth (auth.users). Acá vive el PERFIL
--   (datos de la persona dentro de la tienda) y el control de acceso por
--   permisos. El catálogo web es anónimo y no toca nada de esto.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- perfil: 1 a 1 con auth.users. Se crea solo cuando alguien se registra.
-- ---------------------------------------------------------------------------
create table if not exists public.perfil (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text        not null default '',
  telefono   text,
  email      text,
  activo     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfil_telefono_ck check (telefono is null or telefono ~ '^[0-9]{7,15}$')
);

comment on table public.perfil is
  'Persona que usa el panel admin. Se crea automáticamente al registrarse en Auth.';

-- ---------------------------------------------------------------------------
-- rol: admin, vendedor, producción… es_sistema = no se puede borrar.
-- ---------------------------------------------------------------------------
create table if not exists public.rol (
  id          bigint generated always as identity primary key,
  nombre      text        not null,
  slug        text        not null,
  descripcion text,
  es_sistema  boolean     not null default false,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint rol_nombre_uk unique (nombre),
  constraint rol_slug_uk   unique (slug)
);

-- ---------------------------------------------------------------------------
-- permiso: código estable 'modulo.accion'. El panel pregunta por el código,
--   nunca por el id, así se pueden agregar permisos sin migrar datos.
-- ---------------------------------------------------------------------------
create table if not exists public.permiso (
  id          bigint generated always as identity primary key,
  codigo      text        not null,
  modulo      text        not null,
  descripcion text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint permiso_codigo_uk unique (codigo),
  constraint permiso_codigo_ck check (codigo ~ '^[a-z_]+\.[a-z_]+$')
);

create table if not exists public.rol_permiso (
  rol_id     bigint not null references public.rol (id)     on delete cascade,
  permiso_id bigint not null references public.permiso (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (rol_id, permiso_id)
);

create table if not exists public.usuario_rol (
  perfil_id  uuid   not null references public.perfil (id) on delete cascade,
  rol_id     bigint not null references public.rol (id)    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, rol_id)
);
create index if not exists usuario_rol_rol_idx on public.usuario_rol (rol_id);

-- ---------------------------------------------------------------------------
-- bitácora: quién hizo qué. datos_antes/datos_despues como jsonb para no
--   tener una tabla por entidad.
-- ---------------------------------------------------------------------------
create table if not exists public.bitacora (
  id             bigint generated always as identity primary key,
  perfil_id      uuid        references public.perfil (id) on delete set null,
  accion         text        not null,           -- insert | update | delete | login | ...
  entidad        text        not null,           -- nombre de la tabla o del proceso
  entidad_id     text,
  datos_antes    jsonb,
  datos_despues  jsonb,
  nota           text,
  created_at     timestamptz not null default now()
);
create index if not exists bitacora_fecha_idx   on public.bitacora (created_at desc);
create index if not exists bitacora_entidad_idx on public.bitacora (entidad, entidad_id);
create index if not exists bitacora_perfil_idx  on public.bitacora (perfil_id);

-- ---------------------------------------------------------------------------
-- Alta automática del perfil al registrarse en Auth
-- ---------------------------------------------------------------------------
create or replace function public.tg_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil (id, nombre, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'nombre'), ''),
             nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
             split_part(coalesce(new.email,''), '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.tg_crear_perfil();

-- ---------------------------------------------------------------------------
-- Helpers de autorización. Son security definer y stable: las políticas RLS
--   las llaman en cada fila, así que no pueden depender de RLS ellas mismas.
-- ---------------------------------------------------------------------------
create or replace function public.tiene_permiso(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_rol ur
    join public.rol r          on r.id = ur.rol_id and r.activo
    join public.rol_permiso rp on rp.rol_id = r.id
    join public.permiso p      on p.id = rp.permiso_id
    join public.perfil pe      on pe.id = ur.perfil_id and pe.activo
    where ur.perfil_id = auth.uid()
      and p.codigo = p_codigo
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_rol ur
    join public.rol r     on r.id = ur.rol_id and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo
    where ur.perfil_id = auth.uid()
      and r.slug = 'admin'
  );
$$;

/** Permisos del usuario conectado: el panel los pide una vez al entrar. */
create or replace function public.mis_permisos()
returns table (codigo text, modulo text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.codigo, p.modulo
  from public.usuario_rol ur
  join public.rol r          on r.id = ur.rol_id and r.activo
  join public.rol_permiso rp on rp.rol_id = r.id
  join public.permiso p      on p.id = rp.permiso_id
  join public.perfil pe      on pe.id = ur.perfil_id and pe.activo
  where ur.perfil_id = auth.uid()
  order by p.modulo, p.codigo;
$$;

-- ---------------------------------------------------------------------------
-- Asignar un rol por email. Es el camino para nombrar al primer admin:
--   la persona se registra en el panel y después se corre
--   select public.asignar_rol('elena@...', 'admin');
-- ---------------------------------------------------------------------------
create or replace function public.asignar_rol(p_email text, p_rol_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid;
  v_rol    bigint;
begin
  select u.id into v_perfil from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_perfil is null then
    raise exception 'No hay ningún usuario registrado con el email %', p_email
      using errcode = '22023';
  end if;

  insert into public.perfil (id, email) values (v_perfil, lower(btrim(p_email)))
  on conflict (id) do nothing;

  select r.id into v_rol from public.rol r where r.slug = p_rol_slug;
  if v_rol is null then
    raise exception 'No existe el rol %', p_rol_slug using errcode = '22023';
  end if;

  insert into public.usuario_rol (perfil_id, rol_id) values (v_perfil, v_rol)
  on conflict do nothing;

  return format('%s ahora tiene el rol %s', p_email, p_rol_slug);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bitácora automática. Se engancha a la tabla que se quiera con:
--   create trigger auditar after insert or update or delete on <tabla>
--     for each row execute function public.tg_bitacora();
-- ---------------------------------------------------------------------------
create or replace function public.tg_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce((to_jsonb(old)->>'id'), '');
    insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_antes)
    values (auth.uid(), 'delete', tg_table_name, v_id, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    v_id := coalesce((to_jsonb(new)->>'id'), '');
    insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_antes, datos_despues)
    values (auth.uid(), 'update', tg_table_name, v_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_id := coalesce((to_jsonb(new)->>'id'), '');
    insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_despues)
    values (auth.uid(), 'insert', tg_table_name, v_id, to_jsonb(new));
    return new;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfil','rol','permiso']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0011_compras_insumos.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0011 · Módulo de compras
--   Proveedores, insumos (materia prima) y compras.
--
--   Un INSUMO es lo que se compra: papel coreano, cinta, foamy, alambre,
--   cajas, peluches. No se vende suelto — lo que se vende es el EXTRA (la
--   rosa ya hecha) o el PRODUCTO (el ramo armado). La receta que conecta
--   insumo → extra/producto está en 0013.
-- =============================================================================

do $$ begin
  create type unidad_medida as enum (
    'unidad','par','paquete','pliego','rollo','metro','centimetro',
    'gramo','kilogramo','litro','mililitro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_compra as enum ('borrador','recibida','anulada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- proveedor
-- ---------------------------------------------------------------------------
create table if not exists public.proveedor (
  id         bigint generated always as identity primary key,
  nombre     text        not null,
  telefono   text,
  email      text,
  direccion  text,
  notas      text,
  activo     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proveedor_nombre_uk   unique (nombre),
  constraint proveedor_nombre_ck   check (length(btrim(nombre)) > 0),
  constraint proveedor_telefono_ck check (telefono is null or telefono ~ '^[0-9]{7,15}$')
);

-- ---------------------------------------------------------------------------
-- insumo: materia prima. costo_unitario con 4 decimales porque el papel se
--   consume por centímetro y la cinta por metro: redondear a 2 desvía el costo.
-- ---------------------------------------------------------------------------
create table if not exists public.insumo (
  id             bigint generated always as identity primary key,
  nombre         text          not null,
  slug           text          not null,
  descripcion    text,
  unidad         unidad_medida not null default 'unidad',
  costo_unitario numeric(12,4) not null default 0,
  stock_minimo   numeric(12,3) not null default 0,
  proveedor_id   bigint        references public.proveedor (id) on delete set null,
  activo         boolean       not null default true,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  constraint insumo_nombre_uk unique (nombre),
  constraint insumo_slug_uk   unique (slug),
  constraint insumo_costo_ck  check (costo_unitario >= 0),
  constraint insumo_minimo_ck check (stock_minimo >= 0)
);
create index if not exists insumo_proveedor_idx on public.insumo (proveedor_id);

comment on column public.insumo.costo_unitario is
  'Último costo conocido por unidad. Lo actualiza la compra al recibirse (promedio ponderado).';

-- ---------------------------------------------------------------------------
-- compra: cabecera. Mientras está en 'borrador' no mueve inventario;
--   al pasar a 'recibida' genera los movimientos y actualiza costos.
-- ---------------------------------------------------------------------------
create table if not exists public.compra (
  id             bigint generated always as identity primary key,
  codigo         text generated always as ('COM-' || lpad(id::text, 5, '0')) stored,
  proveedor_id   bigint        references public.proveedor (id) on delete set null,
  estado         estado_compra not null default 'borrador',
  fecha          date          not null default current_date,
  documento      text,                      -- nº de factura o recibo
  subtotal       numeric(12,2) not null default 0,
  descuento      numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  nota           text,
  registrado_por uuid          references public.perfil (id) on delete set null,
  recibida_at    timestamptz,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  constraint compra_codigo_uk    unique (codigo),
  constraint compra_subtotal_ck  check (subtotal  >= 0),
  constraint compra_descuento_ck check (descuento >= 0),
  constraint compra_total_ck     check (total     >= 0)
);
create index if not exists compra_proveedor_idx on public.compra (proveedor_id);
create index if not exists compra_fecha_idx     on public.compra (fecha desc);
create index if not exists compra_estado_idx    on public.compra (estado);

create table if not exists public.compra_item (
  id             bigint generated always as identity primary key,
  compra_id      bigint        not null references public.compra (id) on delete cascade,
  insumo_id      bigint        not null references public.insumo (id) on delete restrict,
  cantidad       numeric(12,3) not null,
  costo_unitario numeric(12,4) not null,
  subtotal       numeric(12,2) not null default 0,
  nota           text,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  constraint compra_item_cantidad_ck check (cantidad > 0),
  constraint compra_item_costo_ck    check (costo_unitario >= 0)
);
create index if not exists compra_item_compra_idx on public.compra_item (compra_id);
create index if not exists compra_item_insumo_idx on public.compra_item (insumo_id);

-- ---------------------------------------------------------------------------
-- Totales de la compra siempre calculados en la base: el panel no manda montos.
-- ---------------------------------------------------------------------------
create or replace function public.tg_compra_item_subtotal()
returns trigger
language plpgsql
as $$
begin
  new.subtotal := round(new.cantidad * new.costo_unitario, 2);
  return new;
end;
$$;

drop trigger if exists compra_item_subtotal on public.compra_item;
create trigger compra_item_subtotal
  before insert or update of cantidad, costo_unitario on public.compra_item
  for each row execute function public.tg_compra_item_subtotal();

create or replace function public.recalcular_compra(p_compra_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sub numeric(12,2);
begin
  select coalesce(sum(subtotal), 0) into v_sub
    from public.compra_item where compra_id = p_compra_id;
  update public.compra
     set subtotal = v_sub,
         total    = greatest(v_sub - descuento, 0)
   where id = p_compra_id;
end;
$$;

create or replace function public.tg_compra_recalcular()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_compra(coalesce(new.compra_id, old.compra_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists compra_recalcular on public.compra_item;
create trigger compra_recalcular
  after insert or update or delete on public.compra_item
  for each row execute function public.tg_compra_recalcular();

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['proveedor','insumo','compra','compra_item']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0012_inventario.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0012 · Módulo de inventario
--   Un solo kardex para las tres cosas que se almacenan: insumos, extras
--   (flores ya hechas) y productos (ramos ya armados). La existencia nunca
--   se guarda como número suelto: es la suma de los movimientos, así siempre
--   se puede explicar de dónde salió cada unidad.
-- =============================================================================

do $$ begin
  create type tipo_item_inventario as enum ('insumo','extra','producto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_movimiento as enum (
    'compra',      -- entra por una compra recibida
    'produccion',  -- entra porque se fabricó (y consume insumos)
    'consumo',     -- sale porque se usó para fabricar otra cosa
    'venta',       -- sale por un pedido
    'ajuste',      -- corrección de conteo (puede ser + o −)
    'merma',       -- sale por rotura o pérdida
    'devolucion'   -- vuelve a entrar
  );
exception when duplicate_object then null; end $$;

-- stock mínimo también para lo que se vende (para el aviso de reposición)
alter table public.extra    add column if not exists stock_minimo numeric(12,3) not null default 0;
alter table public.producto add column if not exists stock_minimo numeric(12,3) not null default 0;

-- ---------------------------------------------------------------------------
-- movimiento_inventario: cantidad CON SIGNO (+ entra, − sale).
--   La coherencia entre tipo_item y la referencia la garantiza el check.
-- ---------------------------------------------------------------------------
create table if not exists public.movimiento_inventario (
  id             bigint generated always as identity primary key,
  tipo_item      tipo_item_inventario not null,
  insumo_id      bigint      references public.insumo (id)   on delete cascade,
  extra_id       bigint      references public.extra (id)    on delete cascade,
  producto_id    bigint      references public.producto (id) on delete cascade,
  tipo           tipo_movimiento not null,
  cantidad       numeric(12,3) not null,
  costo_unitario numeric(12,4) not null default 0,
  compra_id      bigint      references public.compra (id) on delete set null,
  pedido_id      bigint      references public.pedido (id) on delete set null,
  referencia     text,                       -- clave para no duplicar procesos
  nota           text,
  perfil_id      uuid        references public.perfil (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint movimiento_cantidad_ck check (cantidad <> 0),
  constraint movimiento_item_ck check (
    (tipo_item = 'insumo'   and insumo_id is not null and extra_id is null and producto_id is null) or
    (tipo_item = 'extra'    and extra_id  is not null and insumo_id is null and producto_id is null) or
    (tipo_item = 'producto' and producto_id is not null and insumo_id is null and extra_id is null)
  )
);
create index if not exists movimiento_insumo_idx   on public.movimiento_inventario (insumo_id);
create index if not exists movimiento_extra_idx    on public.movimiento_inventario (extra_id);
create index if not exists movimiento_producto_idx on public.movimiento_inventario (producto_id);
create index if not exists movimiento_fecha_idx    on public.movimiento_inventario (created_at desc);
-- Único sobre referencia, SIN predicado: un índice parcial no sirve para el
-- "on conflict (referencia)" de los procesos idempotentes. Varios NULL conviven
-- sin problema en un índice único.
drop index if exists public.movimiento_referencia_uk;
create unique index if not exists movimiento_referencia_uk
  on public.movimiento_inventario (referencia);

comment on table public.movimiento_inventario is
  'Kardex único de insumos, extras y productos. Existencia = suma de cantidad.';

-- ---------------------------------------------------------------------------
-- Existencias
-- ---------------------------------------------------------------------------
create or replace view public.v_existencia_insumo
with (security_invoker = true) as
select i.id, i.nombre, i.unidad, i.costo_unitario, i.stock_minimo, i.activo,
       coalesce(sum(m.cantidad), 0)::numeric(12,3) as existencia,
       (coalesce(sum(m.cantidad), 0) * i.costo_unitario)::numeric(12,2) as valorizado,
       coalesce(sum(m.cantidad), 0) <= i.stock_minimo as bajo_minimo
from public.insumo i
left join public.movimiento_inventario m on m.insumo_id = i.id
group by i.id;

create or replace view public.v_existencia_extra
with (security_invoker = true) as
select e.id, e.nombre, e.precio, e.estado, e.stock_minimo,
       coalesce(sum(m.cantidad), 0)::numeric(12,3) as existencia,
       coalesce(sum(m.cantidad), 0) <= e.stock_minimo as bajo_minimo
from public.extra e
left join public.movimiento_inventario m on m.extra_id = e.id
group by e.id;

create or replace view public.v_existencia_producto
with (security_invoker = true) as
select p.id, p.codigo, p.nombre, p.precio, p.estado, p.stock_minimo,
       coalesce(sum(m.cantidad), 0)::numeric(12,3) as existencia,
       coalesce(sum(m.cantidad), 0) <= p.stock_minimo as bajo_minimo
from public.producto p
left join public.movimiento_inventario m on m.producto_id = p.id
group by p.id;

/** Todo lo que hay que reponer, en una sola lista para el tablero. */
create or replace view public.v_stock_bajo
with (security_invoker = true) as
select 'insumo'::tipo_item_inventario as tipo_item, id, nombre, existencia, stock_minimo
  from public.v_existencia_insumo   where bajo_minimo and activo
union all
select 'extra', id, nombre, existencia, stock_minimo
  from public.v_existencia_extra    where bajo_minimo and estado <> 'inactivo'
union all
select 'producto', id, nombre, existencia, stock_minimo
  from public.v_existencia_producto where bajo_minimo and estado <> 'inactivo';

-- ---------------------------------------------------------------------------
-- registrar_movimiento: único camino para mover stock a mano (ajustes, mermas).
-- ---------------------------------------------------------------------------
create or replace function public.registrar_movimiento(
  p_tipo_item tipo_item_inventario,
  p_item_id   bigint,
  p_tipo      tipo_movimiento,
  p_cantidad  numeric,
  p_nota      text default null,
  p_costo     numeric default 0,
  p_referencia text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'La cantidad del movimiento no puede ser cero' using errcode = '22023';
  end if;

  insert into public.movimiento_inventario
    (tipo_item, insumo_id, extra_id, producto_id, tipo, cantidad,
     costo_unitario, nota, referencia, perfil_id)
  values
    (p_tipo_item,
     case when p_tipo_item = 'insumo'   then p_item_id end,
     case when p_tipo_item = 'extra'    then p_item_id end,
     case when p_tipo_item = 'producto' then p_item_id end,
     p_tipo, p_cantidad, coalesce(p_costo, 0), p_nota, p_referencia, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- recibir_compra: pasa la compra a 'recibida', mete los insumos al inventario
--   y actualiza el costo del insumo con promedio ponderado.
--   Es idempotente: si ya está recibida, no hace nada.
-- ---------------------------------------------------------------------------
create or replace function public.recibir_compra(p_compra_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado    estado_compra;
  v_item      record;
  v_existente numeric(12,3);
  v_costo_ant numeric(12,4);
  v_nuevo     numeric(12,4);
begin
  select estado into v_estado from public.compra where id = p_compra_id;
  if v_estado is null then
    raise exception 'La compra % no existe', p_compra_id using errcode = '22023';
  end if;
  if v_estado = 'recibida' then
    return jsonb_build_object('compra_id', p_compra_id, 'estado', 'recibida', 'cambio', false);
  end if;
  if v_estado = 'anulada' then
    raise exception 'La compra % está anulada' , p_compra_id using errcode = '22023';
  end if;

  for v_item in
    select ci.insumo_id, ci.cantidad, ci.costo_unitario
      from public.compra_item ci where ci.compra_id = p_compra_id
  loop
    -- costo promedio ponderado con lo que ya había
    select coalesce(sum(m.cantidad), 0) into v_existente
      from public.movimiento_inventario m where m.insumo_id = v_item.insumo_id;
    select costo_unitario into v_costo_ant
      from public.insumo where id = v_item.insumo_id;

    if v_existente > 0 then
      v_nuevo := round(((v_existente * v_costo_ant) + (v_item.cantidad * v_item.costo_unitario))
                       / (v_existente + v_item.cantidad), 4);
    else
      v_nuevo := v_item.costo_unitario;
    end if;

    update public.insumo set costo_unitario = v_nuevo where id = v_item.insumo_id;

    insert into public.movimiento_inventario
      (tipo_item, insumo_id, tipo, cantidad, costo_unitario, compra_id, referencia, perfil_id)
    values
      ('insumo', v_item.insumo_id, 'compra', v_item.cantidad, v_item.costo_unitario,
       p_compra_id, format('compra:%s:insumo:%s', p_compra_id, v_item.insumo_id), auth.uid());
  end loop;

  update public.compra
     set estado = 'recibida', recibida_at = now()
   where id = p_compra_id;

  return jsonb_build_object('compra_id', p_compra_id, 'estado', 'recibida', 'cambio', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- registrar_salida_pedido: descuenta del inventario lo que se entregó.
--   Se llama cuando el pedido se marca entregado. Idempotente por referencia.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_salida_pedido(p_pedido_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item  record;
  v_ex    record;
  v_lineas integer := 0;
begin
  if not exists (select 1 from public.pedido where id = p_pedido_id) then
    raise exception 'El pedido % no existe', p_pedido_id using errcode = '22023';
  end if;

  for v_item in
    select i.id, i.tipo, i.producto_id, i.extra_id, i.cantidad
      from public.pedido_item i where i.pedido_id = p_pedido_id
  loop
    if v_item.tipo = 'producto' and v_item.producto_id is not null then
      insert into public.movimiento_inventario
        (tipo_item, producto_id, tipo, cantidad, pedido_id, referencia, perfil_id)
      values ('producto', v_item.producto_id, 'venta', -v_item.cantidad, p_pedido_id,
              format('pedido:%s:item:%s', p_pedido_id, v_item.id), auth.uid())
      on conflict (referencia) do nothing;
      v_lineas := v_lineas + 1;

    elsif v_item.tipo = 'extra' and v_item.extra_id is not null then
      insert into public.movimiento_inventario
        (tipo_item, extra_id, tipo, cantidad, pedido_id, referencia, perfil_id)
      values ('extra', v_item.extra_id, 'venta', -v_item.cantidad, p_pedido_id,
              format('pedido:%s:item:%s', p_pedido_id, v_item.id), auth.uid())
      on conflict (referencia) do nothing;
      v_lineas := v_lineas + 1;
    end if;

    -- extras que van adentro de un ramo (personalizado o sumados al producto)
    for v_ex in
      select ie.id, ie.extra_id, ie.cantidad
        from public.pedido_item_extra ie
       where ie.pedido_item_id = v_item.id and ie.extra_id is not null
    loop
      insert into public.movimiento_inventario
        (tipo_item, extra_id, tipo, cantidad, pedido_id, referencia, perfil_id)
      values ('extra', v_ex.extra_id, 'venta', -(v_ex.cantidad * v_item.cantidad), p_pedido_id,
              format('pedido:%s:itemextra:%s', p_pedido_id, v_ex.id), auth.uid())
      on conflict (referencia) do nothing;
      v_lineas := v_lineas + 1;
    end loop;
  end loop;

  return jsonb_build_object('pedido_id', p_pedido_id, 'lineas', v_lineas);
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0013_produccion_y_costos.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0013 · Producción y costos (el cotizador del panel)
--   Las flores se fabrican a mano: cada extra tiene su receta de insumos y su
--   tiempo. El costo de un ramo es envoltorio + flores + insumos propios +
--   mano de obra. El panel muestra COSTO y sugiere precio; el catálogo muestra
--   el precio que decide la dueña. Es el mismo motor de configuración que el
--   armador del catálogo, mirado desde adentro.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- parametro: valores del negocio que cambian sin migrar (costo de la hora…)
-- ---------------------------------------------------------------------------
create table if not exists public.parametro (
  clave       text primary key,
  valor       numeric(12,4) not null,
  descripcion text,
  updated_at  timestamptz not null default now()
);

insert into public.parametro (clave, valor, descripcion) values
  ('costo_hora_mano_obra', 20.0000, 'Bs por hora de trabajo usado para costear (ver análisis de márgenes).'),
  ('margen_objetivo_pct',  60.0000, 'Margen sobre costo con el que se sugiere el precio de venta.'),
  ('minutos_taller_dia',  450.0000, 'Capacidad de trabajo del taller por día, en minutos.')
on conflict (clave) do nothing;

create or replace function public.parametro_valor(p_clave text, p_default numeric default 0)
returns numeric
language sql
stable
as $$
  select coalesce((select valor from public.parametro where clave = p_clave), p_default);
$$;

/** Los precios de la casa se anclan en múltiplos de 5. */
create or replace function public.redondear_a_5(p_monto numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(p_monto, 0) / 5.0) * 5.0;
$$;

-- ---------------------------------------------------------------------------
-- Tiempos de armado
-- ---------------------------------------------------------------------------
alter table public.extra       add column if not exists minutos_armado integer;
alter table public.envoltorio  add column if not exists minutos_armado integer;

-- ---------------------------------------------------------------------------
-- Recetas: qué insumos consume cada cosa
-- ---------------------------------------------------------------------------
create table if not exists public.extra_insumo (
  id         bigint generated always as identity primary key,
  extra_id   bigint        not null references public.extra (id)  on delete cascade,
  insumo_id  bigint        not null references public.insumo (id) on delete restrict,
  cantidad   numeric(12,4) not null,
  nota       text,
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),
  constraint extra_insumo_uk          unique (extra_id, insumo_id),
  constraint extra_insumo_cantidad_ck check (cantidad > 0)
);

create table if not exists public.envoltorio_insumo (
  id            bigint generated always as identity primary key,
  envoltorio_id bigint        not null references public.envoltorio (id) on delete cascade,
  insumo_id     bigint        not null references public.insumo (id)     on delete restrict,
  cantidad      numeric(12,4) not null,
  nota          text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  constraint envoltorio_insumo_uk          unique (envoltorio_id, insumo_id),
  constraint envoltorio_insumo_cantidad_ck check (cantidad > 0)
);

create table if not exists public.producto_insumo (
  id          bigint generated always as identity primary key,
  producto_id bigint        not null references public.producto (id) on delete cascade,
  insumo_id   bigint        not null references public.insumo (id)   on delete restrict,
  cantidad    numeric(12,4) not null,
  nota        text,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  constraint producto_insumo_uk          unique (producto_id, insumo_id),
  constraint producto_insumo_cantidad_ck check (cantidad > 0)
);

-- ---------------------------------------------------------------------------
-- Costos calculados
-- ---------------------------------------------------------------------------
create or replace view public.v_costo_extra
with (security_invoker = true) as
select
  e.id,
  e.nombre,
  e.precio,
  coalesce(e.minutos_armado, 0) as minutos_armado,
  coalesce((select sum(ei.cantidad * i.costo_unitario)
              from public.extra_insumo ei
              join public.insumo i on i.id = ei.insumo_id
             where ei.extra_id = e.id), 0)::numeric(12,4) as costo_materiales,
  (coalesce(e.minutos_armado, 0) / 60.0
     * public.parametro_valor('costo_hora_mano_obra', 20))::numeric(12,4) as costo_mano_obra,
  (coalesce((select sum(ei.cantidad * i.costo_unitario)
               from public.extra_insumo ei
               join public.insumo i on i.id = ei.insumo_id
              where ei.extra_id = e.id), 0)
   + coalesce(e.minutos_armado, 0) / 60.0
     * public.parametro_valor('costo_hora_mano_obra', 20))::numeric(12,4) as costo_total
from public.extra e;

create or replace view public.v_costo_envoltorio
with (security_invoker = true) as
select
  env.id,
  es.nombre || ' ' || tm.codigo as nombre,
  env.precio_base,
  env.espacios,
  coalesce(env.minutos_armado, 0) as minutos_armado,
  coalesce((select sum(eni.cantidad * i.costo_unitario)
              from public.envoltorio_insumo eni
              join public.insumo i on i.id = eni.insumo_id
             where eni.envoltorio_id = env.id), 0)::numeric(12,4) as costo_materiales,
  (coalesce(env.minutos_armado, 0) / 60.0
     * public.parametro_valor('costo_hora_mano_obra', 20))::numeric(12,4) as costo_mano_obra,
  (coalesce((select sum(eni.cantidad * i.costo_unitario)
               from public.envoltorio_insumo eni
               join public.insumo i on i.id = eni.insumo_id
              where eni.envoltorio_id = env.id), 0)
   + coalesce(env.minutos_armado, 0) / 60.0
     * public.parametro_valor('costo_hora_mano_obra', 20))::numeric(12,4) as costo_total
from public.envoltorio env
join public.estilo es on es.id = env.estilo_id
join public.tamano tm on tm.id = env.tamano_id;

/** Costo del ramo ya definido: envoltorio + flores + insumos propios + tiempo. */
create or replace view public.v_costo_producto
with (security_invoker = true) as
with flores as (
  select pe.producto_id, sum(pe.cantidad * ce.costo_total) as costo
    from public.producto_extra pe
    join public.v_costo_extra ce on ce.id = pe.extra_id
   group by pe.producto_id
),
propios as (
  select pi.producto_id, sum(pi.cantidad * i.costo_unitario) as costo
    from public.producto_insumo pi
    join public.insumo i on i.id = pi.insumo_id
   group by pi.producto_id
)
select
  p.id,
  p.codigo,
  p.nombre,
  p.precio,
  p.estado,
  coalesce(cen.costo_total, 0)::numeric(12,4) as costo_envoltorio,
  coalesce(f.costo, 0)::numeric(12,4)         as costo_flores,
  coalesce(pr.costo, 0)::numeric(12,4)        as costo_insumos_propios,
  (coalesce(p.minutos_armado, 0) / 60.0
     * public.parametro_valor('costo_hora_mano_obra', 20))::numeric(12,4) as costo_mano_obra,
  (coalesce(cen.costo_total, 0) + coalesce(f.costo, 0) + coalesce(pr.costo, 0)
   + coalesce(p.minutos_armado, 0) / 60.0
     * public.parametro_valor('costo_hora_mano_obra', 20))::numeric(12,4) as costo_total
from public.producto p
left join public.v_costo_envoltorio cen on cen.id = p.envoltorio_id
left join flores  f  on f.producto_id  = p.id
left join propios pr on pr.producto_id = p.id;

/** Lo que mira la dueña: qué deja cada ramo y cuál se vende a pérdida. */
create or replace view public.v_margen_producto
with (security_invoker = true) as
select
  c.id, c.codigo, c.nombre, c.estado,
  c.precio,
  c.costo_total,
  (c.precio - c.costo_total)::numeric(12,2) as margen,
  case when c.precio > 0
       then round((c.precio - c.costo_total) / c.precio * 100, 2)
       else null end as margen_pct,
  public.redondear_a_5(
    c.costo_total * (1 + public.parametro_valor('margen_objetivo_pct', 60) / 100)
  )::numeric(12,2) as precio_sugerido,
  (c.precio < c.costo_total) as a_perdida
from public.v_costo_producto c;

-- ---------------------------------------------------------------------------
-- costear_configuracion: el cotizador. Mismo payload que el armador del
--   catálogo (envoltorio + extras), pero devuelve COSTO y precio sugerido.
--     select public.costear_configuracion(3, '[{"extra_id":1,"cantidad":10}]');
-- ---------------------------------------------------------------------------
create or replace function public.costear_configuracion(
  p_envoltorio_id bigint,
  p_extras        jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_env          record;
  v_extra        jsonb;
  v_ce           record;
  v_cant         numeric(12,3);
  v_costo_mat    numeric(12,4) := 0;
  v_minutos      numeric(12,2) := 0;
  v_espacios_uso numeric(12,2) := 0;
  v_detalle      jsonb := '[]'::jsonb;
  v_hora         numeric := public.parametro_valor('costo_hora_mano_obra', 20);
  v_costo_mo     numeric(12,4);
  v_total        numeric(12,4);
begin
  select env.id, env.espacios, env.precio_base,
         coalesce(env.minutos_armado, 0) as minutos,
         ce.costo_materiales, ce.nombre
    into v_env
    from public.envoltorio env
    join public.v_costo_envoltorio ce on ce.id = env.id
   where env.id = p_envoltorio_id and env.activo;
  if not found then
    raise exception 'Envoltorio no disponible: %', p_envoltorio_id using errcode = '22023';
  end if;

  v_costo_mat := v_env.costo_materiales;
  v_minutos   := v_env.minutos;

  if jsonb_typeof(coalesce(p_extras, 'null'::jsonb)) = 'array' then
    for v_extra in select * from jsonb_array_elements(p_extras)
    loop
      v_cant := coalesce((v_extra->>'cantidad')::numeric, 1);
      select ce.id, ce.nombre, ce.costo_materiales, ce.minutos_armado, ce.costo_total, e.espacios
        into v_ce
        from public.v_costo_extra ce
        join public.extra e on e.id = ce.id
       where ce.id = (v_extra->>'extra_id')::bigint;
      if not found then
        raise exception 'Extra no encontrado: %', v_extra->>'extra_id' using errcode = '22023';
      end if;

      v_costo_mat    := v_costo_mat + v_ce.costo_materiales * v_cant;
      v_minutos      := v_minutos + coalesce(v_ce.minutos_armado, 0) * v_cant;
      v_espacios_uso := v_espacios_uso + coalesce(v_ce.espacios, 0) * v_cant;
      v_detalle := v_detalle || jsonb_build_object(
        'extra_id', v_ce.id, 'nombre', v_ce.nombre, 'cantidad', v_cant,
        'costo_unitario', v_ce.costo_total,
        'costo_linea', round(v_ce.costo_total * v_cant, 2));
    end loop;
  end if;

  v_costo_mo := round(v_minutos / 60.0 * v_hora, 4);
  v_total    := round(v_costo_mat + v_costo_mo, 2);

  return jsonb_build_object(
    'envoltorio',      v_env.nombre,
    'espacios_usados', v_espacios_uso,
    'espacios_capacidad', v_env.espacios,
    'cabe',            (v_env.espacios is null or v_espacios_uso <= v_env.espacios),
    'costo_materiales', round(v_costo_mat, 2),
    'minutos',         v_minutos,
    'costo_mano_obra', round(v_costo_mo, 2),
    'costo_total',     v_total,
    'precio_sugerido', public.redondear_a_5(
                         v_total * (1 + public.parametro_valor('margen_objetivo_pct', 60) / 100)),
    'detalle',         v_detalle
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- producir_extra: fabricar flores. Consume los insumos de la receta y suma
--   las unidades terminadas al inventario, todo en la misma transacción.
-- ---------------------------------------------------------------------------
create or replace function public.producir_extra(p_extra_id bigint, p_cantidad numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ing    record;
  v_costo  numeric(12,4);
  v_mov    bigint;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad a producir debe ser mayor a cero' using errcode = '22023';
  end if;
  if not exists (select 1 from public.extra where id = p_extra_id) then
    raise exception 'El extra % no existe', p_extra_id using errcode = '22023';
  end if;

  for v_ing in
    select ei.insumo_id, ei.cantidad
      from public.extra_insumo ei where ei.extra_id = p_extra_id
  loop
    insert into public.movimiento_inventario
      (tipo_item, insumo_id, tipo, cantidad, nota, perfil_id)
    values ('insumo', v_ing.insumo_id, 'consumo', -(v_ing.cantidad * p_cantidad),
            format('Producción de %s unidades del extra %s', p_cantidad, p_extra_id), auth.uid());
  end loop;

  select costo_total into v_costo from public.v_costo_extra where id = p_extra_id;

  insert into public.movimiento_inventario
    (tipo_item, extra_id, tipo, cantidad, costo_unitario, nota, perfil_id)
  values ('extra', p_extra_id, 'produccion', p_cantidad, coalesce(v_costo, 0),
          'Producción', auth.uid())
  returning id into v_mov;

  return jsonb_build_object('extra_id', p_extra_id, 'cantidad', p_cantidad,
                            'costo_unitario', coalesce(v_costo, 0), 'movimiento_id', v_mov);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['extra_insumo','envoltorio_insumo','producto_insumo']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0014_ventas_pagos_reportes.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0014 · Módulos de venta y reportes
--   La venta ya existe: es `pedido`. Acá se le agrega lo que el panel necesita
--   para cerrarla (pagos, descuento, quién atendió, cambio de estado) y las
--   vistas de reporte. Los pedidos del catálogo y las ventas de mostrador son
--   la misma tabla, se distinguen por `canal`.
-- =============================================================================

do $$ begin
  create type metodo_pago as enum ('efectivo','qr','transferencia','tarjeta','otro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Campos de gestión en el pedido
-- ---------------------------------------------------------------------------
alter table public.pedido add column if not exists descuento     numeric(10,2) not null default 0;
alter table public.pedido add column if not exists nota_interna  text;
alter table public.pedido add column if not exists atendido_por  uuid references public.perfil (id) on delete set null;
alter table public.pedido add column if not exists entregado_at  timestamptz;

do $$ begin
  alter table public.pedido add constraint pedido_descuento_ck check (descuento >= 0);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- pago: un pedido puede pagarse en varias veces (adelanto + saldo).
-- ---------------------------------------------------------------------------
create table if not exists public.pago (
  id             bigint generated always as identity primary key,
  pedido_id      bigint        not null references public.pedido (id) on delete cascade,
  monto          numeric(10,2) not null,
  metodo         metodo_pago   not null default 'efectivo',
  referencia     text,                        -- nº de transacción, últimos dígitos…
  fecha          timestamptz   not null default now(),
  nota           text,
  registrado_por uuid          references public.perfil (id) on delete set null,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  constraint pago_monto_ck check (monto > 0)
);
create index if not exists pago_pedido_idx on public.pago (pedido_id);
create index if not exists pago_fecha_idx  on public.pago (fecha desc);

-- ---------------------------------------------------------------------------
-- Saldo del pedido: total (con envío y descuento) contra lo cobrado.
-- ---------------------------------------------------------------------------
create or replace view public.v_pedido_saldo
with (security_invoker = true) as
select
  p.id,
  p.codigo,
  p.estado,
  (p.subtotal + p.costo_envio - p.descuento)::numeric(10,2) as total_cobrar,
  coalesce((select sum(g.monto) from public.pago g where g.pedido_id = p.id), 0)::numeric(10,2) as pagado,
  ((p.subtotal + p.costo_envio - p.descuento)
     - coalesce((select sum(g.monto) from public.pago g where g.pedido_id = p.id), 0))::numeric(10,2) as saldo,
  case
    when coalesce((select sum(g.monto) from public.pago g where g.pedido_id = p.id), 0) = 0
      then 'pendiente'
    when coalesce((select sum(g.monto) from public.pago g where g.pedido_id = p.id), 0)
         >= (p.subtotal + p.costo_envio - p.descuento)
      then 'pagado'
    else 'parcial'
  end as estado_pago
from public.pedido p;

-- ---------------------------------------------------------------------------
-- Recalcular el total del pedido (lo usa el panel al editar líneas o descuento)
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_pedido(p_pedido_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sub numeric(10,2);
begin
  select coalesce(sum(subtotal), 0) into v_sub
    from public.pedido_item where pedido_id = p_pedido_id;

  update public.pedido
     set subtotal = v_sub,
         total    = greatest(v_sub + costo_envio - descuento, 0)
   where id = p_pedido_id;

  return (select jsonb_build_object('id', id, 'codigo', codigo,
                                    'subtotal', subtotal, 'total', total)
            from public.pedido where id = p_pedido_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- registrar_pago
-- ---------------------------------------------------------------------------
create or replace function public.registrar_pago(
  p_pedido_id  bigint,
  p_monto      numeric,
  p_metodo     metodo_pago default 'efectivo',
  p_referencia text default null,
  p_nota       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pedido where id = p_pedido_id) then
    raise exception 'El pedido % no existe', p_pedido_id using errcode = '22023';
  end if;

  insert into public.pago (pedido_id, monto, metodo, referencia, nota, registrado_por)
  values (p_pedido_id, round(p_monto, 2), coalesce(p_metodo, 'efectivo'),
          nullif(btrim(p_referencia), ''), nullif(btrim(p_nota), ''), auth.uid())
  returning id into v_id;

  return (select jsonb_build_object('pago_id', v_id, 'pedido', s.codigo,
                                    'pagado', s.pagado, 'saldo', s.saldo,
                                    'estado_pago', s.estado_pago)
            from public.v_pedido_saldo s where s.id = p_pedido_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- cambiar_estado_pedido: un solo lugar donde el pedido cambia de estado.
--   Al entregar, descuenta el inventario (idempotente).
-- ---------------------------------------------------------------------------
create or replace function public.cambiar_estado_pedido(
  p_pedido_id bigint,
  p_estado    estado_pedido,
  p_nota      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_anterior estado_pedido;
begin
  select estado into v_anterior from public.pedido where id = p_pedido_id;
  if v_anterior is null then
    raise exception 'El pedido % no existe', p_pedido_id using errcode = '22023';
  end if;

  update public.pedido
     set estado       = p_estado,
         atendido_por = coalesce(atendido_por, auth.uid()),
         entregado_at = case when p_estado = 'entregado' then coalesce(entregado_at, now())
                             else entregado_at end,
         nota_interna = coalesce(nullif(btrim(p_nota), ''), nota_interna)
   where id = p_pedido_id;

  if p_estado = 'entregado' then
    perform public.registrar_salida_pedido(p_pedido_id);
  end if;

  insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_antes, datos_despues, nota)
  values (auth.uid(), 'cambio_estado', 'pedido', p_pedido_id::text,
          jsonb_build_object('estado', v_anterior),
          jsonb_build_object('estado', p_estado), p_nota);

  return jsonb_build_object('pedido_id', p_pedido_id, 'estado_anterior', v_anterior,
                            'estado', p_estado);
end;
$$;

-- ---------------------------------------------------------------------------
-- crear_venta_mostrador: misma mecánica que el catálogo (precios recalculados
--   en la base) pero marcada con canal 'mostrador'. Solo para el panel.
-- ---------------------------------------------------------------------------
create or replace function public.crear_venta_mostrador(
  p_cliente jsonb,
  p_items   jsonb,
  p_nota    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_res jsonb;
begin
  v_res := public.crear_pedido(p_cliente, p_items, '{"tipo":"recojo_tienda"}'::jsonb, p_nota);

  update public.pedido
     set canal        = 'mostrador',
         estado       = 'confirmado',
         atendido_por = auth.uid()
   where id = (v_res->>'id')::bigint;

  return v_res;
end;
$$;

-- =============================================================================
-- Módulo de reportes
-- =============================================================================

/** Ventas por día: cuántos pedidos, cuánto se vendió, cuánto se cobró. */
create or replace view public.v_reporte_ventas_dia
with (security_invoker = true) as
select
  (p.created_at at time zone 'America/La_Paz')::date as dia,
  p.canal,
  count(*)                                   as pedidos,
  sum(p.subtotal)::numeric(12,2)             as subtotal,
  sum(p.descuento)::numeric(12,2)            as descuentos,
  sum(p.total)::numeric(12,2)                as total,
  count(*) filter (where p.estado = 'cancelado') as cancelados,
  count(*) filter (where p.estado = 'entregado') as entregados
from public.pedido p
group by 1, 2;

create or replace view public.v_reporte_ventas_mes
with (security_invoker = true) as
select
  date_trunc('month', p.created_at at time zone 'America/La_Paz')::date as mes,
  p.canal,
  count(*)                       as pedidos,
  sum(p.total)::numeric(12,2)    as total,
  avg(p.total)::numeric(12,2)    as ticket_promedio
from public.pedido p
where p.estado <> 'cancelado'
group by 1, 2;

/** Qué se vende: ranking de productos. */
create or replace view public.v_reporte_producto_vendido
with (security_invoker = true) as
select
  i.producto_id,
  coalesce(pr.nombre, i.nombre)      as producto,
  sum(i.cantidad)::numeric(12,2)     as unidades,
  sum(i.subtotal)::numeric(12,2)     as vendido,
  count(distinct i.pedido_id)        as pedidos,
  max(p.created_at)                  as ultima_venta
from public.pedido_item i
join public.pedido p       on p.id = i.pedido_id and p.estado <> 'cancelado'
left join public.producto pr on pr.id = i.producto_id
where i.tipo = 'producto'
group by i.producto_id, coalesce(pr.nombre, i.nombre);

/** Qué flores salen más, sueltas o dentro de un ramo. */
create or replace view public.v_reporte_extra_vendido
with (security_invoker = true) as
with sueltos as (
  select i.extra_id, sum(i.cantidad) as unidades, sum(i.subtotal) as vendido
    from public.pedido_item i
    join public.pedido p on p.id = i.pedido_id and p.estado <> 'cancelado'
   where i.tipo = 'extra' and i.extra_id is not null
   group by i.extra_id
),
dentro as (
  select ie.extra_id,
         sum(ie.cantidad * i.cantidad) as unidades,
         sum(ie.subtotal * i.cantidad) as vendido
    from public.pedido_item_extra ie
    join public.pedido_item i on i.id = ie.pedido_item_id
    join public.pedido p      on p.id = i.pedido_id and p.estado <> 'cancelado'
   where ie.extra_id is not null
   group by ie.extra_id
)
select
  e.id as extra_id,
  e.nombre,
  (coalesce(s.unidades, 0) + coalesce(d.unidades, 0))::numeric(12,2) as unidades,
  coalesce(s.unidades, 0)::numeric(12,2) as unidades_sueltas,
  coalesce(d.unidades, 0)::numeric(12,2) as unidades_en_ramos,
  (coalesce(s.vendido, 0) + coalesce(d.vendido, 0))::numeric(12,2) as vendido
from public.extra e
left join sueltos s on s.extra_id = e.id
left join dentro  d on d.extra_id = e.id;

create or replace view public.v_reporte_compras_mes
with (security_invoker = true) as
select
  date_trunc('month', c.fecha)::date as mes,
  c.proveedor_id,
  pv.nombre                    as proveedor,
  count(*)                     as compras,
  sum(c.total)::numeric(12,2)  as total
from public.compra c
left join public.proveedor pv on pv.id = c.proveedor_id
where c.estado = 'recibida'
group by 1, 2, 3;

/** Consumo de insumos: qué se está gastando y cuánto cuesta. */
create or replace view public.v_reporte_consumo_insumo
with (security_invoker = true) as
select
  i.id as insumo_id,
  i.nombre,
  i.unidad,
  sum(case when m.cantidad < 0 then -m.cantidad else 0 end)::numeric(12,3) as consumido,
  sum(case when m.cantidad > 0 then  m.cantidad else 0 end)::numeric(12,3) as ingresado,
  (sum(case when m.cantidad < 0 then -m.cantidad else 0 end) * i.costo_unitario)::numeric(12,2) as costo_consumido
from public.insumo i
left join public.movimiento_inventario m on m.insumo_id = i.id
group by i.id;

/** Números de la portada del panel. */
create or replace view public.v_tablero_admin
with (security_invoker = true) as
select
  (select count(*) from public.pedido
    where estado in ('nuevo','enviado_whatsapp'))                     as pedidos_por_atender,
  (select count(*) from public.pedido
    where estado in ('confirmado','en_produccion','listo'))           as pedidos_en_curso,
  (select coalesce(sum(total), 0) from public.pedido
    where estado <> 'cancelado'
      and (created_at at time zone 'America/La_Paz')::date = (now() at time zone 'America/La_Paz')::date)
                                                                      as vendido_hoy,
  (select coalesce(sum(total), 0) from public.pedido
    where estado <> 'cancelado'
      and date_trunc('month', created_at at time zone 'America/La_Paz')
          = date_trunc('month', now() at time zone 'America/La_Paz')) as vendido_mes,
  (select coalesce(sum(saldo), 0) from public.v_pedido_saldo
    where estado_pago <> 'pagado' and estado not in ('cancelado'))    as por_cobrar,
  (select count(*) from public.v_stock_bajo)                          as alertas_stock,
  (select count(*) from public.v_margen_producto where a_perdida)     as productos_a_perdida;

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.pago;
create trigger set_updated_at before update on public.pago
  for each row execute function public.tg_set_updated_at();


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0015_rls_panel_admin.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0015 · RLS y permisos del panel admin
--   Regla de oro: `anon` (el catálogo web) no gana un solo permiso nuevo acá.
--   Todo lo del panel es para `authenticated`, y cada tabla pide un permiso
--   concreto vía public.tiene_permiso(). Sin rol asignado, un usuario logueado
--   no ve nada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS activo en todo lo nuevo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfil','rol','permiso','rol_permiso','usuario_rol','bitacora',
    'proveedor','insumo','compra','compra_item',
    'movimiento_inventario','parametro',
    'extra_insumo','envoltorio_insumo','producto_insumo','pago'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Políticas por tabla: [tabla, permiso para leer, permiso para escribir]
-- ---------------------------------------------------------------------------
do $$
declare
  m text[];
  mapa text[][] := array[
    -- administración
    ['rol',                   'rol.ver',        'rol.editar'],
    ['permiso',               'rol.ver',        'rol.editar'],
    ['rol_permiso',           'rol.ver',        'rol.editar'],
    ['usuario_rol',           'usuario.ver',    'usuario.editar'],
    -- compras
    ['proveedor',             'proveedor.ver',  'proveedor.editar'],
    ['insumo',                'insumo.ver',     'insumo.editar'],
    ['compra',                'compra.ver',     'compra.editar'],
    ['compra_item',           'compra.ver',     'compra.editar'],
    -- inventario
    ['movimiento_inventario', 'inventario.ver', 'inventario.editar'],
    -- producción y costos
    ['extra_insumo',          'maestro.ver',    'maestro.editar'],
    ['envoltorio_insumo',     'maestro.ver',    'maestro.editar'],
    ['producto_insumo',       'maestro.ver',    'maestro.editar'],
    ['parametro',             'maestro.ver',    'maestro.editar'],
    -- ventas
    ['pago',                  'venta.ver',      'pago.registrar'],
    -- maestro del catálogo (ya tienen su política de lectura pública)
    ['categoria',             'maestro.ver',    'maestro.editar'],
    ['estilo',                'maestro.ver',    'maestro.editar'],
    ['tamano',                'maestro.ver',    'maestro.editar'],
    ['envoltorio',            'maestro.ver',    'maestro.editar'],
    ['extra_categoria',       'maestro.ver',    'maestro.editar'],
    ['extra',                 'maestro.ver',    'maestro.editar'],
    ['producto',              'maestro.ver',    'maestro.editar'],
    ['producto_imagen',       'maestro.ver',    'maestro.editar'],
    ['producto_extra',        'maestro.ver',    'maestro.editar'],
    ['zona_envio',            'maestro.ver',    'maestro.editar'],
    -- ventas: pedidos y clientes
    ['cliente',               'cliente.ver',    'cliente.editar'],
    ['pedido',                'venta.ver',      'venta.editar'],
    ['pedido_item',           'venta.ver',      'venta.editar'],
    ['pedido_item_extra',     'venta.ver',      'venta.editar'],
    ['entrega',               'venta.ver',      'venta.editar']
  ];
begin
  foreach m slice 1 in array mapa
  loop
    execute format('drop policy if exists %I on public.%I', m[1] || '_panel_lectura', m[1]);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.tiene_permiso(%L))',
      m[1] || '_panel_lectura', m[1], m[2]);

    execute format('drop policy if exists %I on public.%I', m[1] || '_panel_escritura', m[1]);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.tiene_permiso(%L)) with check (public.tiene_permiso(%L))',
      m[1] || '_panel_escritura', m[1], m[3], m[3]);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Perfil y bitácora: reglas propias
-- ---------------------------------------------------------------------------
drop policy if exists perfil_propio on public.perfil;
create policy perfil_propio on public.perfil
  for select to authenticated
  using (id = auth.uid() or public.tiene_permiso('usuario.ver'));

drop policy if exists perfil_editar_propio on public.perfil;
create policy perfil_editar_propio on public.perfil
  for update to authenticated
  using (id = auth.uid() or public.tiene_permiso('usuario.editar'))
  with check (id = auth.uid() or public.tiene_permiso('usuario.editar'));

drop policy if exists perfil_alta on public.perfil;
create policy perfil_alta on public.perfil
  for insert to authenticated
  with check (public.tiene_permiso('usuario.editar'));

drop policy if exists perfil_baja on public.perfil;
create policy perfil_baja on public.perfil
  for delete to authenticated
  using (public.tiene_permiso('usuario.editar'));

-- la bitácora se lee, no se edita: la escriben las funciones security definer
drop policy if exists bitacora_lectura on public.bitacora;
create policy bitacora_lectura on public.bitacora
  for select to authenticated
  using (public.tiene_permiso('bitacora.ver'));

-- ---------------------------------------------------------------------------
-- 4. Grants: la tabla se abre a authenticated, RLS decide fila por fila
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfil','rol','permiso','rol_permiso','usuario_rol',
    'proveedor','insumo','compra','compra_item',
    'movimiento_inventario','parametro',
    'extra_insumo','envoltorio_insumo','producto_insumo','pago',
    'categoria','estilo','tamano','envoltorio','extra_categoria','extra',
    'producto','producto_imagen','producto_extra','zona_envio',
    'cliente','pedido','pedido_item','pedido_item_extra','entrega'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  grant select on public.bitacora to authenticated;
end $$;

-- secuencias de las tablas con identity
do $$
declare s record;
begin
  for s in
    select sequence_schema, sequence_name
      from information_schema.sequences where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence %I.%I to authenticated',
                   s.sequence_schema, s.sequence_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Vistas del panel (solo authenticated; el catálogo usa v_catalogo_producto)
-- ---------------------------------------------------------------------------
do $$
declare v text;
begin
  foreach v in array array[
    'v_existencia_insumo','v_existencia_extra','v_existencia_producto','v_stock_bajo',
    'v_costo_extra','v_costo_envoltorio','v_costo_producto','v_margen_producto',
    'v_pedido_saldo','v_reporte_ventas_dia','v_reporte_ventas_mes',
    'v_reporte_producto_vendido','v_reporte_extra_vendido','v_reporte_compras_mes',
    'v_reporte_consumo_insumo','v_tablero_admin'
  ]
  loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- La vista del catálogo hereda todos los privilegios por defecto del esquema:
-- anon solo debe poder leerla.
revoke insert, update, delete, truncate on public.v_catalogo_producto from anon, authenticated;
grant select on public.v_catalogo_producto to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funciones del panel: nunca para anon
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.tiene_permiso(text)',
    'public.es_admin()',
    'public.mis_permisos()',
    'public.registrar_movimiento(tipo_item_inventario,bigint,tipo_movimiento,numeric,text,numeric,text)',
    'public.recibir_compra(bigint)',
    'public.registrar_salida_pedido(bigint)',
    'public.recalcular_compra(bigint)',
    'public.costear_configuracion(bigint,jsonb)',
    'public.producir_extra(bigint,numeric)',
    'public.recalcular_pedido(bigint)',
    'public.registrar_pago(bigint,numeric,metodo_pago,text,text)',
    'public.cambiar_estado_pedido(bigint,estado_pedido,text)',
    'public.crear_venta_mostrador(jsonb,jsonb,text)',
    'public.parametro_valor(text,numeric)',
    'public.redondear_a_5(numeric)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- asignar_rol es de administración pura: solo service_role (o el SQL Editor)
revoke all on function public.asignar_rol(text,text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Bitácora automática en lo que importa auditar
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['producto','extra','envoltorio','insumo','compra',
                           'pedido','pago','usuario_rol','rol_permiso','parametro']
  loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function public.tg_bitacora()', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0016_seed_roles_permisos.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0016 · Roles y permisos iniciales
--   Los códigos de permiso son el contrato con el panel: el front pregunta
--   por 'venta.editar', nunca por un id. Agregar permisos nuevos es insertar
--   filas acá, no migrar datos.
--
--   Para nombrar al primer administrador: la persona se registra en el panel
--   (Supabase Auth) y después, desde el SQL Editor:
--       select public.asignar_rol('correo@de.elena', 'admin');
-- =============================================================================

insert into public.permiso (codigo, modulo, descripcion) values
  -- administración
  ('usuario.ver',        'administracion', 'Ver los usuarios del panel'),
  ('usuario.editar',     'administracion', 'Crear, editar y desactivar usuarios'),
  ('rol.ver',            'administracion', 'Ver roles y permisos'),
  ('rol.editar',         'administracion', 'Crear roles y asignarles permisos'),
  ('bitacora.ver',       'administracion', 'Ver la bitácora de cambios'),
  -- maestro
  ('maestro.ver',        'maestro',        'Ver productos, categorías, extras y envoltorios'),
  ('maestro.editar',     'maestro',        'Crear y editar el catálogo maestro y sus recetas'),
  -- inventario
  ('inventario.ver',     'inventario',     'Ver existencias y movimientos'),
  ('inventario.editar',  'inventario',     'Registrar ajustes, mermas y producción'),
  -- compras
  ('proveedor.ver',      'compra',         'Ver proveedores'),
  ('proveedor.editar',   'compra',         'Crear y editar proveedores'),
  ('insumo.ver',         'compra',         'Ver insumos y sus costos'),
  ('insumo.editar',      'compra',         'Crear y editar insumos'),
  ('compra.ver',         'compra',         'Ver compras'),
  ('compra.editar',      'compra',         'Registrar y recibir compras'),
  -- ventas
  ('venta.ver',          'venta',          'Ver pedidos y ventas'),
  ('venta.editar',       'venta',          'Editar pedidos y cambiar su estado'),
  ('pago.registrar',     'venta',          'Registrar pagos y cobros'),
  ('cliente.ver',        'venta',          'Ver la ficha de los clientes'),
  ('cliente.editar',     'venta',          'Editar los datos de los clientes'),
  -- reportes
  ('reporte.ver',        'reporte',        'Ver los reportes de ventas, compras e inventario')
on conflict (codigo) do update
  set modulo = excluded.modulo, descripcion = excluded.descripcion;

insert into public.rol (nombre, slug, descripcion, es_sistema) values
  ('Administrador', 'admin',      'Acceso total al panel.', true),
  ('Vendedor',      'vendedor',   'Atiende pedidos, cobra y gestiona clientes.', true),
  ('Producción',    'produccion', 'Arma los pedidos y mueve el inventario del taller.', true)
on conflict (slug) do update
  set nombre = excluded.nombre, descripcion = excluded.descripcion;

-- admin: todo
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r cross join public.permiso p
where r.slug = 'admin'
on conflict do nothing;

-- vendedor
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r join public.permiso p on p.codigo in (
  'venta.ver','venta.editar','pago.registrar','cliente.ver','cliente.editar',
  'maestro.ver','inventario.ver','reporte.ver'
)
where r.slug = 'vendedor'
on conflict do nothing;

-- producción
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r join public.permiso p on p.codigo in (
  'maestro.ver','maestro.editar','inventario.ver','inventario.editar',
  'insumo.ver','compra.ver','venta.ver','reporte.ver'
)
where r.slug = 'produccion'
on conflict do nothing;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0017_permisos_fijos_y_maestro.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0017 · Permisos fijos + lo que le faltaba al módulo maestro
--
--   1. El catálogo de PERMISOS es fijo: se define acá, en migración. Nadie
--      crea, edita ni borra permisos desde el panel. Lo que el panel sí hace
--      es gestionar ROLES y decidir qué permisos tiene cada rol.
--   2. "Gestionar producto (CRUD)" necesita más que la tabla: fotos en el
--      Storage, slug y código automáticos, y una sola foto principal.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. permiso: solo lectura. Ni siquiera el admin lo escribe desde el panel.
-- ---------------------------------------------------------------------------
drop policy if exists permiso_panel_lectura   on public.permiso;
drop policy if exists permiso_panel_escritura on public.permiso;
drop policy if exists permiso_lectura         on public.permiso;

-- cualquiera que entre al panel necesita ver la lista para armar los roles
create policy permiso_lectura on public.permiso
  for select to authenticated
  using (true);

revoke insert, update, delete on public.permiso from authenticated;

comment on table public.permiso is
  'Catálogo FIJO de permisos. Se cambia por migración (ver 0016), nunca desde el panel.';

-- ---------------------------------------------------------------------------
-- 2. Roles: se crean y se editan, pero los de sistema no se borran y el rol
--    admin no puede quedarse sin permisos (si no, nadie podría volver a entrar).
-- ---------------------------------------------------------------------------
create or replace function public.tg_proteger_rol_sistema()
returns trigger
language plpgsql
as $$
begin
  if old.es_sistema then
    raise exception 'El rol "%" es de sistema: se le pueden cambiar los permisos, pero no borrarlo',
      old.nombre using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_rol_sistema on public.rol;
create trigger proteger_rol_sistema
  before delete on public.rol
  for each row execute function public.tg_proteger_rol_sistema();

create or replace function public.tg_proteger_permisos_admin()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.rol r where r.id = old.rol_id and r.slug = 'admin') then
    raise exception 'El rol Administrador no puede perder permisos' using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_permisos_admin on public.rol_permiso;
create trigger proteger_permisos_admin
  before delete on public.rol_permiso
  for each row execute function public.tg_proteger_permisos_admin();

/** Los permisos de un rol, marcados: es lo que pinta la pantalla de roles. */
create or replace view public.v_rol_permiso
with (security_invoker = true) as
select
  r.id    as rol_id,
  r.nombre as rol,
  r.slug  as rol_slug,
  r.es_sistema,
  p.id    as permiso_id,
  p.codigo,
  p.modulo,
  p.descripcion,
  (rp.rol_id is not null) as asignado
from public.rol r
cross join public.permiso p
left join public.rol_permiso rp on rp.rol_id = r.id and rp.permiso_id = p.id;

/** Cambia de una un rol completo: la pantalla manda la lista final de códigos. */
create or replace function public.definir_permisos_rol(p_rol_id bigint, p_codigos text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_alta integer := 0;
  v_baja integer := 0;
begin
  if not public.tiene_permiso('rol.editar') then
    raise exception 'No tenés permiso para editar roles' using errcode = '42501';
  end if;

  select slug into v_slug from public.rol where id = p_rol_id;
  if v_slug is null then
    raise exception 'El rol % no existe', p_rol_id using errcode = '22023';
  end if;
  if v_slug = 'admin' then
    raise exception 'El rol Administrador siempre tiene todos los permisos' using errcode = '22023';
  end if;

  with borrados as (
    delete from public.rol_permiso rp
     where rp.rol_id = p_rol_id
       and rp.permiso_id not in (select id from public.permiso where codigo = any(p_codigos))
    returning 1
  )
  select count(*) into v_baja from borrados;

  with agregados as (
    insert into public.rol_permiso (rol_id, permiso_id)
    select p_rol_id, p.id from public.permiso p
     where p.codigo = any(p_codigos)
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = p_rol_id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*) into v_alta from agregados;

  return jsonb_build_object('rol_id', p_rol_id, 'agregados', v_alta, 'quitados', v_baja);
end;
$$;

-- el admin siempre tiene todo: si se agrega un permiso nuevo en una migración
-- futura, esta función lo reparte sin que nadie tenga que acordarse
create or replace function public.sincronizar_permisos_admin()
returns integer
language sql
security definer
set search_path = public
as $$
  with nuevos as (
    insert into public.rol_permiso (rol_id, permiso_id)
    select r.id, p.id
      from public.rol r cross join public.permiso p
     where r.slug = 'admin'
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = r.id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*)::integer from nuevos;
$$;

select public.sincronizar_permisos_admin();

-- =============================================================================
-- 3. Módulo maestro: gestionar el producto que sale en el catálogo web
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Slug automático: el panel manda el nombre, la base arma el slug si falta.
--   Se genera al CREAR. Renombrar un producto NO le cambia el slug: la URL
--   /productos/<slug> ya circula por TikTok y romperla es perder la venta.
--   Para regenerarlo a propósito, el panel manda slug = '' (cadena vacía).
-- ---------------------------------------------------------------------------
create or replace function public.tg_slug_automatico()
returns trigger
language plpgsql
as $$
declare
  v_base   text;
  v_slug   text;
  v_n      integer := 1;
  v_existe boolean;
begin
  -- en un update, un slug que no cambió se respeta tal cual
  if tg_op = 'UPDATE'
     and new.slug is not null and btrim(new.slug) <> ''
     and new.slug is not distinct from old.slug then
    return new;
  end if;

  -- slug explícito: se normaliza y se respeta. No se desambigua, porque los
  -- seeds hacen "insert ... on conflict (slug) do update" y agregarle un "-2"
  -- convertiría el upsert en un insert que choca contra el unique de nombre.
  if new.slug is not null and btrim(new.slug) <> '' then
    new.slug := public.slugify(new.slug);
    return new;
  end if;

  v_base := nullif(public.slugify(new.nombre), '');
  if v_base is null then
    raise exception 'No se pudo generar el slug a partir de "%"', new.nombre
      using errcode = '22023';
  end if;

  -- generado a partir del nombre: acá sí se desambigua (dos ramos pueden
  -- llamarse parecido y el panel no debería fallar por eso)
  v_slug := v_base;
  loop
    execute format(
      'select exists (select 1 from public.%I where slug = $1 and id is distinct from $2)',
      tg_table_name)
      into v_existe using v_slug, new.id;
    exit when not v_existe;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  new.slug := v_slug;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['producto','extra','categoria','extra_categoria','estilo']
  loop
    execute format('drop trigger if exists slug_automatico on public.%I', t);
    execute format('create trigger slug_automatico before insert or update of nombre, slug
                    on public.%I for each row execute function public.tg_slug_automatico()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Código automático del producto: AB-M-003 (estilo + tamaño + correlativo).
--   Si el panel manda uno, se respeta.
-- ---------------------------------------------------------------------------
create or replace function public.generar_codigo_producto(p_envoltorio_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_n       integer;
begin
  select upper(left(es.slug, 2)) || '-' || tm.codigo
    into v_prefijo
    from public.envoltorio env
    join public.estilo es on es.id = env.estilo_id
    join public.tamano tm on tm.id = env.tamano_id
   where env.id = p_envoltorio_id;

  v_prefijo := coalesce(v_prefijo, 'PRD');

  select coalesce(max(substring(codigo from '([0-9]+)$')::integer), 0) + 1
    into v_n
    from public.producto
   where codigo like v_prefijo || '-%';

  return v_prefijo || '-' || lpad(v_n::text, 3, '0');
end;
$$;

create or replace function public.tg_codigo_producto()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := public.generar_codigo_producto(new.envoltorio_id);
  else
    new.codigo := upper(btrim(new.codigo));
  end if;
  return new;
end;
$$;

drop trigger if exists codigo_automatico on public.producto;
create trigger codigo_automatico
  before insert on public.producto
  for each row execute function public.tg_codigo_producto();

-- ---------------------------------------------------------------------------
-- Una sola foto principal por producto: marcar una desmarca la anterior.
--   (existe un índice único parcial; sin esto el panel tendría que hacer dos
--    updates en el orden correcto y cualquier error deja el producto sin foto)
-- ---------------------------------------------------------------------------
create or replace function public.tg_una_foto_principal()
returns trigger
language plpgsql
as $$
begin
  if new.es_principal then
    update public.producto_imagen
       set es_principal = false
     where producto_id = new.producto_id
       and id is distinct from new.id
       -- no tocar la fila que un "insert ... on conflict (producto_id,
       -- storage_path) do update" va a actualizar en este mismo comando:
       -- Postgres no deja afectar la misma fila dos veces (ver 0009)
       and not (new.storage_path is not null and storage_path = new.storage_path)
       and es_principal;
  end if;
  return new;
end;
$$;

-- BEFORE, no AFTER: el índice único parcial producto_imagen_principal_uk se
-- evalúa al insertar, así que la anterior tiene que quedar desmarcada antes.
drop trigger if exists una_foto_principal on public.producto_imagen;
create trigger una_foto_principal
  before insert or update of es_principal on public.producto_imagen
  for each row execute function public.tg_una_foto_principal();

-- ---------------------------------------------------------------------------
-- Storage: el panel sube y borra fotos del bucket 'catalogo', pero solo con
--   permiso de maestro. Antes alcanzaba con estar logueado y no había forma
--   de borrar una foto vieja.
-- ---------------------------------------------------------------------------
drop policy if exists catalogo_escritura_autenticada on storage.objects;
drop policy if exists catalogo_update_autenticada    on storage.objects;
drop policy if exists catalogo_delete_autenticada    on storage.objects;
drop policy if exists catalogo_escritura_maestro     on storage.objects;
drop policy if exists catalogo_update_maestro        on storage.objects;
drop policy if exists catalogo_delete_maestro        on storage.objects;

create policy catalogo_escritura_maestro on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'));

create policy catalogo_update_maestro on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'))
  with check (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'));

create policy catalogo_delete_maestro on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'));

-- ---------------------------------------------------------------------------
-- v_producto_admin: la grilla del CRUD en una sola consulta.
--   A diferencia de v_catalogo_producto, muestra TODOS los estados
--   (incluido 'borrador' e 'inactivo') y agrega costo, margen y existencia.
-- ---------------------------------------------------------------------------
create or replace view public.v_producto_admin
with (security_invoker = true) as
select
  p.id,
  p.codigo,
  p.nombre,
  p.slug,
  p.descripcion,
  p.precio,
  p.precio_desde,
  p.estado,
  p.destacado,
  p.orden,
  p.lead_time_dias,
  p.minutos_armado,
  p.stock_minimo,
  p.categoria_id,
  c.nombre  as categoria,
  p.envoltorio_id,
  case when env.id is not null then es.nombre || ' ' || tm.codigo end as envoltorio,
  env.espacios as espacios_capacidad,
  (select count(*) from public.producto_imagen pi where pi.producto_id = p.id) as fotos,
  (select pi.url from public.producto_imagen pi
    where pi.producto_id = p.id
    order by pi.es_principal desc, pi.orden, pi.id limit 1) as imagen_principal,
  (select coalesce(sum(pe.cantidad), 0) from public.producto_extra pe
    where pe.producto_id = p.id) as extras_en_receta,
  cp.costo_total,
  mp.margen,
  mp.margen_pct,
  mp.precio_sugerido,
  mp.a_perdida,
  ep.existencia,
  p.created_at,
  p.updated_at
from public.producto p
join public.categoria c          on c.id = p.categoria_id
left join public.envoltorio env  on env.id = p.envoltorio_id
left join public.estilo es       on es.id = env.estilo_id
left join public.tamano tm       on tm.id = env.tamano_id
left join public.v_costo_producto cp   on cp.id = p.id
left join public.v_margen_producto mp  on mp.id = p.id
left join public.v_existencia_producto ep on ep.id = p.id;

-- ---------------------------------------------------------------------------
-- Grants de lo nuevo
-- ---------------------------------------------------------------------------
revoke all on public.v_producto_admin from anon;
revoke all on public.v_rol_permiso    from anon;
grant select on public.v_producto_admin to authenticated;
grant select on public.v_rol_permiso    to authenticated;

revoke all on function public.definir_permisos_rol(bigint, text[]) from public, anon;
grant execute on function public.definir_permisos_rol(bigint, text[]) to authenticated;

revoke all on function public.generar_codigo_producto(bigint) from public, anon;
grant execute on function public.generar_codigo_producto(bigint) to authenticated;

revoke all on function public.sincronizar_permisos_admin() from public, anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0018_endurecer_privilegios.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0018 · Endurecer privilegios heredados
--
--   Supabase crea el esquema public con `grant all on tables to anon,
--   authenticated`. Eso incluye TRUNCATE, TRIGGER y REFERENCES, que los
--   `grant select` de las migraciones anteriores nunca quitaron.
--
--   TRUNCATE es el peligroso: **no respeta RLS**. Con la clave publicable
--   (que viaja en el navegador) el rol anon tenía derecho de truncar
--   `producto`, `pedido` y `cliente`. No hay un endpoint de PostgREST que lo
--   dispare hoy, pero es un privilegio que nadie necesita y que convierte
--   cualquier otro fallo en pérdida total de datos.
--
--   TRIGGER también sobra: permite colgar un trigger propio de una tabla.
--
--   Esta migración es idempotente y no toca los grants legítimos
--   (select para anon, CRUD para authenticated: eso lo sigue filtrando RLS).
-- =============================================================================

do $$
declare
  r record;
begin
  -- tablas y vistas del esquema public
  for r in
    select c.relname, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v','m','p')
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated',
                   r.relname);
  end loop;
end $$;

-- que las tablas y vistas futuras tampoco los hereden
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- anon no necesita ejecutar nada que no esté explícitamente permitido
-- (crear_pedido y marcar_pedido_enviado_whatsapp se le vuelven a otorgar en 0005)
revoke all on schema public from anon;
grant usage on schema public to anon;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0019_usuarios_panel.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0019 · Usuarios del panel
--   Lo que le falta a la pantalla de administración: las dos vistas que lista
--   (personas y roles) y los candados para que nadie se deje afuera.
--
--   La 0017 ya protegió el CATÁLOGO de permisos (fijo) y los roles de sistema.
--   Acá se protege lo otro que puede dejar la casa cerrada por dentro:
--   quedarse sin ningún administrador activo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Candados
-- ---------------------------------------------------------------------------

/** Cuántas personas activas tienen hoy el rol admin. */
create or replace function public.cantidad_admins()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.usuario_rol ur
    join public.rol r    on r.id = ur.rol_id and r.slug = 'admin' and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo;
$$;

/**
 * Sacar un rol: dos reglas.
 *   - nadie se quita a sí mismo el admin (que lo haga otro admin, a propósito);
 *   - el último admin activo no se puede quitar, o nadie vuelve a entrar.
 */
create or replace function public.tg_proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rol r where r.id = old.rol_id and r.slug = 'admin') then
    return old;
  end if;

  if old.perfil_id = auth.uid() then
    raise exception 'No podés quitarte a vos mismo el rol Administrador: pedíselo a otro administrador'
      using errcode = '22023';
  end if;

  if public.cantidad_admins() <= 1 then
    raise exception 'Es el único administrador activo: nombrá a otro antes de quitarle el rol'
      using errcode = '22023';
  end if;

  return old;
end;
$$;

drop trigger if exists proteger_ultimo_admin on public.usuario_rol;
create trigger proteger_ultimo_admin
  before delete on public.usuario_rol
  for each row execute function public.tg_proteger_ultimo_admin();

/**
 * Desactivar una persona es sacarle la entrada al panel. Mismas dos reglas,
 * más la obvia: nadie se desactiva a sí mismo.
 */
create or replace function public.tg_proteger_perfil_activo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.activo and not new.activo then
    if old.id = auth.uid() then
      raise exception 'No podés desactivar tu propia cuenta' using errcode = '22023';
    end if;

    if exists (
      select 1
        from public.usuario_rol ur
        join public.rol r on r.id = ur.rol_id and r.slug = 'admin'
       where ur.perfil_id = old.id
    ) and public.cantidad_admins() <= 1 then
      raise exception 'Es el único administrador activo: nombrá a otro antes de desactivarlo'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_perfil_activo on public.perfil;
create trigger proteger_perfil_activo
  before update on public.perfil
  for each row execute function public.tg_proteger_perfil_activo();

-- ---------------------------------------------------------------------------
-- 2. Vistas de la pantalla
--
--    Van en security definer (el default de una vista) y filtran por permiso
--    adentro: necesitan leer auth.users, al que `authenticated` no llega, y
--    tienen que contar usuarios de un rol aunque quien mire solo tenga rol.ver.
-- ---------------------------------------------------------------------------

/** Las personas del panel, con sus roles y su última entrada. */
create or replace view public.v_usuario_admin as
select
  pe.id,
  pe.nombre,
  coalesce(pe.email, u.email)                    as email,
  pe.telefono,
  pe.activo,
  pe.created_at,
  u.last_sign_in_at                              as ultimo_acceso,
  (u.email_confirmed_at is not null)             as confirmado,
  coalesce(
    (select array_agg(r.nombre order by r.nombre)
       from public.usuario_rol ur
       join public.rol r on r.id = ur.rol_id
      where ur.perfil_id = pe.id),
    '{}'::text[]
  )                                              as roles,
  exists (
    select 1 from public.usuario_rol ur
    join public.rol r on r.id = ur.rol_id and r.slug = 'admin'
    where ur.perfil_id = pe.id
  )                                              as es_admin,
  (select count(distinct p.codigo)
     from public.usuario_rol ur
     join public.rol r          on r.id = ur.rol_id and r.activo
     join public.rol_permiso rp on rp.rol_id = r.id
     join public.permiso p      on p.id = rp.permiso_id
    where ur.perfil_id = pe.id)                  as permisos
from public.perfil pe
join auth.users u on u.id = pe.id
where public.tiene_permiso('usuario.ver');

comment on view public.v_usuario_admin is
  'Personas del panel para la pantalla de administración. Filtra por usuario.ver.';

/** Los roles, con cuánta gente los usa y cuántos permisos abarcan. */
create or replace view public.v_rol_admin as
select
  r.id,
  r.nombre,
  r.slug,
  r.descripcion,
  r.es_sistema,
  r.activo,
  (select count(*) from public.rol_permiso rp where rp.rol_id = r.id)  as permisos,
  (select count(*) from public.usuario_rol ur where ur.rol_id = r.id)  as usuarios
from public.rol r
where public.tiene_permiso('rol.ver');

comment on view public.v_rol_admin is
  'Roles con su alcance y cuánta gente los tiene. Filtra por rol.ver.';

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------
revoke all on public.v_usuario_admin from anon, authenticated;
revoke all on public.v_rol_admin     from anon, authenticated;
grant select on public.v_usuario_admin to authenticated;
grant select on public.v_rol_admin     to authenticated;

revoke all on function public.cantidad_admins() from public, anon;
grant execute on function public.cantidad_admins() to authenticated;

-- las vistas nuevas tampoco heredan privilegios de más (ver 0018)
revoke truncate, trigger, references on public.v_usuario_admin, public.v_rol_admin
  from anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>> migrations/0020_superadmin.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Detalles Elena · 0020 · Superadministrador
--   Un escalón por encima del admin: ve y hace todo, incluso lo que el
--   administrador no ve.
--
--   La regla nueva: para quien NO es superadmin, el rol 'superadmin' y las
--   personas que lo tienen SON INVISIBLES. No es que aparezcan en gris: no
--   están. Así el admin puede gestionar roles y usuarios con total libertad
--   sin poder tocar —ni enterarse de— la cuenta de arriba.
--
--   Eso se hace con RLS, no escondiendo botones: aunque alguien consulte la
--   API a mano con su sesión, las filas no vuelven.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. El rol
-- ---------------------------------------------------------------------------
insert into public.rol (nombre, slug, descripcion, es_sistema) values
  ('Superadministrador', 'superadmin',
   'Dueño del sistema. Ve todo, incluso los roles y las cuentas que el administrador no ve.',
   true)
on conflict (slug) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      es_sistema = true;

-- acceso total: todos los permisos que existan
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r cross join public.permiso p
where r.slug = 'superadmin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Helpers
--
--    Todos security definer: las políticas RLS los llaman fila por fila, así
--    que no pueden depender de RLS ellos mismos (sería recursión infinita).
-- ---------------------------------------------------------------------------

/** ¿Quien está conectado es superadmin? */
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuario_rol ur
      join public.rol r     on r.id = ur.rol_id and r.slug = 'superadmin' and r.activo
      join public.perfil pe on pe.id = ur.perfil_id and pe.activo
     where ur.perfil_id = auth.uid()
  );
$$;

/** ¿Esta persona es superadmin? (para esconderla de los demás) */
create or replace function public.perfil_es_superadmin(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuario_rol ur
      join public.rol r on r.id = ur.rol_id and r.slug = 'superadmin'
     where ur.perfil_id = p_perfil
  );
$$;

/** ¿Este rol es el reservado? */
create or replace function public.rol_es_superadmin(p_rol bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.rol r where r.id = p_rol and r.slug = 'superadmin');
$$;

/** Lo que se puede ver: o sos superadmin, o el rol no es el reservado. */
create or replace function public.puede_ver_rol(p_rol bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin() or not public.rol_es_superadmin(p_rol);
$$;

/** Ídem para personas. */
create or replace function public.puede_ver_perfil(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin() or not public.perfil_es_superadmin(p_perfil);
$$;

-- ---------------------------------------------------------------------------
-- 3. Políticas: reemplazan a las que genera la 0015 para estas cuatro tablas
-- ---------------------------------------------------------------------------

-- rol -----------------------------------------------------------------------
drop policy if exists rol_panel_lectura on public.rol;
create policy rol_panel_lectura on public.rol
  for select to authenticated
  using (public.tiene_permiso('rol.ver')
         and (public.es_superadmin() or slug <> 'superadmin'));

drop policy if exists rol_panel_escritura on public.rol;
create policy rol_panel_escritura on public.rol
  for all to authenticated
  using (public.tiene_permiso('rol.editar')
         and (public.es_superadmin() or slug <> 'superadmin'))
  with check (public.tiene_permiso('rol.editar')
         and (public.es_superadmin() or slug <> 'superadmin'));

-- rol_permiso ---------------------------------------------------------------
drop policy if exists rol_permiso_panel_lectura on public.rol_permiso;
create policy rol_permiso_panel_lectura on public.rol_permiso
  for select to authenticated
  using (public.tiene_permiso('rol.ver') and public.puede_ver_rol(rol_id));

drop policy if exists rol_permiso_panel_escritura on public.rol_permiso;
create policy rol_permiso_panel_escritura on public.rol_permiso
  for all to authenticated
  using (public.tiene_permiso('rol.editar') and public.puede_ver_rol(rol_id))
  with check (public.tiene_permiso('rol.editar') and public.puede_ver_rol(rol_id));

-- usuario_rol ---------------------------------------------------------------
-- se esconde por los dos lados: ni el rol reservado ni la persona que lo tiene
drop policy if exists usuario_rol_panel_lectura on public.usuario_rol;
create policy usuario_rol_panel_lectura on public.usuario_rol
  for select to authenticated
  using (public.tiene_permiso('usuario.ver')
         and public.puede_ver_rol(rol_id)
         and public.puede_ver_perfil(perfil_id));

drop policy if exists usuario_rol_panel_escritura on public.usuario_rol;
create policy usuario_rol_panel_escritura on public.usuario_rol
  for all to authenticated
  using (public.tiene_permiso('usuario.editar')
         and public.puede_ver_rol(rol_id)
         and public.puede_ver_perfil(perfil_id))
  with check (public.tiene_permiso('usuario.editar')
         and public.puede_ver_rol(rol_id)
         and public.puede_ver_perfil(perfil_id));

-- perfil --------------------------------------------------------------------
drop policy if exists perfil_propio on public.perfil;
create policy perfil_propio on public.perfil
  for select to authenticated
  using (id = auth.uid()
         or (public.tiene_permiso('usuario.ver') and public.puede_ver_perfil(id)));

drop policy if exists perfil_editar_propio on public.perfil;
create policy perfil_editar_propio on public.perfil
  for update to authenticated
  using (id = auth.uid()
         or (public.tiene_permiso('usuario.editar') and public.puede_ver_perfil(id)))
  with check (id = auth.uid()
         or (public.tiene_permiso('usuario.editar') and public.puede_ver_perfil(id)));

drop policy if exists perfil_baja on public.perfil;
create policy perfil_baja on public.perfil
  for delete to authenticated
  using (public.tiene_permiso('usuario.editar') and public.puede_ver_perfil(id));

-- bitácora ------------------------------------------------------------------
-- lo que hizo el superadmin tampoco se le muestra al admin
drop policy if exists bitacora_lectura on public.bitacora;
create policy bitacora_lectura on public.bitacora
  for select to authenticated
  using (public.tiene_permiso('bitacora.ver')
         and (perfil_id is null or public.puede_ver_perfil(perfil_id)));

-- ---------------------------------------------------------------------------
-- 4. Las vistas del panel son security definer: el filtro va adentro
-- ---------------------------------------------------------------------------
create or replace view public.v_usuario_admin as
select
  pe.id,
  pe.nombre,
  coalesce(pe.email, u.email)                    as email,
  pe.telefono,
  pe.activo,
  pe.created_at,
  u.last_sign_in_at                              as ultimo_acceso,
  (u.email_confirmed_at is not null)             as confirmado,
  coalesce(
    (select array_agg(r.nombre order by r.nombre)
       from public.usuario_rol ur
       join public.rol r on r.id = ur.rol_id
      where ur.perfil_id = pe.id),
    '{}'::text[]
  )                                              as roles,
  exists (
    select 1 from public.usuario_rol ur
    join public.rol r on r.id = ur.rol_id and r.slug in ('admin','superadmin')
    where ur.perfil_id = pe.id
  )                                              as es_admin,
  (select count(distinct p.codigo)
     from public.usuario_rol ur
     join public.rol r          on r.id = ur.rol_id and r.activo
     join public.rol_permiso rp on rp.rol_id = r.id
     join public.permiso p      on p.id = rp.permiso_id
    where ur.perfil_id = pe.id)                  as permisos
from public.perfil pe
join auth.users u on u.id = pe.id
where public.tiene_permiso('usuario.ver')
  and public.puede_ver_perfil(pe.id);

comment on view public.v_usuario_admin is
  'Personas del panel. Filtra por usuario.ver y esconde a los superadmin de quien no lo es.';

create or replace view public.v_rol_admin as
select
  r.id,
  r.nombre,
  r.slug,
  r.descripcion,
  r.es_sistema,
  r.activo,
  (select count(*) from public.rol_permiso rp where rp.rol_id = r.id)  as permisos,
  (select count(*) from public.usuario_rol ur where ur.rol_id = r.id)  as usuarios
from public.rol r
where public.tiene_permiso('rol.ver')
  and public.puede_ver_rol(r.id);

comment on view public.v_rol_admin is
  'Roles con su alcance. Filtra por rol.ver y esconde el rol superadmin de quien no lo es.';

-- v_rol_permiso es security_invoker: hereda las políticas de rol y rol_permiso,
-- así que el rol reservado ya no aparece en la matriz. No hace falta tocarla.

-- ---------------------------------------------------------------------------
-- 5. Candados actualizados
-- ---------------------------------------------------------------------------

/** El superadmin cuenta como administrador para la regla de "no quedarse sin". */
create or replace function public.cantidad_admins()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct pe.id)::integer
    from public.usuario_rol ur
    join public.rol r     on r.id = ur.rol_id and r.slug in ('admin','superadmin') and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo;
$$;

/** Ni admin ni superadmin pierden permisos: son los dos roles que abren la puerta. */
create or replace function public.tg_proteger_permisos_admin()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.rol r
              where r.id = old.rol_id and r.slug in ('admin','superadmin')) then
    raise exception 'El rol % no puede perder permisos',
      (select nombre from public.rol where id = old.rol_id) using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_permisos_admin on public.rol_permiso;
create trigger proteger_permisos_admin
  before delete on public.rol_permiso
  for each row execute function public.tg_proteger_permisos_admin();

/**
 * Mismo candado del último admin, ahora contando también al superadmin.
 *
 * Ojo con el conteo: lo que importa no es cuánta gente administra HOY, sino
 * cuánta va a quedar DESPUÉS de este borrado. Si alguien tiene los dos roles,
 * quitarle uno no deja a nadie afuera y no hay por qué frenarlo.
 */
create or replace function public.tg_proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quedan integer;
begin
  if not exists (select 1 from public.rol r
                  where r.id = old.rol_id and r.slug in ('admin','superadmin')) then
    return old;
  end if;

  if old.perfil_id = auth.uid() then
    raise exception 'No podés quitarte a vos mismo el rol que te deja administrar: pedíselo a otro administrador'
      using errcode = '22023';
  end if;

  select count(distinct pe.id) into v_quedan
    from public.usuario_rol ur
    join public.rol r     on r.id = ur.rol_id and r.slug in ('admin','superadmin') and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo
   where not (ur.perfil_id = old.perfil_id and ur.rol_id = old.rol_id);

  if v_quedan = 0 then
    raise exception 'Es el único administrador activo: nombrá a otro antes de quitarle el rol'
      using errcode = '22023';
  end if;

  return old;
end;
$$;

/** Ídem al desactivar una persona: lo que cuenta es quién queda después. */
create or replace function public.tg_proteger_perfil_activo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quedan integer;
begin
  if old.activo and not new.activo then
    if old.id = auth.uid() then
      raise exception 'No podés desactivar tu propia cuenta' using errcode = '22023';
    end if;

    select count(distinct pe.id) into v_quedan
      from public.usuario_rol ur
      join public.rol r     on r.id = ur.rol_id and r.slug in ('admin','superadmin') and r.activo
      join public.perfil pe on pe.id = ur.perfil_id and pe.activo
     where pe.id <> old.id;

    if v_quedan = 0 and exists (
      select 1 from public.usuario_rol ur
      join public.rol r on r.id = ur.rol_id and r.slug in ('admin','superadmin')
      where ur.perfil_id = old.id
    ) then
      raise exception 'Es el único administrador activo: nombrá a otro antes de desactivarlo'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_perfil_activo on public.perfil;
create trigger proteger_perfil_activo
  before update on public.perfil
  for each row execute function public.tg_proteger_perfil_activo();

drop trigger if exists proteger_ultimo_admin on public.usuario_rol;
create trigger proteger_ultimo_admin
  before delete on public.usuario_rol
  for each row execute function public.tg_proteger_ultimo_admin();

/** La matriz de permisos no aplica a los dos roles que siempre tienen todo. */
create or replace function public.definir_permisos_rol(p_rol_id bigint, p_codigos text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_alta integer := 0;
  v_baja integer := 0;
begin
  if not public.tiene_permiso('rol.editar') then
    raise exception 'No tenés permiso para editar roles' using errcode = '42501';
  end if;

  select slug into v_slug from public.rol where id = p_rol_id;
  if v_slug is null then
    raise exception 'El rol % no existe', p_rol_id using errcode = '22023';
  end if;
  if v_slug in ('admin', 'superadmin') then
    raise exception 'Ese rol siempre tiene todos los permisos' using errcode = '22023';
  end if;
  -- el rol reservado no se toca desde una sesión que ni siquiera debería verlo
  if not public.puede_ver_rol(p_rol_id) then
    raise exception 'El rol % no existe', p_rol_id using errcode = '22023';
  end if;

  with borrados as (
    delete from public.rol_permiso rp
     where rp.rol_id = p_rol_id
       and rp.permiso_id not in (select id from public.permiso where codigo = any(p_codigos))
    returning 1
  )
  select count(*) into v_baja from borrados;

  with agregados as (
    insert into public.rol_permiso (rol_id, permiso_id)
    select p_rol_id, p.id from public.permiso p
     where p.codigo = any(p_codigos)
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = p_rol_id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*) into v_alta from agregados;

  return jsonb_build_object('rol_id', p_rol_id, 'agregados', v_alta, 'quitados', v_baja);
end;
$$;

/** Los permisos nuevos de una migración futura caen solos en los dos roles. */
create or replace function public.sincronizar_permisos_admin()
returns integer
language sql
security definer
set search_path = public
as $$
  with nuevos as (
    insert into public.rol_permiso (rol_id, permiso_id)
    select r.id, p.id
      from public.rol r cross join public.permiso p
     where r.slug in ('admin', 'superadmin')
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = r.id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*)::integer from nuevos;
$$;

select public.sincronizar_permisos_admin();

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.es_superadmin()               from public, anon;
revoke all on function public.perfil_es_superadmin(uuid)    from public, anon;
revoke all on function public.rol_es_superadmin(bigint)     from public, anon;
revoke all on function public.puede_ver_rol(bigint)         from public, anon;
revoke all on function public.puede_ver_perfil(uuid)        from public, anon;
grant execute on function public.es_superadmin()            to authenticated;
grant execute on function public.perfil_es_superadmin(uuid) to authenticated;
grant execute on function public.rol_es_superadmin(bigint)  to authenticated;
grant execute on function public.puede_ver_rol(bigint)      to authenticated;
grant execute on function public.puede_ver_perfil(uuid)     to authenticated;

revoke all on public.v_usuario_admin from anon, authenticated;
revoke all on public.v_rol_admin     from anon, authenticated;
grant select on public.v_usuario_admin to authenticated;
grant select on public.v_rol_admin     to authenticated;
revoke truncate, trigger, references on public.v_usuario_admin, public.v_rol_admin
  from anon, authenticated;
