-- =============================================================================
-- 0024 · Pedidos con permiso propio, agenda de entregas y respaldo
--
-- 1. Pedido (catálogo web) y venta (mostrador) viven en la misma tabla, pero
--    ahora cada uno tiene su permiso: pedido.ver/editar para lo que entra por el
--    catálogo, venta.ver/editar para el mostrador. Así un vendedor de tienda
--    puede no ver los pedidos web y al revés. Lo decide RLS, no la pantalla.
--    Al crearse los permisos, los roles que ya veían ventas los reciben (nadie
--    pierde acceso); después se pueden quitar desde Roles.
-- 2. Agenda: pedido.fecha_compromiso (el día que hay que tenerlo listo) y la
--    vista v_agenda con los minutos de taller estimados por pedido.
-- 3. respaldo.descargar: bajar una copia de los datos desde el panel.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Permisos
-- ---------------------------------------------------------------------------
do $$
declare v_nuevos boolean := not exists (select 1 from public.permiso where codigo = 'pedido.ver');
begin
  insert into public.permiso (codigo, modulo, descripcion) values
    ('pedido.ver',         'pedido',         'Ver los pedidos del catálogo web'),
    ('pedido.editar',      'pedido',         'Atender pedidos del catálogo: estados, entrega y agenda'),
    ('respaldo.descargar', 'administracion', 'Descargar un respaldo de los datos')
  on conflict (codigo) do update
    set modulo = excluded.modulo, descripcion = excluded.descripcion;

  -- solo la primera vez: quien ya veía/atendía ventas sigue viendo/atendiendo pedidos
  if v_nuevos then
    insert into public.rol_permiso (rol_id, permiso_id)
    select rp.rol_id, np.id
      from public.rol_permiso rp
      join public.permiso vp on vp.id = rp.permiso_id
      join public.permiso np on np.codigo = case vp.codigo when 'venta.ver'    then 'pedido.ver'
                                                          when 'venta.editar' then 'pedido.editar' end
     where vp.codigo in ('venta.ver', 'venta.editar')
    on conflict do nothing;
  end if;
end $$;

select public.sincronizar_permisos_admin();

/** ¿Qué permiso pide este pedido? mostrador → venta.*, lo demás → pedido.* */
create or replace function public.permiso_de_pedido(p_canal text, p_accion text)
returns text
language sql
immutable
as $$
  select case when p_canal = 'mostrador' then 'venta.' else 'pedido.' end || p_accion;
$$;

create or replace function public.puede_pedido(p_pedido_id bigint, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select public.tiene_permiso(public.permiso_de_pedido(p.canal, p_accion))
                     from public.pedido p where p.id = p_pedido_id), false);
$$;

create or replace function public.exigir_permiso_pedido(p_pedido_id bigint, p_accion text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_canal text;
begin
  select canal into v_canal from public.pedido where id = p_pedido_id;
  if v_canal is null then
    raise exception 'El pedido % no existe', p_pedido_id using errcode = '22023';
  end if;
  perform public.exigir_permiso(public.permiso_de_pedido(v_canal, p_accion));
end;
$$;

-- RLS: pedido por canal; sus hijas siguen al pedido ---------------------------
drop policy if exists pedido_panel_lectura on public.pedido;
create policy pedido_panel_lectura on public.pedido
  for select to authenticated
  using (public.tiene_permiso(public.permiso_de_pedido(canal, 'ver')));

drop policy if exists pedido_panel_escritura on public.pedido;
create policy pedido_panel_escritura on public.pedido
  for all to authenticated
  using (public.tiene_permiso(public.permiso_de_pedido(canal, 'editar')))
  with check (public.tiene_permiso(public.permiso_de_pedido(canal, 'editar')));

do $$
declare t text;
begin
  foreach t in array array['pedido_item', 'entrega']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_panel_lectura', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (public.puede_pedido(pedido_id, ''ver''))', t || '_panel_lectura', t);
    execute format('drop policy if exists %I on public.%I', t || '_panel_escritura', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (public.puede_pedido(pedido_id, ''editar''))
                    with check (public.puede_pedido(pedido_id, ''editar''))', t || '_panel_escritura', t);
  end loop;
end $$;

drop policy if exists pedido_item_extra_panel_lectura on public.pedido_item_extra;
create policy pedido_item_extra_panel_lectura on public.pedido_item_extra
  for select to authenticated
  using (exists (select 1 from public.pedido_item i
                  where i.id = pedido_item_id and public.puede_pedido(i.pedido_id, 'ver')));

drop policy if exists pedido_item_extra_panel_escritura on public.pedido_item_extra;
create policy pedido_item_extra_panel_escritura on public.pedido_item_extra
  for all to authenticated
  using (exists (select 1 from public.pedido_item i
                  where i.id = pedido_item_id and public.puede_pedido(i.pedido_id, 'editar')))
  with check (exists (select 1 from public.pedido_item i
                       where i.id = pedido_item_id and public.puede_pedido(i.pedido_id, 'editar')));

drop policy if exists pago_panel_lectura on public.pago;
create policy pago_panel_lectura on public.pago
  for select to authenticated
  using (public.puede_pedido(pedido_id, 'ver'));

drop policy if exists pago_panel_escritura on public.pago;
create policy pago_panel_escritura on public.pago
  for all to authenticated
  using (public.tiene_permiso('pago.registrar') and public.puede_pedido(pedido_id, 'ver'))
  with check (public.tiene_permiso('pago.registrar') and public.puede_pedido(pedido_id, 'ver'));

-- RPC con el candado según el canal ------------------------------------------
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
  perform public.exigir_permiso_pedido(p_pedido_id, 'editar');

  select estado into v_anterior from public.pedido where id = p_pedido_id;
  if v_anterior = 'entregado' and p_estado <> 'entregado' then
    raise exception 'El pedido ya se entregó y descontó el inventario: no vuelve atrás'
      using errcode = '22023';
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

create or replace function public.registrar_salida_pedido(p_pedido_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   record;
  v_ex     record;
  v_lineas integer := 0;
begin
  perform public.exigir_permiso_pedido(p_pedido_id, 'editar');

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
  perform public.exigir_permiso('pago.registrar');
  perform public.exigir_permiso_pedido(p_pedido_id, 'ver');

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero' using errcode = '22023';
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
-- 2. Agenda de entregas
-- ---------------------------------------------------------------------------
alter table public.pedido add column if not exists fecha_compromiso date;
create index if not exists pedido_compromiso_idx on public.pedido (fecha_compromiso);

-- lo que el cliente pidió en el catálogo pasa a ser el compromiso
update public.pedido p
   set fecha_compromiso = e.fecha_entrega
  from public.entrega e
 where e.pedido_id = p.id and e.fecha_entrega is not null and p.fecha_compromiso is null;

create or replace function public.tg_entrega_compromiso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fecha_entrega is not null then
    update public.pedido set fecha_compromiso = new.fecha_entrega
     where id = new.pedido_id and fecha_compromiso is distinct from new.fecha_entrega;
  end if;
  return new;
end;
$$;

drop trigger if exists entrega_compromiso on public.entrega;
create trigger entrega_compromiso after insert or update of fecha_entrega on public.entrega
  for each row execute function public.tg_entrega_compromiso();

/** Mover un pedido de día (o sacarlo de la agenda con null). */
create or replace function public.programar_pedido(p_pedido_id bigint, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_permiso_pedido(p_pedido_id, 'editar');

  update public.pedido set fecha_compromiso = p_fecha where id = p_pedido_id;
  update public.entrega set fecha_entrega = p_fecha
   where pedido_id = p_pedido_id and fecha_entrega is distinct from p_fecha;

  return jsonb_build_object('pedido_id', p_pedido_id, 'fecha', p_fecha);
end;
$$;

/**
 * Minutos de taller por pedido: producto → sus minutos; extra suelto → los
 * del extra; ramo armado → envoltorio + extras; cotización → sus minutos.
 * Lo que no tiene minutos cargados cuenta 0 (se avisa en pantalla).
 */
create or replace view public.v_agenda
with (security_invoker = true) as
select
  p.id,
  p.codigo,
  p.canal,
  p.estado,
  p.tipo_entrega,
  p.fecha_compromiso,
  p.total,
  p.created_at,
  c.nombre   as cliente,
  c.telefono as telefono,
  e.franja_horaria,
  e.direccion,
  coalesce((
    select sum(i.cantidad * (
             case
               when i.tipo = 'producto' then coalesce(pr.minutos_armado, 0)
               when i.tipo = 'extra'    then coalesce(ex.minutos_armado, 0)
               when i.cotizacion_id is not null then coalesce(co.minutos, 0)
               else coalesce(en.minutos_armado, 0)
                    + coalesce((select sum(ie.cantidad * coalesce(x.minutos_armado, 0))
                                  from public.pedido_item_extra ie
                                  join public.extra x on x.id = ie.extra_id
                                 where ie.pedido_item_id = i.id), 0)
             end))
      from public.pedido_item i
      left join public.producto   pr on pr.id = i.producto_id
      left join public.extra      ex on ex.id = i.extra_id
      left join public.envoltorio en on en.id = i.envoltorio_id
      left join public.cotizacion co on co.id = i.cotizacion_id
     where i.pedido_id = p.id), 0)::numeric(10,0) as minutos,
  (select string_agg(i.cantidad || '× ' || i.nombre, ', ' order by i.id)
     from public.pedido_item i where i.pedido_id = p.id) as resumen
from public.pedido p
left join public.cliente c on c.id = p.cliente_id
left join public.entrega e on e.pedido_id = p.id
where p.estado <> 'cancelado';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.v_agenda from anon;
grant select on public.v_agenda to authenticated;

revoke all on function public.puede_pedido(bigint, text) from public, anon;
revoke all on function public.exigir_permiso_pedido(bigint, text) from public, anon;
revoke all on function public.programar_pedido(bigint, date) from public, anon;
grant execute on function public.puede_pedido(bigint, text) to authenticated;
grant execute on function public.exigir_permiso_pedido(bigint, text) to authenticated;
grant execute on function public.programar_pedido(bigint, date) to authenticated;
