-- =============================================================================
-- Detalles Elena · 0020 · Superadministrador
--   Un escalón por encima del admin: ve y hace todo, incluso lo que el
--   administrador no ve.
--
--   La regla nueva: para quien NO es superadmin, el rol 'superadmin' y las
--   personas que lo tienen SON INVISIBLES. No es que aparezcan en gris: no
--   están. Así el admin puede gestionar roles y usuarios con total libertad
--   sin poder tocar —ni enterarse de— la cuenta de arriba.
--
--   Eso se hace con RLS, no escondiendo botones: aunque alguien consulte la
--   API a mano con su sesión, las filas no vuelven.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. El rol
-- ---------------------------------------------------------------------------
insert into public.rol (nombre, slug, descripcion, es_sistema) values
  ('Superadministrador', 'superadmin',
   'Dueño del sistema. Ve todo, incluso los roles y las cuentas que el administrador no ve.',
   true)
on conflict (slug) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      es_sistema = true;

-- acceso total: todos los permisos que existan
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r cross join public.permiso p
where r.slug = 'superadmin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Helpers
--
--    Todos security definer: las políticas RLS los llaman fila por fila, así
--    que no pueden depender de RLS ellos mismos (sería recursión infinita).
-- ---------------------------------------------------------------------------

/** ¿Quien está conectado es superadmin? */
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuario_rol ur
      join public.rol r     on r.id = ur.rol_id and r.slug = 'superadmin' and r.activo
      join public.perfil pe on pe.id = ur.perfil_id and pe.activo
     where ur.perfil_id = auth.uid()
  );
$$;

/** ¿Esta persona es superadmin? (para esconderla de los demás) */
create or replace function public.perfil_es_superadmin(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuario_rol ur
      join public.rol r on r.id = ur.rol_id and r.slug = 'superadmin'
     where ur.perfil_id = p_perfil
  );
$$;

/** ¿Este rol es el reservado? */
create or replace function public.rol_es_superadmin(p_rol bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.rol r where r.id = p_rol and r.slug = 'superadmin');
$$;

/** Lo que se puede ver: o sos superadmin, o el rol no es el reservado. */
create or replace function public.puede_ver_rol(p_rol bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin() or not public.rol_es_superadmin(p_rol);
$$;

/** Ídem para personas. */
create or replace function public.puede_ver_perfil(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin() or not public.perfil_es_superadmin(p_perfil);
$$;

-- ---------------------------------------------------------------------------
-- 3. Políticas: reemplazan a las que genera la 0015 para estas cuatro tablas
-- ---------------------------------------------------------------------------

-- rol -----------------------------------------------------------------------
drop policy if exists rol_panel_lectura on public.rol;
create policy rol_panel_lectura on public.rol
  for select to authenticated
  using (public.tiene_permiso('rol.ver')
         and (public.es_superadmin() or slug <> 'superadmin'));

drop policy if exists rol_panel_escritura on public.rol;
create policy rol_panel_escritura on public.rol
  for all to authenticated
  using (public.tiene_permiso('rol.editar')
         and (public.es_superadmin() or slug <> 'superadmin'))
  with check (public.tiene_permiso('rol.editar')
         and (public.es_superadmin() or slug <> 'superadmin'));

-- rol_permiso ---------------------------------------------------------------
drop policy if exists rol_permiso_panel_lectura on public.rol_permiso;
create policy rol_permiso_panel_lectura on public.rol_permiso
  for select to authenticated
  using (public.tiene_permiso('rol.ver') and public.puede_ver_rol(rol_id));

drop policy if exists rol_permiso_panel_escritura on public.rol_permiso;
create policy rol_permiso_panel_escritura on public.rol_permiso
  for all to authenticated
  using (public.tiene_permiso('rol.editar') and public.puede_ver_rol(rol_id))
  with check (public.tiene_permiso('rol.editar') and public.puede_ver_rol(rol_id));

-- usuario_rol ---------------------------------------------------------------
-- se esconde por los dos lados: ni el rol reservado ni la persona que lo tiene
drop policy if exists usuario_rol_panel_lectura on public.usuario_rol;
create policy usuario_rol_panel_lectura on public.usuario_rol
  for select to authenticated
  using (public.tiene_permiso('usuario.ver')
         and public.puede_ver_rol(rol_id)
         and public.puede_ver_perfil(perfil_id));

drop policy if exists usuario_rol_panel_escritura on public.usuario_rol;
create policy usuario_rol_panel_escritura on public.usuario_rol
  for all to authenticated
  using (public.tiene_permiso('usuario.editar')
         and public.puede_ver_rol(rol_id)
         and public.puede_ver_perfil(perfil_id))
  with check (public.tiene_permiso('usuario.editar')
         and public.puede_ver_rol(rol_id)
         and public.puede_ver_perfil(perfil_id));

-- perfil --------------------------------------------------------------------
drop policy if exists perfil_propio on public.perfil;
create policy perfil_propio on public.perfil
  for select to authenticated
  using (id = auth.uid()
         or (public.tiene_permiso('usuario.ver') and public.puede_ver_perfil(id)));

drop policy if exists perfil_editar_propio on public.perfil;
create policy perfil_editar_propio on public.perfil
  for update to authenticated
  using (id = auth.uid()
         or (public.tiene_permiso('usuario.editar') and public.puede_ver_perfil(id)))
  with check (id = auth.uid()
         or (public.tiene_permiso('usuario.editar') and public.puede_ver_perfil(id)));

drop policy if exists perfil_baja on public.perfil;
create policy perfil_baja on public.perfil
  for delete to authenticated
  using (public.tiene_permiso('usuario.editar') and public.puede_ver_perfil(id));

-- bitácora ------------------------------------------------------------------
-- lo que hizo el superadmin tampoco se le muestra al admin
drop policy if exists bitacora_lectura on public.bitacora;
create policy bitacora_lectura on public.bitacora
  for select to authenticated
  using (public.tiene_permiso('bitacora.ver')
         and (perfil_id is null or public.puede_ver_perfil(perfil_id)));

-- ---------------------------------------------------------------------------
-- 4. Las vistas del panel son security definer: el filtro va adentro
-- ---------------------------------------------------------------------------
create or replace view public.v_usuario_admin as
select
  pe.id,
  pe.nombre,
  coalesce(pe.email, u.email)                    as email,
  pe.telefono,
  pe.activo,
  pe.created_at,
  u.last_sign_in_at                              as ultimo_acceso,
  (u.email_confirmed_at is not null)             as confirmado,
  coalesce(
    (select array_agg(r.nombre order by r.nombre)
       from public.usuario_rol ur
       join public.rol r on r.id = ur.rol_id
      where ur.perfil_id = pe.id),
    '{}'::text[]
  )                                              as roles,
  exists (
    select 1 from public.usuario_rol ur
    join public.rol r on r.id = ur.rol_id and r.slug in ('admin','superadmin')
    where ur.perfil_id = pe.id
  )                                              as es_admin,
  (select count(distinct p.codigo)
     from public.usuario_rol ur
     join public.rol r          on r.id = ur.rol_id and r.activo
     join public.rol_permiso rp on rp.rol_id = r.id
     join public.permiso p      on p.id = rp.permiso_id
    where ur.perfil_id = pe.id)                  as permisos
from public.perfil pe
join auth.users u on u.id = pe.id
where public.tiene_permiso('usuario.ver')
  and public.puede_ver_perfil(pe.id);

comment on view public.v_usuario_admin is
  'Personas del panel. Filtra por usuario.ver y esconde a los superadmin de quien no lo es.';

create or replace view public.v_rol_admin as
select
  r.id,
  r.nombre,
  r.slug,
  r.descripcion,
  r.es_sistema,
  r.activo,
  (select count(*) from public.rol_permiso rp where rp.rol_id = r.id)  as permisos,
  (select count(*) from public.usuario_rol ur where ur.rol_id = r.id)  as usuarios
from public.rol r
where public.tiene_permiso('rol.ver')
  and public.puede_ver_rol(r.id);

comment on view public.v_rol_admin is
  'Roles con su alcance. Filtra por rol.ver y esconde el rol superadmin de quien no lo es.';

-- v_rol_permiso es security_invoker: hereda las políticas de rol y rol_permiso,
-- así que el rol reservado ya no aparece en la matriz. No hace falta tocarla.

-- ---------------------------------------------------------------------------
-- 5. Candados actualizados
-- ---------------------------------------------------------------------------

/** El superadmin cuenta como administrador para la regla de "no quedarse sin". */
create or replace function public.cantidad_admins()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct pe.id)::integer
    from public.usuario_rol ur
    join public.rol r     on r.id = ur.rol_id and r.slug in ('admin','superadmin') and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo;
$$;

/** Ni admin ni superadmin pierden permisos: son los dos roles que abren la puerta. */
create or replace function public.tg_proteger_permisos_admin()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.rol r
              where r.id = old.rol_id and r.slug in ('admin','superadmin')) then
    raise exception 'El rol % no puede perder permisos',
      (select nombre from public.rol where id = old.rol_id) using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_permisos_admin on public.rol_permiso;
create trigger proteger_permisos_admin
  before delete on public.rol_permiso
  for each row execute function public.tg_proteger_permisos_admin();

/**
 * Mismo candado del último admin, ahora contando también al superadmin.
 *
 * Ojo con el conteo: lo que importa no es cuánta gente administra HOY, sino
 * cuánta va a quedar DESPUÉS de este borrado. Si alguien tiene los dos roles,
 * quitarle uno no deja a nadie afuera y no hay por qué frenarlo.
 */
create or replace function public.tg_proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quedan integer;
begin
  if not exists (select 1 from public.rol r
                  where r.id = old.rol_id and r.slug in ('admin','superadmin')) then
    return old;
  end if;

  if old.perfil_id = auth.uid() then
    raise exception 'No podés quitarte a vos mismo el rol que te deja administrar: pedíselo a otro administrador'
      using errcode = '22023';
  end if;

  select count(distinct pe.id) into v_quedan
    from public.usuario_rol ur
    join public.rol r     on r.id = ur.rol_id and r.slug in ('admin','superadmin') and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo
   where not (ur.perfil_id = old.perfil_id and ur.rol_id = old.rol_id);

  if v_quedan = 0 then
    raise exception 'Es el único administrador activo: nombrá a otro antes de quitarle el rol'
      using errcode = '22023';
  end if;

  return old;
end;
$$;

/** Ídem al desactivar una persona: lo que cuenta es quién queda después. */
create or replace function public.tg_proteger_perfil_activo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quedan integer;
begin
  if old.activo and not new.activo then
    if old.id = auth.uid() then
      raise exception 'No podés desactivar tu propia cuenta' using errcode = '22023';
    end if;

    select count(distinct pe.id) into v_quedan
      from public.usuario_rol ur
      join public.rol r     on r.id = ur.rol_id and r.slug in ('admin','superadmin') and r.activo
      join public.perfil pe on pe.id = ur.perfil_id and pe.activo
     where pe.id <> old.id;

    if v_quedan = 0 and exists (
      select 1 from public.usuario_rol ur
      join public.rol r on r.id = ur.rol_id and r.slug in ('admin','superadmin')
      where ur.perfil_id = old.id
    ) then
      raise exception 'Es el único administrador activo: nombrá a otro antes de desactivarlo'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_perfil_activo on public.perfil;
create trigger proteger_perfil_activo
  before update on public.perfil
  for each row execute function public.tg_proteger_perfil_activo();

drop trigger if exists proteger_ultimo_admin on public.usuario_rol;
create trigger proteger_ultimo_admin
  before delete on public.usuario_rol
  for each row execute function public.tg_proteger_ultimo_admin();

/** La matriz de permisos no aplica a los dos roles que siempre tienen todo. */
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
  if v_slug in ('admin', 'superadmin') then
    raise exception 'Ese rol siempre tiene todos los permisos' using errcode = '22023';
  end if;
  -- el rol reservado no se toca desde una sesión que ni siquiera debería verlo
  if not public.puede_ver_rol(p_rol_id) then
    raise exception 'El rol % no existe', p_rol_id using errcode = '22023';
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

/** Los permisos nuevos de una migración futura caen solos en los dos roles. */
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
     where r.slug in ('admin', 'superadmin')
       and not exists (select 1 from public.rol_permiso rp
                        where rp.rol_id = r.id and rp.permiso_id = p.id)
    returning 1
  )
  select count(*)::integer from nuevos;
$$;

select public.sincronizar_permisos_admin();

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.es_superadmin()               from public, anon;
revoke all on function public.perfil_es_superadmin(uuid)    from public, anon;
revoke all on function public.rol_es_superadmin(bigint)     from public, anon;
revoke all on function public.puede_ver_rol(bigint)         from public, anon;
revoke all on function public.puede_ver_perfil(uuid)        from public, anon;
grant execute on function public.es_superadmin()            to authenticated;
grant execute on function public.perfil_es_superadmin(uuid) to authenticated;
grant execute on function public.rol_es_superadmin(bigint)  to authenticated;
grant execute on function public.puede_ver_rol(bigint)      to authenticated;
grant execute on function public.puede_ver_perfil(uuid)     to authenticated;

revoke all on public.v_usuario_admin from anon, authenticated;
revoke all on public.v_rol_admin     from anon, authenticated;
grant select on public.v_usuario_admin to authenticated;
grant select on public.v_rol_admin     to authenticated;
revoke truncate, trigger, references on public.v_usuario_admin, public.v_rol_admin
  from anon, authenticated;
