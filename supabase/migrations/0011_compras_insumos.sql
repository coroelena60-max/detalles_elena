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
