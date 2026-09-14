-- =============================================================================
-- 0025 · Cotización: varios "otros gastos" fijos con su concepto
--
-- Antes había un solo número (cotizacion.otros_monto) para todo lo fijo, así que
-- delivery Bs 10 + bolsa Bs 3 + tarjeta Bs 2 no se podían anotar por separado.
-- Ahora cada gasto es una línea de cotizacion_otro (concepto + monto).
--
-- cotizacion.otros_monto se queda y guarda la SUMA de las líneas: v_cotizacion,
-- convertir_cotizacion_en_producto() y la venta de mostrador siguen igual.
-- guardar_cotizacion() acepta p.otros = [{concepto, monto}]; si no viene (panel
-- viejo) usa p.otros_monto como antes. Así no importa qué se publica primero.
-- =============================================================================

create table if not exists public.cotizacion_otro (
  id            bigint generated always as identity primary key,
  cotizacion_id bigint        not null references public.cotizacion (id) on delete cascade,
  concepto      text          not null,
  monto         numeric(10,2) not null,
  orden         integer       not null default 0,
  constraint cotizacion_otro_concepto_ck check (length(btrim(concepto)) > 0),
  constraint cotizacion_otro_monto_ck    check (monto >= 0)
);
create index if not exists cotizacion_otro_idx on public.cotizacion_otro (cotizacion_id);

-- las cotizaciones que ya tenían un monto fijo quedan con una línea que lo explica
insert into public.cotizacion_otro (cotizacion_id, concepto, monto, orden)
select c.id, 'Otros gastos', c.otros_monto, 1
  from public.cotizacion c
 where c.otros_monto > 0
   and not exists (select 1 from public.cotizacion_otro o where o.cotizacion_id = c.id);

-- ---------------------------------------------------------------------------
-- RLS y grants: igual que las otras líneas de la cotización (se escriben solo
-- por guardar_cotizacion)
-- ---------------------------------------------------------------------------
alter table public.cotizacion_otro enable row level security;
drop policy if exists cotizacion_otro_lectura on public.cotizacion_otro;
create policy cotizacion_otro_lectura on public.cotizacion_otro
  for select to authenticated using (public.tiene_permiso('cotizacion.ver'));
revoke all on public.cotizacion_otro from anon;
revoke all on public.cotizacion_otro from authenticated;
grant select on public.cotizacion_otro to authenticated;

-- ---------------------------------------------------------------------------
-- guardar_cotizacion: la de 0023 + las líneas de otros gastos
-- ---------------------------------------------------------------------------
create or replace function public.guardar_cotizacion(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          bigint := nullif(p->>'id', '')::bigint;
  v_m           jsonb;
  v_e           jsonb;
  v_o           jsonb;
  v_insumo      bigint;
  v_orden       integer := 0;
  v_nombre      text;
  v_unidad      unidad_medida;
  v_slug        text;
  v_n           integer;
  v_con_lineas  boolean := jsonb_typeof(p->'otros') = 'array';
  v_otros_monto numeric(10,2);
begin
  perform public.exigir_permiso('cotizacion.editar');

  if length(btrim(coalesce(p->>'nombre', ''))) = 0 then
    raise exception 'Poné un nombre a la cotización' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p->'materiales', '[]')) > 100
     or jsonb_array_length(coalesce(p->'extras', '[]')) > 100
     or (v_con_lineas and jsonb_array_length(p->'otros') > 50) then
    raise exception 'Demasiadas líneas en la cotización' using errcode = '22023';
  end if;

  if v_con_lineas then
    if exists (select 1 from jsonb_array_elements(p->'otros') o
                where coalesce((o->>'monto')::numeric, 0) < 0) then
      raise exception 'Los otros gastos no pueden ser negativos' using errcode = '22023';
    end if;
    select coalesce(sum(round(coalesce((o->>'monto')::numeric, 0), 2)), 0)
      into v_otros_monto
      from jsonb_array_elements(p->'otros') o;
  else
    v_otros_monto := coalesce((p->>'otros_monto')::numeric, 0);
  end if;

  if v_id is null then
    insert into public.cotizacion (nombre, descripcion, minutos, costo_hora, otros_pct, otros_monto,
                                   margen_pct, precio_final, creado_por)
    values (btrim(p->>'nombre'), nullif(btrim(coalesce(p->>'descripcion', '')), ''),
            coalesce((p->>'minutos')::integer, 0),
            coalesce((p->>'costo_hora')::numeric, public.parametro_valor('costo_hora_mano_obra', 20)),
            coalesce((p->>'otros_pct')::numeric, 0), v_otros_monto,
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
           otros_monto  = v_otros_monto,
           margen_pct   = coalesce((p->>'margen_pct')::numeric, margen_pct),
           precio_final = nullif(p->>'precio_final', '')::numeric
     where id = v_id;
    if not found then
      raise exception 'La cotización % no existe', v_id using errcode = '22023';
    end if;
    delete from public.cotizacion_material where cotizacion_id = v_id;
    delete from public.cotizacion_extra    where cotizacion_id = v_id;
    delete from public.cotizacion_otro     where cotizacion_id = v_id;
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

  -- otros gastos fijos ---------------------------------------------------------
  v_orden := 0;
  if v_con_lineas then
    for v_o in select * from jsonb_array_elements(p->'otros')
    loop
      continue when coalesce((v_o->>'monto')::numeric, 0) = 0
                and btrim(coalesce(v_o->>'concepto', '')) = '';
      v_orden := v_orden + 1;
      insert into public.cotizacion_otro (cotizacion_id, concepto, monto, orden)
      values (v_id,
              coalesce(nullif(btrim(coalesce(v_o->>'concepto', '')), ''), 'Otro gasto'),
              round(coalesce((v_o->>'monto')::numeric, 0), 2),
              v_orden);
    end loop;
  elsif v_otros_monto > 0 then
    -- panel viejo: un solo monto, queda como una línea
    insert into public.cotizacion_otro (cotizacion_id, concepto, monto, orden)
    values (v_id, 'Otros gastos', v_otros_monto, 1);
  end if;

  return (select to_jsonb(v) from public.v_cotizacion v where v.id = v_id);
end;
$$;

revoke all on function public.guardar_cotizacion(jsonb) from public, anon;
grant execute on function public.guardar_cotizacion(jsonb) to authenticated;
