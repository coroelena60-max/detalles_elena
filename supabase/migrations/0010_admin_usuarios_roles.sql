-- =============================================================================
-- Detalles Elena · 0010 · Módulo de administración
--   Usuarios, roles, permisos y bitácora del panel admin.
--
--   La identidad la maneja Supabase Auth (auth.users). Acá vive el PERFIL
--   (datos de la persona dentro de la tienda) y el control de acceso por
--   permisos. El catálogo web es anónimo y no toca nada de esto.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- perfil: 1 a 1 con auth.users. Se crea solo cuando alguien se registra.
-- ---------------------------------------------------------------------------
create table if not exists public.perfil (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text        not null default '',
  telefono   text,
  email      text,
  activo     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfil_telefono_ck check (telefono is null or telefono ~ '^[0-9]{7,15}$')
);

comment on table public.perfil is
  'Persona que usa el panel admin. Se crea automáticamente al registrarse en Auth.';

-- ---------------------------------------------------------------------------
-- rol: admin, vendedor, producción… es_sistema = no se puede borrar.
-- ---------------------------------------------------------------------------
create table if not exists public.rol (
  id          bigint generated always as identity primary key,
  nombre      text        not null,
  slug        text        not null,
  descripcion text,
  es_sistema  boolean     not null default false,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint rol_nombre_uk unique (nombre),
  constraint rol_slug_uk   unique (slug)
);

-- ---------------------------------------------------------------------------
-- permiso: código estable 'modulo.accion'. El panel pregunta por el código,
--   nunca por el id, así se pueden agregar permisos sin migrar datos.
-- ---------------------------------------------------------------------------
create table if not exists public.permiso (
  id          bigint generated always as identity primary key,
  codigo      text        not null,
  modulo      text        not null,
  descripcion text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint permiso_codigo_uk unique (codigo),
  constraint permiso_codigo_ck check (codigo ~ '^[a-z_]+\.[a-z_]+$')
);

create table if not exists public.rol_permiso (
  rol_id     bigint not null references public.rol (id)     on delete cascade,
  permiso_id bigint not null references public.permiso (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (rol_id, permiso_id)
);

create table if not exists public.usuario_rol (
  perfil_id  uuid   not null references public.perfil (id) on delete cascade,
  rol_id     bigint not null references public.rol (id)    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, rol_id)
);
create index if not exists usuario_rol_rol_idx on public.usuario_rol (rol_id);

-- ---------------------------------------------------------------------------
-- bitácora: quién hizo qué. datos_antes/datos_despues como jsonb para no
--   tener una tabla por entidad.
-- ---------------------------------------------------------------------------
create table if not exists public.bitacora (
  id             bigint generated always as identity primary key,
  perfil_id      uuid        references public.perfil (id) on delete set null,
  accion         text        not null,           -- insert | update | delete | login | ...
  entidad        text        not null,           -- nombre de la tabla o del proceso
  entidad_id     text,
  datos_antes    jsonb,
  datos_despues  jsonb,
  nota           text,
  created_at     timestamptz not null default now()
);
create index if not exists bitacora_fecha_idx   on public.bitacora (created_at desc);
create index if not exists bitacora_entidad_idx on public.bitacora (entidad, entidad_id);
create index if not exists bitacora_perfil_idx  on public.bitacora (perfil_id);

-- ---------------------------------------------------------------------------
-- Alta automática del perfil al registrarse en Auth
-- ---------------------------------------------------------------------------
create or replace function public.tg_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil (id, nombre, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'nombre'), ''),
             nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
             split_part(coalesce(new.email,''), '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.tg_crear_perfil();

-- ---------------------------------------------------------------------------
-- Helpers de autorización. Son security definer y stable: las políticas RLS
--   las llaman en cada fila, así que no pueden depender de RLS ellas mismas.
-- ---------------------------------------------------------------------------
create or replace function public.tiene_permiso(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_rol ur
    join public.rol r          on r.id = ur.rol_id and r.activo
    join public.rol_permiso rp on rp.rol_id = r.id
    join public.permiso p      on p.id = rp.permiso_id
    join public.perfil pe      on pe.id = ur.perfil_id and pe.activo
    where ur.perfil_id = auth.uid()
      and p.codigo = p_codigo
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_rol ur
    join public.rol r     on r.id = ur.rol_id and r.activo
    join public.perfil pe on pe.id = ur.perfil_id and pe.activo
    where ur.perfil_id = auth.uid()
      and r.slug = 'admin'
  );
$$;

/** Permisos del usuario conectado: el panel los pide una vez al entrar. */
create or replace function public.mis_permisos()
returns table (codigo text, modulo text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.codigo, p.modulo
  from public.usuario_rol ur
  join public.rol r          on r.id = ur.rol_id and r.activo
  join public.rol_permiso rp on rp.rol_id = r.id
  join public.permiso p      on p.id = rp.permiso_id
  join public.perfil pe      on pe.id = ur.perfil_id and pe.activo
  where ur.perfil_id = auth.uid()
  order by p.modulo, p.codigo;
$$;

-- ---------------------------------------------------------------------------
-- Asignar un rol por email. Es el camino para nombrar al primer admin:
--   la persona se registra en el panel y después se corre
--   select public.asignar_rol('elena@...', 'admin');
-- ---------------------------------------------------------------------------
create or replace function public.asignar_rol(p_email text, p_rol_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid;
  v_rol    bigint;
begin
  select u.id into v_perfil from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_perfil is null then
    raise exception 'No hay ningún usuario registrado con el email %', p_email
      using errcode = '22023';
  end if;

  insert into public.perfil (id, email) values (v_perfil, lower(btrim(p_email)))
  on conflict (id) do nothing;

  select r.id into v_rol from public.rol r where r.slug = p_rol_slug;
  if v_rol is null then
    raise exception 'No existe el rol %', p_rol_slug using errcode = '22023';
  end if;

  insert into public.usuario_rol (perfil_id, rol_id) values (v_perfil, v_rol)
  on conflict do nothing;

  return format('%s ahora tiene el rol %s', p_email, p_rol_slug);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bitácora automática. Se engancha a la tabla que se quiera con:
--   create trigger auditar after insert or update or delete on <tabla>
--     for each row execute function public.tg_bitacora();
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfil','rol','permiso']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;
