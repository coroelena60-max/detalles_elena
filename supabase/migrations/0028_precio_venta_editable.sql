-- =============================================================================
-- 0028_precio_venta_editable.sql
--
-- En el mostrador el precio no siempre es el de lista: a veces se rebaja
-- ("te lo dejo en 60") y a veces sube porque el cliente pide algo que no está
-- en el sistema (un globo, un chocolate comprado afuera).
--
-- Hasta hoy no se podía: la venta de mostrador arma sus líneas con
-- crear_pedido(), que es LA MISMA función que usa el catálogo web anónimo y
-- que a propósito ignora cualquier monto que le manden (regla: los precios se
-- calculan en el servidor). Esa regla no se toca —el catálogo sigue igual—:
-- lo que se agrega es una puerta aparte, para el panel, que exige permiso.
--
-- Qué trae:
--   1. pedido_item.precio_lista: el precio que tenía la línea antes de la
--      rebaja, para que la rebaja quede a la vista y se pueda reportar.
--   2. aplicar_precio_item(): el motor (interno, sin acceso directo).
--   3. ajustar_item_venta(): cambiar el precio o los extras de una venta o un
--      pedido YA registrado. Pide el permiso según el canal y deja bitácora.
--   4. crear_venta_mostrador(): acepta por línea "precio_unitario" y
--      "extras_libres": [{"nombre": "Globo", "precio": 15}].
--   5. v_pedido_item_precio: la cuenta de cada línea (precio del ramo, extras
--      escritos a mano, rebaja) y "rebajas" en reporte_ventas().
--
-- Un extra escrito a mano NO descuenta inventario (no es un extra del
-- maestro: va sin extra_id, y registrar_salida_pedido() ya los ignora). Si lo
-- que se agrega existe en el sistema, conviene cargarlo desde "Armar un ramo"
-- para que el stock baje.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. El precio original de la línea
-- ---------------------------------------------------------------------------
alter table public.pedido_item add column if not exists precio_lista numeric(10,2);

do $$ begin
  alter table public.pedido_item add constraint pedido_item_precio_lista_ck check (precio_lista >= 0);
exception when duplicate_object then null; end $$;

comment on column public.pedido_item.precio_lista is
  'Precio que tenía la línea antes del primer ajuste manual. Vacío = nunca se tocó.';

-- ---------------------------------------------------------------------------
-- 2. El motor: cambiar el precio de una línea y sus extras escritos a mano
--
--    p_precio = lo que vale el ramo tal como está, SIN los extras escritos a
--    mano (esos se suman encima). Vacío = no se toca el precio.
--    p_extras = la lista final de extras escritos a mano de esa línea; la
--    reemplaza entera. Vacío = no se tocan.
--
--    No revisa permisos: es interna. Quien la llama (ajustar_item_venta y
--    crear_venta_mostrador) ya los revisó.
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_precio_item(
  p_item_id bigint,
  p_precio  numeric default null,
  p_extras  jsonb   default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   record;
  v_base   numeric(10,2);
  v_libres numeric(10,2);
  v_e      jsonb;
  v_nombre text;
  v_monto  numeric(10,2);
begin
  select i.id, i.precio_unitario into v_item
    from public.pedido_item i where i.id = p_item_id;
  if v_item.id is null then
    raise exception 'La línea % no existe', p_item_id using errcode = '22023';
  end if;

  -- lo que vale el ramo hoy = precio de la línea menos lo escrito a mano
  select coalesce(sum(subtotal), 0) into v_libres
    from public.pedido_item_extra
   where pedido_item_id = p_item_id and extra_id is null;
  v_base := v_item.precio_unitario - v_libres;

  if p_precio is not null then
    if p_precio < 0 or p_precio > 100000 then
      raise exception 'El precio tiene que estar entre 0 y 100000' using errcode = '22023';
    end if;
    v_base := round(p_precio, 2);
  end if;

  if p_extras is not null then
    if jsonb_typeof(p_extras) <> 'array' then
      raise exception 'Los extras tienen que venir en una lista' using errcode = '22023';
    end if;
    if jsonb_array_length(p_extras) > 10 then
      raise exception 'Son demasiados extras para una sola línea' using errcode = '22023';
    end if;

    delete from public.pedido_item_extra
     where pedido_item_id = p_item_id and extra_id is null;

    for v_e in select * from jsonb_array_elements(p_extras)
    loop
      v_nombre := btrim(coalesce(v_e->>'nombre', ''));
      v_monto  := round(coalesce((v_e->>'precio')::numeric, 0), 2);
      if length(v_nombre) < 2 or length(v_nombre) > 80 then
        raise exception 'Escribí qué es el extra (entre 2 y 80 letras)' using errcode = '22023';
      end if;
      if v_monto < 0 or v_monto > 100000 then
        raise exception 'El precio del extra tiene que estar entre 0 y 100000' using errcode = '22023';
      end if;
      insert into public.pedido_item_extra
        (pedido_item_id, extra_id, nombre, cantidad, precio_unitario, subtotal)
      values (p_item_id, null, v_nombre, 1, v_monto, v_monto);
    end loop;
  end if;

  select coalesce(sum(subtotal), 0) into v_libres
    from public.pedido_item_extra
   where pedido_item_id = p_item_id and extra_id is null;

  -- precio_lista guarda el precio de antes del primer ajuste y no se pisa
  update public.pedido_item
     set precio_lista    = coalesce(precio_lista, precio_unitario),
         precio_unitario = v_base + v_libres,
         subtotal        = (v_base + v_libres) * cantidad
   where id = p_item_id;
end;
$$;

revoke all on function public.aplicar_precio_item(bigint, numeric, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ajustar una venta o un pedido ya registrado
-- ---------------------------------------------------------------------------
create or replace function public.ajustar_item_venta(
  p_item_id bigint,
  p_precio  numeric default null,
  p_extras  jsonb   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido  bigint;
  v_estado  estado_pedido;
  v_antes   jsonb;
  v_despues jsonb;
begin
  select i.pedido_id, p.estado into v_pedido, v_estado
    from public.pedido_item i
    join public.pedido p on p.id = i.pedido_id
   where i.id = p_item_id;
  if v_pedido is null then
    raise exception 'La línea % no existe', p_item_id using errcode = '22023';
  end if;

  -- el permiso sale del canal: venta.editar en mostrador, pedido.editar si no
  perform public.exigir_permiso_pedido(v_pedido, 'editar');

  if v_estado = 'entregado' then
    raise exception 'Ya se entregó: no se puede cambiar el precio' using errcode = '22023';
  elsif v_estado = 'cancelado' then
    raise exception 'Está cancelado: no se puede cambiar el precio' using errcode = '22023';
  end if;

  select to_jsonb(i) - 'created_at' - 'updated_at' into v_antes
    from public.pedido_item i where i.id = p_item_id;

  perform public.aplicar_precio_item(p_item_id, p_precio, p_extras);
  perform public.recalcular_pedido(v_pedido);

  select to_jsonb(i) - 'created_at' - 'updated_at' into v_despues
    from public.pedido_item i where i.id = p_item_id;

  insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_antes, datos_despues)
  values (auth.uid(), 'ajuste_precio', 'pedido_item', p_item_id::text, v_antes, v_despues);

  return (select jsonb_build_object('pedido_id', id, 'codigo', codigo,
                                    'subtotal', subtotal, 'total', total)
            from public.pedido where id = v_pedido);
end;
$$;

revoke all on function public.ajustar_item_venta(bigint, numeric, jsonb) from public, anon;
grant execute on function public.ajustar_item_venta(bigint, numeric, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. La cuenta de cada línea: precio del ramo, extras a mano y rebaja
-- ---------------------------------------------------------------------------
create or replace view public.v_pedido_item_precio
with (security_invoker = true) as
select
  q.*,
  (q.rebaja_unit * q.cantidad)::numeric(12,2) as rebaja_total
from (
  select
    i.id        as pedido_item_id,
    i.pedido_id,
    i.cantidad,
    i.nombre,
    i.precio_unitario,
    i.precio_lista,
    coalesce(l.monto, 0)::numeric(10,2)                       as extras_libres,
    (i.precio_unitario - coalesce(l.monto, 0))::numeric(10,2) as precio_ramo,
    greatest(coalesce(i.precio_lista, i.precio_unitario)
             - (i.precio_unitario - coalesce(l.monto, 0)), 0)::numeric(10,2) as rebaja_unit
  from public.pedido_item i
  left join lateral (
    select sum(ie.subtotal) as monto
      from public.pedido_item_extra ie
     where ie.pedido_item_id = i.id and ie.extra_id is null
  ) l on true
) q;

comment on view public.v_pedido_item_precio is
  'Por línea: cuánto es el ramo, cuánto los extras escritos a mano y cuánto se rebajó.';

revoke all on public.v_pedido_item_precio from public, anon;
grant select on public.v_pedido_item_precio to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Venta de mostrador con precio y extras escritos a mano
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
declare
  v_normales jsonb;
  v_cots     jsonb;
  v_res      jsonb;
  v_pedido   bigint;
  v_cliente  bigint;
  v_it       jsonb;
  v_c        public.v_cotizacion%rowtype;
  v_cant     integer;
  v_item_id  bigint;
  v_nombre   text;
  v_tel      text;
  v_li       record;
  v_idx      integer;
begin
  perform public.exigir_permiso('venta.editar');

  if p_cliente is null
     or jsonb_typeof(p_cliente) <> 'object'
     or coalesce((p_cliente->>'sin_cliente')::boolean, false) then
    p_cliente := jsonb_build_object('nombre', 'S/N', 'telefono', public.telefono_sin_cliente());
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items' using errcode = '22023';
  end if;

  -- el orden importa: después se emparejan las líneas creadas con su ajuste
  select coalesce(jsonb_agg(t.i order by t.ord) filter (where t.i->>'tipo' <> 'cotizacion'), '[]'),
         coalesce(jsonb_agg(t.i order by t.ord) filter (where t.i->>'tipo' = 'cotizacion'), '[]')
    into v_normales, v_cots
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  if jsonb_array_length(v_normales) > 0 then
    v_res := public.crear_pedido(p_cliente, v_normales, '{"tipo":"recojo_tienda"}'::jsonb, p_nota);
    v_pedido := (v_res->>'id')::bigint;

    -- crear_pedido() siempre cobra el precio de lista (es la misma función del
    -- catálogo anónimo). Acá, ya con el permiso revisado, se ajusta lo que la
    -- vendedora haya cambiado, línea por línea y en el mismo orden.
    v_idx := 0;
    for v_li in
      select id, tipo, producto_id, extra_id, envoltorio_id
        from public.pedido_item
       where pedido_id = v_pedido
       order by id
    loop
      v_it := v_normales->v_idx;
      exit when v_it is null;

      -- candado: si el orden no coincide, no se ajusta ninguna línea a ciegas
      if v_li.tipo::text <> coalesce(v_it->>'tipo', '')
         or v_li.producto_id   is distinct from nullif(v_it->>'producto_id', '')::bigint
         or v_li.extra_id      is distinct from nullif(v_it->>'extra_id', '')::bigint
         or v_li.envoltorio_id is distinct from nullif(v_it->>'envoltorio_id', '')::bigint then
        raise exception 'No se pudo aplicar el precio a la línea %', v_idx + 1 using errcode = '22023';
      end if;

      if (v_it ? 'precio_unitario') or (v_it ? 'extras_libres') then
        perform public.aplicar_precio_item(
          v_li.id,
          nullif(v_it->>'precio_unitario', '')::numeric,
          case when v_it ? 'extras_libres' then v_it->'extras_libres' end);
      end if;

      v_idx := v_idx + 1;
    end loop;
  else
    -- solo cotizaciones: mismo alta de cliente que crear_pedido()
    v_nombre := btrim(coalesce(p_cliente->>'nombre', ''));
    v_tel    := public.normalizar_telefono(p_cliente->>'telefono');
    if length(v_nombre) < 2 then
      raise exception 'El nombre del cliente es obligatorio' using errcode = '22023';
    end if;
    if v_tel is null or v_tel !~ '^[0-9]{7,15}$' then
      raise exception 'Teléfono inválido' using errcode = '22023';
    end if;
    insert into public.cliente (nombre, telefono, email)
    values (v_nombre, v_tel, nullif(btrim(coalesce(p_cliente->>'email', '')), ''))
    on conflict (telefono) do update
       set nombre = excluded.nombre,
           email  = coalesce(excluded.email, public.cliente.email)
    returning id into v_cliente;

    insert into public.pedido (cliente_id, estado, tipo_entrega, nota_cliente, canal)
    values (v_cliente, 'nuevo', 'recojo_tienda', nullif(btrim(coalesce(p_nota, '')), ''), 'mostrador')
    returning id into v_pedido;
  end if;

  for v_it in select * from jsonb_array_elements(v_cots)
  loop
    select * into v_c from public.v_cotizacion where id = (v_it->>'cotizacion_id')::bigint;
    if v_c.id is null then
      raise exception 'Cotización no encontrada: %', v_it->>'cotizacion_id' using errcode = '22023';
    end if;
    v_cant := coalesce((v_it->>'cantidad')::integer, 1);
    if v_cant < 1 or v_cant > 99 then
      raise exception 'Cantidad fuera de rango' using errcode = '22023';
    end if;

    insert into public.pedido_item
      (pedido_id, tipo, nombre, precio_unitario, cantidad, subtotal, dedicatoria, nota, cotizacion_id)
    values
      (v_pedido, 'personalizado', v_c.nombre, v_c.precio, v_cant, v_c.precio * v_cant,
       nullif(btrim(coalesce(v_it->>'dedicatoria', '')), ''), 'Según ' || v_c.codigo, v_c.id)
    returning id into v_item_id;

    -- los extras van a Bs 0 (ya están dentro del precio): sirven para que la
    -- entrega descuente su stock
    insert into public.pedido_item_extra (pedido_item_id, extra_id, nombre, cantidad, precio_unitario, subtotal)
    select v_item_id, e.extra_id, e.nombre, e.cantidad, 0, 0
      from public.cotizacion_extra e
     where e.cotizacion_id = v_c.id and e.extra_id is not null;

    -- una cotización también se puede rebajar o sumarle algo escrito a mano
    if (v_it ? 'precio_unitario') or (v_it ? 'extras_libres') then
      perform public.aplicar_precio_item(
        v_item_id,
        nullif(v_it->>'precio_unitario', '')::numeric,
        case when v_it ? 'extras_libres' then v_it->'extras_libres' end);
    end if;
  end loop;

  perform public.recalcular_pedido(v_pedido);

  update public.pedido
     set canal        = 'mostrador',
         estado       = 'confirmado',
         atendido_por = auth.uid()
   where id = v_pedido;

  return (select jsonb_build_object('id', id, 'codigo', codigo, 'subtotal', subtotal,
                                    'total', total, 'estado', estado)
            from public.pedido where id = v_pedido);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reporte de ventas: cuánto se rebajó en el período
-- ---------------------------------------------------------------------------
create or replace function public.reporte_ventas(p_desde date, p_hasta date)
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
  perform public.exigir_permiso('reporte.ver');
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_fechas(p_desde, p_hasta) r;

  with ped as (
    select p.*, (p.created_at at time zone 'America/La_Paz')::date as dia,
           (p.estado = any(public.estados_venta_confirmada())) as confirmada
      from public.pedido p
     where (p.created_at at time zone 'America/La_Paz')::date between v_desde and v_hasta
  ),
  conf as (select * from ped where confirmada)
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'resumen', (select jsonb_build_object(
        'pedidos',            count(*),
        'confirmados',        count(*) filter (where confirmada),
        'sin_confirmar',      count(*) filter (where estado in ('nuevo','enviado_whatsapp')),
        'cancelados',         count(*) filter (where estado = 'cancelado'),
        'vendido',            coalesce(sum(total) filter (where confirmada), 0),
        'descuentos',         coalesce(sum(descuento) filter (where confirmada), 0),
        'rebajas',            coalesce((select sum(v.rebaja_total)
                                          from public.v_pedido_item_precio v
                                          join conf on conf.id = v.pedido_id), 0),
        'ticket_promedio',    coalesce(round(avg(total) filter (where confirmada), 2), 0),
        'conversion_pct',     case when count(*) > 0
                                   then round(count(*) filter (where confirmada) * 100.0 / count(*), 1)
                                   else 0 end
      ) from ped),
    'por_dia', coalesce((select jsonb_agg(d order by d.dia) from (
        select dia, count(*) as pedidos, sum(total) as total
          from conf group by dia) d), '[]'::jsonb),
    'por_canal', coalesce((select jsonb_agg(c order by c.total desc) from (
        select canal, count(*) as pedidos, sum(total) as total
          from conf group by canal) c), '[]'::jsonb),
    'por_estado', coalesce((select jsonb_agg(e) from (
        select estado, count(*) as pedidos, sum(total) as total
          from ped group by estado) e), '[]'::jsonb),
    'productos', coalesce((select jsonb_agg(x order by x.vendido desc) from (
        select coalesce(pr.nombre, i.nombre) as nombre,
               sum(i.cantidad) as unidades, sum(i.subtotal) as vendido
          from public.pedido_item i
          join conf on conf.id = i.pedido_id
          left join public.producto pr on pr.id = i.producto_id
         where i.tipo = 'producto'
         group by coalesce(pr.nombre, i.nombre)
         order by vendido desc limit 15) x), '[]'::jsonb),
    'personalizados', (select jsonb_build_object(
        'unidades', coalesce(sum(i.cantidad), 0),
        'vendido',  coalesce(sum(i.subtotal), 0))
          from public.pedido_item i join conf on conf.id = i.pedido_id
         where i.tipo = 'personalizado'),
    'extras', coalesce((select jsonb_agg(x order by x.unidades desc) from (
        select nombre, sum(unidades) as unidades, sum(vendido) as vendido from (
          select i.nombre, i.cantidad::numeric as unidades, i.subtotal as vendido
            from public.pedido_item i join conf on conf.id = i.pedido_id
           where i.tipo = 'extra'
          union all
          select ie.nombre, ie.cantidad * i.cantidad, ie.subtotal * i.cantidad
            from public.pedido_item_extra ie
            join public.pedido_item i on i.id = ie.pedido_item_id
            join conf on conf.id = i.pedido_id
        ) t group by nombre order by unidades desc limit 15) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;
