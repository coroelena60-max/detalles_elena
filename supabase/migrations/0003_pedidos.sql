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
