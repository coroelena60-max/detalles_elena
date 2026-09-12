-- =============================================================================
-- Detalles Elena · 0019 · Usuarios del panel
--   Lo que le falta a la pantalla de administración: las dos vistas que lista
--   (personas y roles) y los candados para que nadie se deje afuera.
--
--   La 0017 ya protegió el CATÁLOGO de permisos (fijo) y los roles de sistema.
--   Acá se protege lo otro que puede dejar la casa cerrada por dentro:
--   quedarse sin ningún administrador activo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Candados
-- ---------------------------------------------------------------------------

/** Cuántas personas activas tienen hoy el rol admin. */
create or replace function public.cantidad_admins()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.usuario_rol ur
    join public.rol r    on r.id = ur.rol_id and r.slug = 'admin' and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo;
$$;

/**
 * Sacar un rol: dos reglas.
 *   - nadie se quita a sí mismo el admin (que lo haga otro admin, a propósito);
 *   - el último admin activo no se puede quitar, o nadie vuelve a entrar.
 */
create or replace function public.tg_proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rol r where r.id = old.rol_id and r.slug = 'admin') then
    return old;
  end if;

  if old.perfil_id = auth.uid() then
    raise exception 'No podés quitarte a vos mismo el rol Administrador: pedíselo a otro administrador'
      using errcode = '22023';
  end if;

  if public.cantidad_admins() <= 1 then
    raise exception 'Es el único administrador activo: nombrá a otro antes de quitarle el rol'
      using errcode = '22023';
  end if;

  return old;
end;
$$;

drop trigger if exists proteger_ultimo_admin on public.usuario_rol;
create trigger proteger_ultimo_admin
  before delete on public.usuario_rol
  for each row execute function public.tg_proteger_ultimo_admin();

/**
 * Desactivar una persona es sacarle la entrada al panel. Mismas dos reglas,
 * más la obvia: nadie se desactiva a sí mismo.
 */
create or replace function public.tg_proteger_perfil_activo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.activo and not new.activo then
    if old.id = auth.uid() then
      raise exception 'No podés desactivar tu propia cuenta' using errcode = '22023';
    end if;

    if exists (
      select 1
        from public.usuario_rol ur
        join public.rol r on r.id = ur.rol_id and r.slug = 'admin'
       where ur.perfil_id = old.id
    ) and public.cantidad_admins() <= 1 then
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

-- ---------------------------------------------------------------------------
-- 2. Vistas de la pantalla
--
--    Van en security definer (el default de una vista) y filtran por permiso
--    adentro: necesitan leer auth.users, al que `authenticated` no llega, y
--    tienen que contar usuarios de un rol aunque quien mire solo tenga rol.ver.
-- ---------------------------------------------------------------------------

/** Las personas del panel, con sus roles y su última entrada. */
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
    join public.rol r on r.id = ur.rol_id and r.slug = 'admin'
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
where public.tiene_permiso('usuario.ver');

comment on view public.v_usuario_admin is
  'Personas del panel para la pantalla de administración. Filtra por usuario.ver.';

/** Los roles, con cuánta gente los usa y cuántos permisos abarcan. */
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
where public.tiene_permiso('rol.ver');

comment on view public.v_rol_admin is
  'Roles con su alcance y cuánta gente los tiene. Filtra por rol.ver.';

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------
revoke all on public.v_usuario_admin from anon, authenticated;
revoke all on public.v_rol_admin     from anon, authenticated;
grant select on public.v_usuario_admin to authenticated;
grant select on public.v_rol_admin     to authenticated;

revoke all on function public.cantidad_admins() from public, anon;
grant execute on function public.cantidad_admins() to authenticated;

-- las vistas nuevas tampoco heredan privilegios de más (ver 0018)
revoke truncate, trigger, references on public.v_usuario_admin, public.v_rol_admin
  from anon, authenticated;
