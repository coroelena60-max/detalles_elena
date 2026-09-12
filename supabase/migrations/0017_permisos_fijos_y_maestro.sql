-- =============================================================================
-- Detalles Elena · 0017 · Permisos fijos + lo que le faltaba al módulo maestro
--
--   1. El catálogo de PERMISOS es fijo: se define acá, en migración. Nadie
--      crea, edita ni borra permisos desde el panel. Lo que el panel sí hace
--      es gestionar ROLES y decidir qué permisos tiene cada rol.
--   2. "Gestionar producto (CRUD)" necesita más que la tabla: fotos en el
--      Storage, slug y código automáticos, y una sola foto principal.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. permiso: solo lectura. Ni siquiera el admin lo escribe desde el panel.
-- ---------------------------------------------------------------------------
drop policy if exists permiso_panel_lectura   on public.permiso;
drop policy if exists permiso_panel_escritura on public.permiso;
drop policy if exists permiso_lectura         on public.permiso;

-- cualquiera que entre al panel necesita ver la lista para armar los roles
create policy permiso_lectura on public.permiso
  for select to authenticated
  using (true);

revoke insert, update, delete on public.permiso from authenticated;

comment on table public.permiso is
  'Catálogo FIJO de permisos. Se cambia por migración (ver 0016), nunca desde el panel.';

-- ---------------------------------------------------------------------------
-- 2. Roles: se crean y se editan, pero los de sistema no se borran y el rol
--    admin no puede quedarse sin permisos (si no, nadie podría volver a entrar).
-- ---------------------------------------------------------------------------
create or replace function public.tg_proteger_rol_sistema()
returns trigger
language plpgsql
as $$
begin
  if old.es_sistema then
    raise exception 'El rol "%" es de sistema: se le pueden cambiar los permisos, pero no borrarlo',
      old.nombre using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_rol_sistema on public.rol;
create trigger proteger_rol_sistema
  before delete on public.rol
  for each row execute function public.tg_proteger_rol_sistema();

create or replace function public.tg_proteger_permisos_admin()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.rol r where r.id = old.rol_id and r.slug = 'admin') then
    raise exception 'El rol Administrador no puede perder permisos' using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_permisos_admin on public.rol_permiso;
create trigger proteger_permisos_admin
  before delete on public.rol_permiso
  for each row execute function public.tg_proteger_permisos_admin();

/** Los permisos de un rol, marcados: es lo que pinta la pantalla de roles. */
create or replace view public.v_rol_permiso
with (security_invoker = true) as
select
  r.id    as rol_id,
  r.nombre as rol,
  r.slug  as rol_slug,
  r.es_sistema,
  p.id    as permiso_id,
  p.codigo,
  p.modulo,
  p.descripcion,
  (rp.rol_id is not null) as asignado
from public.rol r
cross join public.permiso p
left join public.rol_permiso rp on rp.rol_id = r.id and rp.permiso_id = p.id;

/** Cambia de una un rol completo: la pantalla manda la lista final de códigos. */
create or replace function public.definir_permisos_rol(p_rol_id bigint, p_codigos text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_alta integer := 0;
  v_baja integer := 0;
begin
  if not public.tiene_permiso('rol.editar') then
    raise exception 'No tenés permiso para editar roles' using errcode = '42501';
  end if;

  select slug into v_slug from public.rol where id = p_rol_id;
  if v_slug is null then
    raise exception 'El rol % no existe', p_rol_id using errcode = '22023';
  end if;
  if v_slug = 'admin' then
    raise exception 'El rol Administrador siempre tiene todos los permisos' using errcode = '22023';
  end if;

  with borrados as (
    delete from public.rol_permiso rp
     where rp.rol_id = p_rol_id
       and rp.permiso_id not in (select id from public.permiso where codigo = any(p_codigos))
    returning 1
  )
  select count(*) into v_baja from borrados;

  with agregados as (
    insert into public.rol_permiso (rol_id, permiso_id)
    select p_rol_id, p.id from public.permiso p
     where p.codigo = any(p_codigos)
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = p_rol_id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*) into v_alta from agregados;

  return jsonb_build_object('rol_id', p_rol_id, 'agregados', v_alta, 'quitados', v_baja);
end;
$$;

-- el admin siempre tiene todo: si se agrega un permiso nuevo en una migración
-- futura, esta función lo reparte sin que nadie tenga que acordarse
create or replace function public.sincronizar_permisos_admin()
returns integer
language sql
security definer
set search_path = public
as $$
  with nuevos as (
    insert into public.rol_permiso (rol_id, permiso_id)
    select r.id, p.id
      from public.rol r cross join public.permiso p
     where r.slug = 'admin'
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = r.id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*)::integer from nuevos;
$$;

select public.sincronizar_permisos_admin();

-- =============================================================================
-- 3. Módulo maestro: gestionar el producto que sale en el catálogo web
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Slug automático: el panel manda el nombre, la base arma el slug si falta.
--   Se genera al CREAR. Renombrar un producto NO le cambia el slug: la URL
--   /productos/<slug> ya circula por TikTok y romperla es perder la venta.
--   Para regenerarlo a propósito, el panel manda slug = '' (cadena vacía).
-- ---------------------------------------------------------------------------
create or replace function public.tg_slug_automatico()
returns trigger
language plpgsql
as $$
declare
  v_base   text;
  v_slug   text;
  v_n      integer := 1;
  v_existe boolean;
begin
  -- en un update, un slug que no cambió se respeta tal cual
  if tg_op = 'UPDATE'
     and new.slug is not null and btrim(new.slug) <> ''
     and new.slug is not distinct from old.slug then
    return new;
  end if;

  -- slug explícito: se normaliza y se respeta. No se desambigua, porque los
  -- seeds hacen "insert ... on conflict (slug) do update" y agregarle un "-2"
  -- convertiría el upsert en un insert que choca contra el unique de nombre.
  if new.slug is not null and btrim(new.slug) <> '' then
    new.slug := public.slugify(new.slug);
    return new;
  end if;

  v_base := nullif(public.slugify(new.nombre), '');
  if v_base is null then
    raise exception 'No se pudo generar el slug a partir de "%"', new.nombre
      using errcode = '22023';
  end if;

  -- generado a partir del nombre: acá sí se desambigua (dos ramos pueden
  -- llamarse parecido y el panel no debería fallar por eso)
  v_slug := v_base;
  loop
    execute format(
      'select exists (select 1 from public.%I where slug = $1 and id is distinct from $2)',
      tg_table_name)
      into v_existe using v_slug, new.id;
    exit when not v_existe;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  new.slug := v_slug;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['producto','extra','categoria','extra_categoria','estilo']
  loop
    execute format('drop trigger if exists slug_automatico on public.%I', t);
    execute format('create trigger slug_automatico before insert or update of nombre, slug
                    on public.%I for each row execute function public.tg_slug_automatico()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Código automático del producto: AB-M-003 (estilo + tamaño + correlativo).
--   Si el panel manda uno, se respeta.
-- ---------------------------------------------------------------------------
create or replace function public.generar_codigo_producto(p_envoltorio_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_n       integer;
begin
  select upper(left(es.slug, 2)) || '-' || tm.codigo
    into v_prefijo
    from public.envoltorio env
    join public.estilo es on es.id = env.estilo_id
    join public.tamano tm on tm.id = env.tamano_id
   where env.id = p_envoltorio_id;

  v_prefijo := coalesce(v_prefijo, 'PRD');

  select coalesce(max(substring(codigo from '([0-9]+)$')::integer), 0) + 1
    into v_n
    from public.producto
   where codigo like v_prefijo || '-%';

  return v_prefijo || '-' || lpad(v_n::text, 3, '0');
end;
$$;

create or replace function public.tg_codigo_producto()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := public.generar_codigo_producto(new.envoltorio_id);
  else
    new.codigo := upper(btrim(new.codigo));
  end if;
  return new;
end;
$$;

drop trigger if exists codigo_automatico on public.producto;
create trigger codigo_automatico
  before insert on public.producto
  for each row execute function public.tg_codigo_producto();

-- ---------------------------------------------------------------------------
-- Una sola foto principal por producto: marcar una desmarca la anterior.
--   (existe un índice único parcial; sin esto el panel tendría que hacer dos
--    updates en el orden correcto y cualquier error deja el producto sin foto)
-- ---------------------------------------------------------------------------
create or replace function public.tg_una_foto_principal()
returns trigger
language plpgsql
as $$
begin
  if new.es_principal then
    update public.producto_imagen
       set es_principal = false
     where producto_id = new.producto_id
       and id is distinct from new.id
       -- no tocar la fila que un "insert ... on conflict (producto_id,
       -- storage_path) do update" va a actualizar en este mismo comando:
       -- Postgres no deja afectar la misma fila dos veces (ver 0009)
       and not (new.storage_path is not null and storage_path = new.storage_path)
       and es_principal;
  end if;
  return new;
end;
$$;

-- BEFORE, no AFTER: el índice único parcial producto_imagen_principal_uk se
-- evalúa al insertar, así que la anterior tiene que quedar desmarcada antes.
drop trigger if exists una_foto_principal on public.producto_imagen;
create trigger una_foto_principal
  before insert or update of es_principal on public.producto_imagen
  for each row execute function public.tg_una_foto_principal();

-- ---------------------------------------------------------------------------
-- Storage: el panel sube y borra fotos del bucket 'catalogo', pero solo con
--   permiso de maestro. Antes alcanzaba con estar logueado y no había forma
--   de borrar una foto vieja.
-- ---------------------------------------------------------------------------
drop policy if exists catalogo_escritura_autenticada on storage.objects;
drop policy if exists catalogo_update_autenticada    on storage.objects;
drop policy if exists catalogo_delete_autenticada    on storage.objects;
drop policy if exists catalogo_escritura_maestro     on storage.objects;
drop policy if exists catalogo_update_maestro        on storage.objects;
drop policy if exists catalogo_delete_maestro        on storage.objects;

create policy catalogo_escritura_maestro on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'));

create policy catalogo_update_maestro on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'))
  with check (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'));

create policy catalogo_delete_maestro on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalogo' and public.tiene_permiso('maestro.editar'));

-- ---------------------------------------------------------------------------
-- v_producto_admin: la grilla del CRUD en una sola consulta.
--   A diferencia de v_catalogo_producto, muestra TODOS los estados
--   (incluido 'borrador' e 'inactivo') y agrega costo, margen y existencia.
-- ---------------------------------------------------------------------------
create or replace view public.v_producto_admin
with (security_invoker = true) as
select
  p.id,
  p.codigo,
  p.nombre,
  p.slug,
  p.descripcion,
  p.precio,
  p.precio_desde,
  p.estado,
  p.destacado,
  p.orden,
  p.lead_time_dias,
  p.minutos_armado,
  p.stock_minimo,
  p.categoria_id,
  c.nombre  as categoria,
  p.envoltorio_id,
  case when env.id is not null then es.nombre || ' ' || tm.codigo end as envoltorio,
  env.espacios as espacios_capacidad,
  (select count(*) from public.producto_imagen pi where pi.producto_id = p.id) as fotos,
  (select pi.url from public.producto_imagen pi
    where pi.producto_id = p.id
    order by pi.es_principal desc, pi.orden, pi.id limit 1) as imagen_principal,
  (select coalesce(sum(pe.cantidad), 0) from public.producto_extra pe
    where pe.producto_id = p.id) as extras_en_receta,
  cp.costo_total,
  mp.margen,
  mp.margen_pct,
  mp.precio_sugerido,
  mp.a_perdida,
  ep.existencia,
  p.created_at,
  p.updated_at
from public.producto p
join public.categoria c          on c.id = p.categoria_id
left join public.envoltorio env  on env.id = p.envoltorio_id
left join public.estilo es       on es.id = env.estilo_id
left join public.tamano tm       on tm.id = env.tamano_id
left join public.v_costo_producto cp   on cp.id = p.id
left join public.v_margen_producto mp  on mp.id = p.id
left join public.v_existencia_producto ep on ep.id = p.id;

-- ---------------------------------------------------------------------------
-- Grants de lo nuevo
-- ---------------------------------------------------------------------------
revoke all on public.v_producto_admin from anon;
revoke all on public.v_rol_permiso    from anon;
grant select on public.v_producto_admin to authenticated;
grant select on public.v_rol_permiso    to authenticated;

revoke all on function public.definir_permisos_rol(bigint, text[]) from public, anon;
grant execute on function public.definir_permisos_rol(bigint, text[]) to authenticated;

revoke all on function public.generar_codigo_producto(bigint) from public, anon;
grant execute on function public.generar_codigo_producto(bigint) to authenticated;

revoke all on function public.sincronizar_permisos_admin() from public, anon, authenticated;
