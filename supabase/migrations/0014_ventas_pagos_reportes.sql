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
