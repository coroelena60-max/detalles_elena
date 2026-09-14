-- =============================================================================
-- 0027 · Devolver un cobro
--
-- Hasta ahora, si se cancelaba una venta ya cobrada, el cobro quedaba anotado
-- para siempre: la venta figuraba "Cancelado · Pagado" y la plata seguía sumando
-- en "cobros por método". La tabla `pago` no admite montos negativos (y un cobro
-- en contra confunde), así que el cobro se MARCA como devuelto: queda a la vista
-- con fecha, quién y por qué, igual que un gasto anulado, y deja de sumar.
--
-- 1. pago.devuelto_at / devuelto_por / motivo_devolucion
-- 2. v_pedido_saldo: "pagado" y el saldo cuentan solo los cobros no devueltos
-- 3. devolver_cobro(pago_id, motivo): con pago.registrar y permiso de editar el
--    pedido (venta.editar o pedido.editar según el canal). No se deshace.
-- 4. reporte_ventas_confirmadas: "cobros por método" sin los devueltos
--
-- La bitácora ya registra los cambios en `pago` (trigger auditar de la 0015).
-- Idempotente: se puede volver a ejecutar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
alter table public.pago add column if not exists devuelto_at       timestamptz;
alter table public.pago add column if not exists devuelto_por      uuid references public.perfil (id) on delete set null;
alter table public.pago add column if not exists motivo_devolucion text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pago_devolucion_ck') then
    alter table public.pago add constraint pago_devolucion_ck
      check (devuelto_at is null or coalesce(btrim(motivo_devolucion), '') <> '');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Saldo sin los cobros devueltos (mismas columnas y tipos que en la 0014)
-- ---------------------------------------------------------------------------
create or replace view public.v_pedido_saldo
with (security_invoker = true) as
select
  p.id,
  p.codigo,
  p.estado,
  (p.subtotal + p.costo_envio - p.descuento)::numeric(10,2) as total_cobrar,
  c.cobrado::numeric(10,2) as pagado,
  ((p.subtotal + p.costo_envio - p.descuento) - c.cobrado)::numeric(10,2) as saldo,
  case
    when c.cobrado = 0 then 'pendiente'
    when c.cobrado >= (p.subtotal + p.costo_envio - p.descuento) then 'pagado'
    else 'parcial'
  end as estado_pago
from public.pedido p
cross join lateral (
  select coalesce(sum(g.monto), 0) as cobrado
    from public.pago g
   where g.pedido_id = p.id
     and g.devuelto_at is null
) c;

-- ---------------------------------------------------------------------------
-- 3. devolver_cobro()
-- ---------------------------------------------------------------------------
create or replace function public.devolver_cobro(p_pago_id bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido   bigint;
  v_devuelto timestamptz;
begin
  perform public.exigir_permiso('pago.registrar');

  select pedido_id, devuelto_at into v_pedido, v_devuelto from public.pago where id = p_pago_id;
  if v_pedido is null then
    raise exception 'El cobro % no existe', p_pago_id using errcode = '22023';
  end if;
  perform public.exigir_permiso_pedido(v_pedido, 'editar');

  if v_devuelto is not null then
    return jsonb_build_object('pago_id', p_pago_id, 'devuelto', true, 'cambio', false);
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Escribí por qué se devuelve el cobro' using errcode = '22023';
  end if;

  update public.pago
     set devuelto_at = now(),
         devuelto_por = auth.uid(),
         motivo_devolucion = btrim(p_motivo)
   where id = p_pago_id;

  return (select jsonb_build_object('pago_id', p_pago_id, 'devuelto', true, 'cambio', true,
                                    'pedido', s.codigo, 'pagado', s.pagado, 'saldo', s.saldo,
                                    'estado_pago', s.estado_pago)
            from public.v_pedido_saldo s where s.id = v_pedido);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Ventas confirmadas: los cobros devueltos no cuentan como plata que entró
-- ---------------------------------------------------------------------------
create or replace function public.reporte_ventas_confirmadas(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde date;
  v_hasta date;
  v_res   jsonb;
begin
  perform public.exigir_permiso('contabilidad.ver');
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_fechas(p_desde, p_hasta) r;

  with conf as (
    select p.id, p.codigo, p.estado, p.canal, p.total, p.descuento, p.created_at,
           (p.created_at at time zone 'America/La_Paz')::date as dia,
           c.nombre as cliente, s.pagado, s.saldo, s.estado_pago
      from public.pedido p
      left join public.cliente c        on c.id = p.cliente_id
      join public.v_pedido_saldo s      on s.id = p.id
     where p.estado = any(public.estados_venta_confirmada())
       and (p.created_at at time zone 'America/La_Paz')::date between v_desde and v_hasta
  )
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'resumen', (select jsonb_build_object(
        'ventas',     count(*),
        'total',      coalesce(sum(total), 0),
        'cobrado',    coalesce(sum(pagado), 0),
        'por_cobrar', coalesce(sum(greatest(saldo, 0)), 0),
        'entregadas', count(*) filter (where estado = 'entregado'),
        'descuentos', coalesce(sum(descuento), 0)
      ) from conf),
    -- plata que efectivamente entró en el rango, por medio de pago
    'cobros_por_metodo', coalesce((select jsonb_agg(x order by x.total desc) from (
        select g.metodo, count(*) as pagos, sum(g.monto) as total
          from public.pago g
         where (g.fecha at time zone 'America/La_Paz')::date between v_desde and v_hasta
           and g.devuelto_at is null
         group by g.metodo) x), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select dia, count(*) as ventas, sum(total) as total from conf group by dia) x), '[]'::jsonb),
    'ventas', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select codigo, created_at, dia, cliente, estado, canal, total, pagado, saldo, estado_pago
          from conf order by created_at desc limit 500) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: solo con sesión (el candado de adentro decide)
-- ---------------------------------------------------------------------------
revoke all on function public.devolver_cobro(bigint, text) from public, anon;
grant execute on function public.devolver_cobro(bigint, text) to authenticated;
revoke all on function public.reporte_ventas_confirmadas(date, date) from public, anon;
grant execute on function public.reporte_ventas_confirmadas(date, date) to authenticated;
