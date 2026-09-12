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
