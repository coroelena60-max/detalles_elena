-- =============================================================================
-- Detalles Elena · 0021 · Contabilidad, reportes por fecha y candados de RPC
--
--   1. Cierra un hueco: las funciones del panel (cobrar, cambiar el estado de
--      un pedido, recibir compras, mover stock) son security definer y NO
--      revisaban permisos. Security definer se saltea RLS, así que cualquier
--      cuenta con sesión —aunque no tuviera ningún rol— podía llamarlas.
--   2. Contabilidad: GASTOS. No confundir con COMPRAS: una compra trae insumos
--      que entran al inventario (papel, cinta, peluches); un gasto es plata
--      que sale y no vuelve como mercadería (alquiler, luz, delivery, TikTok).
--   3. Reportes con rango de fechas: ventas, compras, ventas confirmadas,
--      ganancias y la bitácora por usuario.
--   4. La bitácora deja de anotar "cambios" que no cambiaron nada.
-- =============================================================================

-- =============================================================================
-- 1. Candados en las funciones del panel
-- =============================================================================

create or replace function public.exigir_permiso(p_codigo text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso(p_codigo) then
    raise exception 'Tu cuenta no tiene el permiso "%"', p_codigo using errcode = '42501';
  end if;
end;
$$;

-- registrar_movimiento -------------------------------------------------------
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
  perform public.exigir_permiso('inventario.editar');

  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'La cantidad del movimiento no puede ser cero' using errcode = '22023';
  end if;
  -- una merma siempre saca; una devolución siempre mete
  if p_tipo = 'merma' and p_cantidad > 0 then
    raise exception 'Una merma saca del stock: la cantidad va en negativo' using errcode = '22023';
  end if;

  insert into public.movimiento_inventario
    (tipo_item, insumo_id, extra_id, producto_id, tipo, cantidad,
     costo_unitario, nota, referencia, perfil_id)
  values
    (p_tipo_item,
     case when p_tipo_item = 'insumo'   then p_item_id end,
     case when p_tipo_item = 'extra'    then p_item_id end,
     case when p_tipo_item = 'producto' then p_item_id end,
     p_tipo, p_cantidad, coalesce(p_costo, 0), nullif(btrim(p_nota), ''), p_referencia, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- recibir_compra -------------------------------------------------------------
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
  perform public.exigir_permiso('compra.editar');

  select estado into v_estado from public.compra where id = p_compra_id;
  if v_estado is null then
    raise exception 'La compra % no existe', p_compra_id using errcode = '22023';
  end if;
  if v_estado = 'recibida' then
    return jsonb_build_object('compra_id', p_compra_id, 'estado', 'recibida', 'cambio', false);
  end if;
  if v_estado = 'anulada' then
    raise exception 'La compra % está anulada', p_compra_id using errcode = '22023';
  end if;
  if not exists (select 1 from public.compra_item where compra_id = p_compra_id) then
    raise exception 'La compra no tiene ningún insumo cargado' using errcode = '22023';
  end if;

  for v_item in
    select ci.insumo_id, ci.cantidad, ci.costo_unitario
      from public.compra_item ci where ci.compra_id = p_compra_id
  loop
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
       p_compra_id, format('compra:%s:insumo:%s', p_compra_id, v_item.insumo_id), auth.uid())
    on conflict (referencia) do nothing;
  end loop;

  update public.compra
     set estado = 'recibida', recibida_at = now()
   where id = p_compra_id;

  return jsonb_build_object('compra_id', p_compra_id, 'estado', 'recibida', 'cambio', true);
end;
$$;

/**
 * Anular una compra. Solo se anula lo que todavía no entró al inventario: una
 * compra recibida ya movió stock y costo promedio, y deshacer eso a ciegas
 * dejaría el costo mal. Para eso está el ajuste de inventario.
 */
create or replace function public.anular_compra(p_compra_id bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_estado estado_compra;
begin
  perform public.exigir_permiso('compra.editar');

  select estado into v_estado from public.compra where id = p_compra_id;
  if v_estado is null then
    raise exception 'La compra % no existe', p_compra_id using errcode = '22023';
  end if;
  if v_estado = 'recibida' then
    raise exception 'La compra ya se recibió y movió el inventario: corregilo con un ajuste de stock'
      using errcode = '22023';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Escribí por qué se anula' using errcode = '22023';
  end if;

  update public.compra
     set estado = 'anulada',
         nota = concat_ws(E'\n', nullif(nota, ''), 'Anulada: ' || btrim(p_motivo))
   where id = p_compra_id;

  return jsonb_build_object('compra_id', p_compra_id, 'estado', 'anulada');
end;
$$;

-- registrar_salida_pedido: la llama cambiar_estado_pedido al entregar ----------
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
  perform public.exigir_permiso('venta.editar');

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

-- producir_extra -------------------------------------------------------------
create or replace function public.producir_extra(p_extra_id bigint, p_cantidad numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ing   record;
  v_costo numeric(12,4);
  v_mov   bigint;
begin
  perform public.exigir_permiso('inventario.editar');

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

-- registrar_pago -------------------------------------------------------------
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

-- cambiar_estado_pedido ------------------------------------------------------
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
  perform public.exigir_permiso('venta.editar');

  select estado into v_anterior from public.pedido where id = p_pedido_id;
  if v_anterior is null then
    raise exception 'El pedido % no existe', p_pedido_id using errcode = '22023';
  end if;
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

-- crear_venta_mostrador ------------------------------------------------------
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
  perform public.exigir_permiso('venta.editar');

  v_res := public.crear_pedido(p_cliente, p_items, '{"tipo":"recojo_tienda"}'::jsonb, p_nota);

  update public.pedido
     set canal        = 'mostrador',
         estado       = 'confirmado',
         atendido_por = auth.uid()
   where id = (v_res->>'id')::bigint;

  return v_res || jsonb_build_object('estado', 'confirmado');
end;
$$;

-- costear_configuracion: solo lectura, pero muestra costos internos ---------
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
  perform public.exigir_permiso('maestro.ver');

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

-- =============================================================================
-- 2. Permisos nuevos (el catálogo sigue siendo fijo: se agregan por migración)
-- =============================================================================
insert into public.permiso (codigo, modulo, descripcion) values
  ('gasto.registrar',   'contabilidad', 'Registrar y anular gastos'),
  ('contabilidad.ver',  'contabilidad', 'Ver gastos, ventas confirmadas y ganancias')
on conflict (codigo) do update
  set modulo = excluded.modulo, descripcion = excluded.descripcion;

-- admin y superadmin los reciben solos
select public.sincronizar_permisos_admin();

-- =============================================================================
-- 3. Gastos
-- =============================================================================
create table if not exists public.categoria_gasto (
  id         bigint generated always as identity primary key,
  nombre     text        not null,
  descripcion text,
  orden      integer     not null default 0,
  activa     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categoria_gasto_nombre_uk unique (nombre),
  constraint categoria_gasto_nombre_ck check (length(btrim(nombre)) > 0)
);

insert into public.categoria_gasto (nombre, descripcion, orden) values
  ('Alquiler',               'Local, taller o depósito.', 1),
  ('Servicios básicos',      'Luz, agua, gas, internet, teléfono.', 2),
  ('Transporte y delivery',  'Pasajes, gasolina, mototaxi, envíos que paga la tienda.', 3),
  ('Publicidad',             'TikTok, Facebook, Instagram, impresiones.', 4),
  ('Sueldos y pagos',        'Ayudantes, pagos por jornada.', 5),
  ('Herramientas y equipos', 'Pistola de silicona, tijeras, estantes: lo que no se consume en un ramo.', 6),
  ('Comisiones',             'Comisiones de QR, bancos o plataformas.', 7),
  ('Impuestos y trámites',   'Impuestos, patentes, permisos.', 8),
  ('Otros',                  'Lo que no entra en ninguna de las anteriores.', 99)
on conflict (nombre) do nothing;

do $$ begin
  create type estado_gasto as enum ('registrado','anulado');
exception when duplicate_object then null; end $$;

create table if not exists public.gasto (
  id                 bigint generated always as identity primary key,
  codigo             text generated always as ('GAS-' || lpad(id::text, 5, '0')) stored,
  fecha              date          not null default ((now() at time zone 'America/La_Paz')::date),
  categoria_gasto_id bigint        not null references public.categoria_gasto (id) on delete restrict,
  descripcion        text          not null,
  monto              numeric(10,2) not null,
  metodo             metodo_pago   not null default 'efectivo',
  comprobante        text,                   -- nº de factura, recibo o transacción
  nota               text,
  estado             estado_gasto  not null default 'registrado',
  motivo_anulacion   text,
  registrado_por     uuid          references public.perfil (id) on delete set null,
  anulado_por        uuid          references public.perfil (id) on delete set null,
  anulado_at         timestamptz,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now(),
  constraint gasto_codigo_uk      unique (codigo),
  constraint gasto_monto_ck       check (monto > 0),
  constraint gasto_descripcion_ck check (length(btrim(descripcion)) > 0),
  constraint gasto_anulacion_ck   check (estado = 'registrado' or motivo_anulacion is not null)
);
create index if not exists gasto_fecha_idx     on public.gasto (fecha desc);
create index if not exists gasto_categoria_idx on public.gasto (categoria_gasto_id);
create index if not exists gasto_estado_idx    on public.gasto (estado);

comment on table public.gasto is
  'Plata que sale y no vuelve como mercadería. Las compras de insumos van en `compra`.';

drop trigger if exists set_updated_at on public.categoria_gasto;
create trigger set_updated_at before update on public.categoria_gasto
  for each row execute function public.tg_set_updated_at();
drop trigger if exists set_updated_at on public.gasto;
create trigger set_updated_at before update on public.gasto
  for each row execute function public.tg_set_updated_at();

/** Quién lo registró lo pone la base, no el panel. */
create or replace function public.tg_gasto_autor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.registrado_por := coalesce(auth.uid(), new.registrado_por);
    new.estado := 'registrado';
  end if;
  return new;
end;
$$;

drop trigger if exists gasto_autor on public.gasto;
create trigger gasto_autor before insert on public.gasto
  for each row execute function public.tg_gasto_autor();

/**
 * Un gasto no se borra ni se edita a escondidas: se anula con motivo, y queda
 * a la vista. La contabilidad que se puede borrar no es contabilidad.
 */
create or replace function public.anular_gasto(p_gasto_id bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_estado estado_gasto;
begin
  perform public.exigir_permiso('gasto.registrar');

  select estado into v_estado from public.gasto where id = p_gasto_id;
  if v_estado is null then
    raise exception 'El gasto % no existe', p_gasto_id using errcode = '22023';
  end if;
  if v_estado = 'anulado' then
    return jsonb_build_object('gasto_id', p_gasto_id, 'estado', 'anulado', 'cambio', false);
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Escribí por qué se anula el gasto' using errcode = '22023';
  end if;

  update public.gasto
     set estado = 'anulado',
         motivo_anulacion = btrim(p_motivo),
         anulado_por = auth.uid(),
         anulado_at = now()
   where id = p_gasto_id;

  return jsonb_build_object('gasto_id', p_gasto_id, 'estado', 'anulado', 'cambio', true);
end;
$$;

-- RLS de contabilidad ---------------------------------------------------------
alter table public.categoria_gasto enable row level security;
alter table public.gasto           enable row level security;

drop policy if exists categoria_gasto_lectura on public.categoria_gasto;
create policy categoria_gasto_lectura on public.categoria_gasto
  for select to authenticated
  using (public.tiene_permiso('contabilidad.ver') or public.tiene_permiso('gasto.registrar'));

drop policy if exists categoria_gasto_escritura on public.categoria_gasto;
create policy categoria_gasto_escritura on public.categoria_gasto
  for all to authenticated
  using (public.tiene_permiso('gasto.registrar'))
  with check (public.tiene_permiso('gasto.registrar'));

drop policy if exists gasto_lectura on public.gasto;
create policy gasto_lectura on public.gasto
  for select to authenticated
  using (public.tiene_permiso('contabilidad.ver') or public.tiene_permiso('gasto.registrar'));

-- se registra, pero no se edita ni se borra: para eso está anular_gasto()
drop policy if exists gasto_alta on public.gasto;
create policy gasto_alta on public.gasto
  for insert to authenticated
  with check (public.tiene_permiso('gasto.registrar'));

revoke all on public.categoria_gasto from anon;
revoke all on public.gasto           from anon;
grant select, insert, update, delete on public.categoria_gasto to authenticated;
grant select, insert on public.gasto to authenticated;
revoke update, delete, truncate, trigger, references on public.gasto from authenticated;
revoke truncate, trigger, references on public.categoria_gasto from authenticated;

do $$
declare s record;
begin
  for s in select sequence_name from information_schema.sequences
            where sequence_schema = 'public'
              and sequence_name in ('gasto_id_seq', 'categoria_gasto_id_seq')
  loop
    execute format('grant usage, select on sequence public.%I to authenticated', s.sequence_name);
  end loop;
end $$;

-- =============================================================================
-- 4. Bitácora: no anotar cambios vacíos
-- =============================================================================
create or replace function public.tg_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce((to_jsonb(old)->>'id'), '');
    insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_antes)
    values (auth.uid(), 'delete', tg_table_name, v_id, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    -- re-ejecutar un seed hace "update" con los mismos valores: eso no es un cambio
    if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
      return new;
    end if;
    v_id := coalesce((to_jsonb(new)->>'id'), '');
    insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_antes, datos_despues)
    values (auth.uid(), 'update', tg_table_name, v_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_id := coalesce((to_jsonb(new)->>'id'), '');
    insert into public.bitacora (perfil_id, accion, entidad, entidad_id, datos_despues)
    values (auth.uid(), 'insert', tg_table_name, v_id, to_jsonb(new));
    return new;
  end if;
end;
$$;

-- se audita también lo nuevo y lo que faltaba
do $$
declare t text;
begin
  foreach t in array array['gasto','categoria_gasto','categoria','proveedor','cliente',
                           'rol','perfil','movimiento_inventario','extra_insumo']
  loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function public.tg_bitacora()', t);
  end loop;
end $$;

-- =============================================================================
-- 5. Vistas de apoyo para los módulos
-- =============================================================================

/** Ficha del cliente: cuánto compró y cuánto debe. */
create or replace view public.v_cliente_resumen
with (security_invoker = true) as
select
  c.id,
  c.nombre,
  c.telefono,
  c.email,
  c.notas,
  c.created_at,
  count(p.id)                                                   as pedidos,
  count(p.id) filter (where p.estado in
    ('confirmado','en_produccion','listo','entregado'))         as pedidos_confirmados,
  coalesce(sum(p.total) filter (where p.estado in
    ('confirmado','en_produccion','listo','entregado')), 0)::numeric(12,2) as total_comprado,
  coalesce(sum(s.saldo) filter (where s.estado_pago <> 'pagado'
    and p.estado in ('confirmado','en_produccion','listo','entregado')), 0)::numeric(12,2) as saldo_pendiente,
  max(p.created_at)                                             as ultimo_pedido
from public.cliente c
left join public.pedido p         on p.cliente_id = c.id
left join public.v_pedido_saldo s on s.id = p.id
group by c.id;

/** Kardex legible: el movimiento con el nombre de lo que se movió y de quién. */
create or replace view public.v_kardex
with (security_invoker = true) as
select
  m.id,
  m.created_at,
  m.tipo_item,
  coalesce(m.insumo_id, m.extra_id, m.producto_id) as item_id,
  coalesce(i.nombre, e.nombre, p.nombre)           as item,
  m.tipo,
  m.cantidad,
  m.costo_unitario,
  m.nota,
  m.referencia,
  c.codigo  as compra,
  pe.codigo as pedido,
  m.perfil_id,
  pf.nombre as registrado_por
from public.movimiento_inventario m
left join public.insumo   i  on i.id  = m.insumo_id
left join public.extra    e  on e.id  = m.extra_id
left join public.producto p  on p.id  = m.producto_id
left join public.compra   c  on c.id  = m.compra_id
left join public.pedido   pe on pe.id = m.pedido_id
left join public.perfil   pf on pf.id = m.perfil_id;

revoke all on public.v_cliente_resumen, public.v_kardex from anon;
grant select on public.v_cliente_resumen, public.v_kardex to authenticated;
revoke insert, update, delete, truncate, trigger, references
  on public.v_cliente_resumen, public.v_kardex from authenticated;

-- =============================================================================
-- 6. Reportes con rango de fechas
--
--    Son security definer con su propio permiso: quien tiene "reporte.ver" o
--    "contabilidad.ver" ve los números agregados sin necesitar permiso sobre
--    cada tabla de abajo (un contador no tiene por qué poder editar pedidos).
--    Las fechas son del calendario de Bolivia (America/La_Paz).
-- =============================================================================

/** Rango válido: si falta algo, el mes en curso. Máximo 3 años. */
create or replace function public.rango_fechas(p_desde date, p_hasta date)
returns table (desde date, hasta date)
language plpgsql
stable
as $$
declare
  v_hoy   date := (now() at time zone 'America/La_Paz')::date;
  v_desde date := coalesce(p_desde, date_trunc('month', v_hoy)::date);
  v_hasta date := coalesce(p_hasta, v_hoy);
begin
  if v_hasta < v_desde then
    raise exception 'La fecha "hasta" es anterior a "desde"' using errcode = '22023';
  end if;
  if v_hasta - v_desde > 1100 then
    raise exception 'El rango es demasiado largo: pedí como mucho 3 años' using errcode = '22023';
  end if;
  return query select v_desde, v_hasta;
end;
$$;

/** Estados en los que una venta ya cuenta como plata comprometida. */
create or replace function public.estados_venta_confirmada()
returns estado_pedido[]
language sql
immutable
as $$
  select array['confirmado','en_produccion','listo','entregado']::estado_pedido[];
$$;

-- -----------------------------------------------------------------------------
-- Reporte de ventas (módulo Reportes): qué se vende, cuándo y por dónde.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Reporte de compras (módulo Reportes)
-- -----------------------------------------------------------------------------
create or replace function public.reporte_compras(p_desde date, p_hasta date)
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

  with com as (
    select c.* from public.compra c where c.fecha between v_desde and v_hasta
  ),
  rec as (select * from com where estado = 'recibida')
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'resumen', (select jsonb_build_object(
        'recibidas',   count(*) filter (where estado = 'recibida'),
        'borradores',  count(*) filter (where estado = 'borrador'),
        'anuladas',    count(*) filter (where estado = 'anulada'),
        'total',       coalesce(sum(total) filter (where estado = 'recibida'), 0),
        'pendiente',   coalesce(sum(total) filter (where estado = 'borrador'), 0),
        'promedio',    coalesce(round(avg(total) filter (where estado = 'recibida'), 2), 0)
      ) from com),
    'por_proveedor', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(pv.nombre, 'Sin proveedor') as proveedor,
               count(*) as compras, sum(rec.total) as total
          from rec left join public.proveedor pv on pv.id = rec.proveedor_id
         group by coalesce(pv.nombre, 'Sin proveedor')) x), '[]'::jsonb),
    'por_insumo', coalesce((select jsonb_agg(x order by x.total desc) from (
        select i.nombre, i.unidad, sum(ci.cantidad) as cantidad, sum(ci.subtotal) as total,
               round(sum(ci.subtotal) / nullif(sum(ci.cantidad), 0), 4) as costo_promedio
          from public.compra_item ci
          join rec on rec.id = ci.compra_id
          join public.insumo i on i.id = ci.insumo_id
         group by i.nombre, i.unidad
         order by total desc limit 20) x), '[]'::jsonb),
    'por_mes', coalesce((select jsonb_agg(x order by x.mes) from (
        select date_trunc('month', fecha)::date as mes, count(*) as compras, sum(total) as total
          from rec group by 1) x), '[]'::jsonb),
    'compras', coalesce((select jsonb_agg(x order by x.fecha desc, x.codigo desc) from (
        select com.codigo, com.fecha, com.estado, com.total, com.documento,
               pv.nombre as proveedor
          from com left join public.proveedor pv on pv.id = com.proveedor_id
         order by com.fecha desc limit 200) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ventas confirmadas (módulo Contabilidad): el libro de ingresos.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Ganancias (módulo Contabilidad)
--
--   Ventas confirmadas
--   − Compras recibidas (insumos que entraron)
--   = Utilidad bruta
--   − Gastos (lo que salió y no vuelve como mercadería)
--   = Ganancia neta
--
--   Es un resultado "de caja simple", el que usa un emprendimiento para saber
--   si el mes dejó plata. No descuenta el stock que sobró sin usar.
-- -----------------------------------------------------------------------------
create or replace function public.reporte_ganancias(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde   date;
  v_hasta   date;
  v_ventas  numeric(12,2);
  v_compras numeric(12,2);
  v_gastos  numeric(12,2);
  v_res     jsonb;
begin
  perform public.exigir_permiso('contabilidad.ver');
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_fechas(p_desde, p_hasta) r;

  select coalesce(sum(p.total), 0) into v_ventas
    from public.pedido p
   where p.estado = any(public.estados_venta_confirmada())
     and (p.created_at at time zone 'America/La_Paz')::date between v_desde and v_hasta;

  select coalesce(sum(c.total), 0) into v_compras
    from public.compra c
   where c.estado = 'recibida' and c.fecha between v_desde and v_hasta;

  select coalesce(sum(g.monto), 0) into v_gastos
    from public.gasto g
   where g.estado = 'registrado' and g.fecha between v_desde and v_hasta;

  with meses as (
    select generate_series(date_trunc('month', v_desde), date_trunc('month', v_hasta),
                           interval '1 month')::date as mes
  ),
  vm as (
    select date_trunc('month', p.created_at at time zone 'America/La_Paz')::date as mes,
           sum(p.total) as total
      from public.pedido p
     where p.estado = any(public.estados_venta_confirmada())
       and (p.created_at at time zone 'America/La_Paz')::date between v_desde and v_hasta
     group by 1
  ),
  cm as (
    select date_trunc('month', c.fecha)::date as mes, sum(c.total) as total
      from public.compra c
     where c.estado = 'recibida' and c.fecha between v_desde and v_hasta
     group by 1
  ),
  gm as (
    select date_trunc('month', g.fecha)::date as mes, sum(g.monto) as total
      from public.gasto g
     where g.estado = 'registrado' and g.fecha between v_desde and v_hasta
     group by 1
  )
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'ventas', v_ventas,
    'compras', v_compras,
    'utilidad_bruta', v_ventas - v_compras,
    'gastos', v_gastos,
    'ganancia', v_ventas - v_compras - v_gastos,
    'margen_pct', case when v_ventas > 0
                       then round((v_ventas - v_compras - v_gastos) * 100.0 / v_ventas, 1)
                       else null end,
    'gastos_por_categoria', coalesce((select jsonb_agg(x order by x.total desc) from (
        select cg.nombre as categoria, count(*) as gastos, sum(g.monto) as total
          from public.gasto g
          join public.categoria_gasto cg on cg.id = g.categoria_gasto_id
         where g.estado = 'registrado' and g.fecha between v_desde and v_hasta
         group by cg.nombre) x), '[]'::jsonb),
    'por_mes', coalesce((select jsonb_agg(x order by x.mes) from (
        select m.mes,
               coalesce(vm.total, 0) as ventas,
               coalesce(cm.total, 0) as compras,
               coalesce(gm.total, 0) as gastos,
               coalesce(vm.total, 0) - coalesce(cm.total, 0) - coalesce(gm.total, 0) as ganancia
          from meses m
          left join vm on vm.mes = m.mes
          left join cm on cm.mes = m.mes
          left join gm on gm.mes = m.mes) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bitácora por usuario y fechas (módulo Administración)
--
--   p_perfil = null y p_sistema = false  → todos
--   p_sistema = true                      → solo lo que hizo la base sola
--   Respeta la regla del superadmin: quien no lo es, no ve sus acciones.
--   No devuelve los "cambios" vacíos que dejaba la versión anterior del trigger.
-- -----------------------------------------------------------------------------
create or replace function public.reporte_bitacora(
  p_desde   date,
  p_hasta   date,
  p_perfil  uuid    default null,
  p_sistema boolean default false,
  p_entidad text    default null
)
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
  perform public.exigir_permiso('bitacora.ver');
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_fechas(p_desde, p_hasta) r;

  if p_perfil is not null and not public.puede_ver_perfil(p_perfil) then
    raise exception 'Ese usuario no existe' using errcode = '22023';
  end if;

  with filas as (
    select b.id, b.created_at, b.accion, b.entidad, b.entidad_id, b.nota,
           b.datos_antes, b.datos_despues, b.perfil_id,
           pf.nombre as usuario, pf.email
      from public.bitacora b
      left join public.perfil pf on pf.id = b.perfil_id
     where (b.created_at at time zone 'America/La_Paz')::date between v_desde and v_hasta
       and (b.perfil_id is null or public.puede_ver_perfil(b.perfil_id))
       and (not p_sistema or b.perfil_id is null)
       and (p_perfil is null or b.perfil_id = p_perfil)
       and (p_entidad is null or b.entidad = p_entidad)
       and not (b.accion = 'update'
                and (b.datos_antes - 'updated_at') = (b.datos_despues - 'updated_at'))
  )
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'total', (select count(*) from filas),
    'por_entidad', coalesce((select jsonb_agg(x order by x.acciones desc) from (
        select entidad, count(*) as acciones from filas group by entidad) x), '[]'::jsonb),
    'por_accion', coalesce((select jsonb_agg(x order by x.acciones desc) from (
        select accion, count(*) as acciones from filas group by accion) x), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select (created_at at time zone 'America/La_Paz')::date as dia, count(*) as acciones
          from filas group by 1) x), '[]'::jsonb),
    'filas', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select id, created_at, accion, entidad, entidad_id, nota, usuario, email,
               -- solo los nombres de los campos que cambiaron, no los datos enteros
               case when accion in ('update','cambio_estado') then (
                 select coalesce(jsonb_agg(k.key), '[]'::jsonb)
                   from jsonb_each(coalesce(datos_despues, '{}'::jsonb)) k
                  where k.key <> 'updated_at'
                    and (datos_antes -> k.key) is distinct from k.value
               ) end as campos,
               case when accion = 'cambio_estado' then datos_antes->>'estado' end as estado_antes,
               case when accion = 'cambio_estado' then datos_despues->>'estado' end as estado_despues,
               coalesce(datos_despues->>'codigo', datos_antes->>'codigo',
                        datos_despues->>'nombre', datos_antes->>'nombre') as referencia
          from filas order by created_at desc limit 1000) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- =============================================================================
-- 7. Grants de funciones
-- =============================================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.exigir_permiso(text)',
    'public.anular_compra(bigint,text)',
    'public.anular_gasto(bigint,text)',
    'public.rango_fechas(date,date)',
    'public.estados_venta_confirmada()',
    'public.reporte_ventas(date,date)',
    'public.reporte_compras(date,date)',
    'public.reporte_ventas_confirmadas(date,date)',
    'public.reporte_ganancias(date,date)',
    'public.reporte_bitacora(date,date,uuid,boolean,text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke truncate, trigger, references on public.categoria_gasto, public.gasto from anon;
