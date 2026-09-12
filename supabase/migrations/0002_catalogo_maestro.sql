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
