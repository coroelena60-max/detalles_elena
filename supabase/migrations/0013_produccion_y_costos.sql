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
