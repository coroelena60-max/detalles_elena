-- =============================================================================
-- 0023 · Cotización: la calculadora de precios de la tienda
--
-- Una cotización junta todo lo que lleva un producto nuevo y saca su costo:
--   materiales  "compré 5 cartones a Bs 87 y usé 2"      -> 87/5 × 2
--   extras      del sistema (rosa, peluche) a su costo por receta, editable
--   mano de obra minutos de armado × costo de la hora
--   otros       % sobre lo anterior (silicona, luz, desgaste) + monto fijo
-- y sugiere el precio con un margen, redondeado a múltiplo de 5.
--
-- Después se puede convertir en producto (borrador, con su receta) o venderse
-- directo en el mostrador como una línea con ese precio.
--
-- Las líneas se escriben solo por guardar_cotizacion() (reemplaza todo junto),
-- así la cotización nunca queda a medio guardar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
insert into public.permiso (codigo, modulo, descripcion) values
  ('cotizacion.ver',    'cotizacion', 'Ver cotizaciones y sus costos'),
  ('cotizacion.editar', 'cotizacion', 'Crear, editar y borrar cotizaciones')
on conflict (codigo) do update
  set modulo = excluded.modulo, descripcion = excluded.descripcion;

select public.sincronizar_permisos_admin();

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.cotizacion (
  id           bigint generated always as identity primary key,
  codigo       text generated always as ('COT-' || lpad(id::text, 5, '0')) stored,
  nombre       text          not null,
  descripcion  text,
  minutos      integer       not null default 0,
  costo_hora   numeric(10,2) not null default 20,
  otros_pct    numeric(6,2)  not null default 0,
  otros_monto  numeric(10,2) not null default 0,
  margen_pct   numeric(6,2)  not null default 60,
  -- el precio que ella decide; null = usar el sugerido
  precio_final numeric(10,2),
  producto_id  bigint        references public.producto (id) on delete set null,
  creado_por   uuid          references public.perfil (id) on delete set null,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  constraint cotizacion_codigo_uk    unique (codigo),
  constraint cotizacion_nombre_ck    check (length(btrim(nombre)) > 0),
  constraint cotizacion_minutos_ck   check (minutos between 0 and 10000),
  constraint cotizacion_hora_ck      check (costo_hora >= 0),
  constraint cotizacion_otros_ck     check (otros_pct between 0 and 100 and otros_monto >= 0),
  constraint cotizacion_margen_ck    check (margen_pct between 0 and 1000),
  constraint cotizacion_precio_ck    check (precio_final is null or precio_final >= 0)
);
create index if not exists cotizacion_fecha_idx on public.cotizacion (updated_at desc);

create table if not exists public.cotizacion_material (
  id              bigint generated always as identity primary key,
  cotizacion_id   bigint        not null references public.cotizacion (id) on delete cascade,
  insumo_id       bigint        references public.insumo (id) on delete set null,
  nombre          text          not null,
  unidad          unidad_medida not null default 'unidad',
  -- "compré 1 docena": cantidad_compra = 1, factor = 12 (en unidades de uso)
  cantidad_compra numeric(12,3) not null,
  factor          numeric(12,3) not null default 1,
  precio_compra   numeric(10,2) not null,
  cantidad_usada  numeric(12,3) not null,
  orden           integer       not null default 0,
  constraint cotizacion_material_nombre_ck check (length(btrim(nombre)) > 0),
  constraint cotizacion_material_cant_ck   check (cantidad_compra > 0 and factor > 0),
  constraint cotizacion_material_precio_ck check (precio_compra >= 0),
  constraint cotizacion_material_uso_ck    check (cantidad_usada >= 0)
);
create index if not exists cotizacion_material_idx on public.cotizacion_material (cotizacion_id);

create table if not exists public.cotizacion_extra (
  id             bigint generated always as identity primary key,
  cotizacion_id  bigint        not null references public.cotizacion (id) on delete cascade,
  extra_id       bigint        references public.extra (id) on delete set null,
  nombre         text          not null,
  cantidad       numeric(8,2)  not null,
  costo_unitario numeric(10,2) not null default 0,
  orden          integer       not null default 0,
  constraint cotizacion_extra_cant_ck  check (cantidad > 0),
  constraint cotizacion_extra_costo_ck check (costo_unitario >= 0)
);
create index if not exists cotizacion_extra_idx on public.cotizacion_extra (cotizacion_id);

-- de qué cotización salió una línea vendida
alter table public.pedido_item
  add column if not exists cotizacion_id bigint references public.cotizacion (id) on delete set null;

drop trigger if exists set_updated_at on public.cotizacion;
create trigger set_updated_at before update on public.cotizacion
  for each row execute function public.tg_set_updated_at();

drop trigger if exists auditar on public.cotizacion;
create trigger auditar after insert or update or delete on public.cotizacion
  for each row execute function public.tg_bitacora();

-- ---------------------------------------------------------------------------
-- La cuenta: una sola vista, así pantalla, producto y venta dan lo mismo
-- ---------------------------------------------------------------------------
create or replace view public.v_cotizacion
with (security_invoker = true) as
with base as (
  select
    c.*,
    coalesce((select sum(round(m.precio_compra / (m.cantidad_compra * m.factor) * m.cantidad_usada, 2))
                from public.cotizacion_material m where m.cotizacion_id = c.id), 0) as costo_materiales,
    coalesce((select sum(round(e.costo_unitario * e.cantidad, 2))
                from public.cotizacion_extra e where e.cotizacion_id = c.id), 0)    as costo_extras,
    round(c.minutos / 60.0 * c.costo_hora, 2)                                        as costo_mano_obra,
    (select count(*) from public.cotizacion_material m where m.cotizacion_id = c.id) as materiales,
    (select count(*) from public.cotizacion_extra e where e.cotizacion_id = c.id)    as extras
  from public.cotizacion c
), sub as (
  select b.*,
         round((b.costo_materiales + b.costo_extras + b.costo_mano_obra) * b.otros_pct / 100
               + b.otros_monto, 2) as costo_otros
    from base b
), tot as (
  select s.*,
         (s.costo_materiales + s.costo_extras + s.costo_mano_obra + s.costo_otros)::numeric(12,2) as costo_total
    from sub s
)
select
  t.id, t.codigo, t.nombre, t.descripcion, t.minutos, t.costo_hora, t.otros_pct, t.otros_monto,
  t.margen_pct, t.precio_final, t.producto_id, t.creado_por, t.created_at, t.updated_at,
  t.materiales, t.extras,
  t.costo_materiales::numeric(12,2), t.costo_extras::numeric(12,2),
  t.costo_mano_obra::numeric(12,2), t.costo_otros::numeric(12,2), t.costo_total,
  public.redondear_a_5(t.costo_total * (1 + t.margen_pct / 100))::numeric(12,2)        as precio_sugerido,
  coalesce(t.precio_final, public.redondear_a_5(t.costo_total * (1 + t.margen_pct / 100)))::numeric(12,2) as precio,
  (coalesce(t.precio_final, public.redondear_a_5(t.costo_total * (1 + t.margen_pct / 100)))
     - t.costo_total)::numeric(12,2)                                                   as ganancia
from tot t;

-- ---------------------------------------------------------------------------
-- Guardar (crea o reemplaza cabecera + líneas en una sola transacción)
-- ---------------------------------------------------------------------------
create or replace function public.guardar_cotizacion(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      bigint := nullif(p->>'id', '')::bigint;
  v_m       jsonb;
  v_e       jsonb;
  v_insumo  bigint;
  v_orden   integer := 0;
  v_nombre  text;
  v_unidad  unidad_medida;
  v_slug    text;
  v_n       integer;
begin
  perform public.exigir_permiso('cotizacion.editar');

  if length(btrim(coalesce(p->>'nombre', ''))) = 0 then
    raise exception 'Poné un nombre a la cotización' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p->'materiales', '[]')) > 100
     or jsonb_array_length(coalesce(p->'extras', '[]')) > 100 then
    raise exception 'Demasiadas líneas en la cotización' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.cotizacion (nombre, descripcion, minutos, costo_hora, otros_pct, otros_monto,
                                   margen_pct, precio_final, creado_por)
    values (btrim(p->>'nombre'), nullif(btrim(coalesce(p->>'descripcion', '')), ''),
            coalesce((p->>'minutos')::integer, 0),
            coalesce((p->>'costo_hora')::numeric, public.parametro_valor('costo_hora_mano_obra', 20)),
            coalesce((p->>'otros_pct')::numeric, 0), coalesce((p->>'otros_monto')::numeric, 0),
            coalesce((p->>'margen_pct')::numeric, public.parametro_valor('margen_objetivo_pct', 60)),
            nullif(p->>'precio_final', '')::numeric, auth.uid())
    returning id into v_id;
  else
    update public.cotizacion
       set nombre       = btrim(p->>'nombre'),
           descripcion  = nullif(btrim(coalesce(p->>'descripcion', '')), ''),
           minutos      = coalesce((p->>'minutos')::integer, 0),
           costo_hora   = coalesce((p->>'costo_hora')::numeric, costo_hora),
           otros_pct    = coalesce((p->>'otros_pct')::numeric, 0),
           otros_monto  = coalesce((p->>'otros_monto')::numeric, 0),
           margen_pct   = coalesce((p->>'margen_pct')::numeric, margen_pct),
           precio_final = nullif(p->>'precio_final', '')::numeric
     where id = v_id;
    if not found then
      raise exception 'La cotización % no existe', v_id using errcode = '22023';
    end if;
    delete from public.cotizacion_material where cotizacion_id = v_id;
    delete from public.cotizacion_extra    where cotizacion_id = v_id;
  end if;

  -- materiales ---------------------------------------------------------------
  for v_m in select * from jsonb_array_elements(coalesce(p->'materiales', '[]'))
  loop
    v_orden  := v_orden + 1;
    v_nombre := btrim(coalesce(v_m->>'nombre', ''));
    v_insumo := nullif(v_m->>'insumo_id', '')::bigint;
    v_unidad := coalesce(nullif(v_m->>'unidad', ''), 'unidad')::unidad_medida;

    -- "guardar como insumo": queda en Compras → Insumos para la próxima
    if v_insumo is null and coalesce((v_m->>'crear_insumo')::boolean, false) and v_nombre <> '' then
      perform public.exigir_permiso('insumo.editar');
      select id into v_insumo from public.insumo where lower(nombre) = lower(v_nombre);
      if v_insumo is null then
        v_slug := public.slugify(v_nombre);
        v_n := 1;
        while exists (select 1 from public.insumo where slug = v_slug) loop
          v_n := v_n + 1;
          v_slug := public.slugify(v_nombre) || '-' || v_n;
        end loop;
        insert into public.insumo (nombre, slug, unidad, costo_unitario)
        values (v_nombre, v_slug, v_unidad,
                round((v_m->>'precio_compra')::numeric
                      / nullif((v_m->>'cantidad_compra')::numeric * coalesce((v_m->>'factor')::numeric, 1), 0), 4))
        returning id into v_insumo;
      end if;
    end if;

    insert into public.cotizacion_material
      (cotizacion_id, insumo_id, nombre, unidad, cantidad_compra, factor, precio_compra, cantidad_usada, orden)
    values
      (v_id, v_insumo, v_nombre, v_unidad,
       (v_m->>'cantidad_compra')::numeric, coalesce((v_m->>'factor')::numeric, 1),
       coalesce((v_m->>'precio_compra')::numeric, 0), coalesce((v_m->>'cantidad_usada')::numeric, 0),
       v_orden);
  end loop;

  -- extras del sistema -------------------------------------------------------
  v_orden := 0;
  for v_e in select * from jsonb_array_elements(coalesce(p->'extras', '[]'))
  loop
    v_orden := v_orden + 1;
    select nombre into v_nombre from public.extra where id = (v_e->>'extra_id')::bigint;
    if v_nombre is null then
      raise exception 'Extra no encontrado: %', v_e->>'extra_id' using errcode = '22023';
    end if;
    insert into public.cotizacion_extra (cotizacion_id, extra_id, nombre, cantidad, costo_unitario, orden)
    values (v_id, (v_e->>'extra_id')::bigint, v_nombre,
            (v_e->>'cantidad')::numeric, coalesce((v_e->>'costo_unitario')::numeric, 0), v_orden);
  end loop;

  return (select to_jsonb(v) from public.v_cotizacion v where v.id = v_id);
end;
$$;

create or replace function public.borrar_cotizacion(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_permiso('cotizacion.editar');
  delete from public.cotizacion where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convertir en producto: borrador con precio, minutos y receta
-- ---------------------------------------------------------------------------
create or replace function public.convertir_cotizacion_en_producto(p_id bigint, p_categoria_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c   public.v_cotizacion%rowtype;
  v_pid bigint;
begin
  perform public.exigir_permiso('cotizacion.editar');
  perform public.exigir_permiso('maestro.editar');

  select * into v_c from public.v_cotizacion where id = p_id;
  if v_c.id is null then
    raise exception 'La cotización % no existe', p_id using errcode = '22023';
  end if;
  if v_c.producto_id is not null and exists (select 1 from public.producto where id = v_c.producto_id) then
    raise exception 'Esta cotización ya se convirtió en producto' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categoria where id = p_categoria_id) then
    raise exception 'Elegí una categoría' using errcode = '22023';
  end if;

  insert into public.producto (categoria_id, codigo, nombre, slug, descripcion, precio, estado, minutos_armado)
  values (p_categoria_id, null, v_c.nombre, null, v_c.descripcion, v_c.precio, 'borrador',
          nullif(v_c.minutos, 0))
  returning id into v_pid;

  -- composición visible en el catálogo
  insert into public.producto_extra (producto_id, extra_id, cantidad)
  select v_pid, e.extra_id, sum(e.cantidad)
    from public.cotizacion_extra e
   where e.cotizacion_id = p_id and e.extra_id is not null
   group by e.extra_id;

  -- receta de insumos (solo los materiales que son insumos del sistema)
  insert into public.producto_insumo (producto_id, insumo_id, cantidad, nota)
  select v_pid, m.insumo_id, sum(m.cantidad_usada), 'Desde ' || v_c.codigo
    from public.cotizacion_material m
   where m.cotizacion_id = p_id and m.insumo_id is not null and m.cantidad_usada > 0
   group by m.insumo_id;

  update public.cotizacion set producto_id = v_pid where id = p_id;

  return jsonb_build_object('producto_id', v_pid,
                            'codigo', (select codigo from public.producto where id = v_pid));
end;
$$;

-- ---------------------------------------------------------------------------
-- Venta de mostrador: ahora acepta líneas {"tipo":"cotizacion","cotizacion_id":N}
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

  select coalesce(jsonb_agg(i) filter (where i->>'tipo' <> 'cotizacion'), '[]'),
         coalesce(jsonb_agg(i) filter (where i->>'tipo' = 'cotizacion'), '[]')
    into v_normales, v_cots
    from jsonb_array_elements(p_items) i;

  if jsonb_array_length(v_normales) > 0 then
    v_res := public.crear_pedido(p_cliente, v_normales, '{"tipo":"recojo_tienda"}'::jsonb, p_nota);
    v_pedido := (v_res->>'id')::bigint;
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
-- RLS y grants
-- ---------------------------------------------------------------------------
alter table public.cotizacion          enable row level security;
alter table public.cotizacion_material enable row level security;
alter table public.cotizacion_extra    enable row level security;

drop policy if exists cotizacion_lectura on public.cotizacion;
create policy cotizacion_lectura on public.cotizacion
  for select to authenticated using (public.tiene_permiso('cotizacion.ver'));
drop policy if exists cotizacion_material_lectura on public.cotizacion_material;
create policy cotizacion_material_lectura on public.cotizacion_material
  for select to authenticated using (public.tiene_permiso('cotizacion.ver'));
drop policy if exists cotizacion_extra_lectura on public.cotizacion_extra;
create policy cotizacion_extra_lectura on public.cotizacion_extra
  for select to authenticated using (public.tiene_permiso('cotizacion.ver'));

revoke all on public.cotizacion, public.cotizacion_material, public.cotizacion_extra from anon;
revoke all on public.cotizacion, public.cotizacion_material, public.cotizacion_extra from authenticated;
grant select on public.cotizacion, public.cotizacion_material, public.cotizacion_extra to authenticated;

revoke all on public.v_cotizacion from anon;
grant select on public.v_cotizacion to authenticated;

revoke all on function public.guardar_cotizacion(jsonb) from public, anon;
revoke all on function public.borrar_cotizacion(bigint) from public, anon;
revoke all on function public.convertir_cotizacion_en_producto(bigint, bigint) from public, anon;
revoke all on function public.crear_venta_mostrador(jsonb, jsonb, text) from public, anon;
grant execute on function public.guardar_cotizacion(jsonb) to authenticated;
grant execute on function public.borrar_cotizacion(bigint) to authenticated;
grant execute on function public.convertir_cotizacion_en_producto(bigint, bigint) to authenticated;
grant execute on function public.crear_venta_mostrador(jsonb, jsonb, text) to authenticated;
