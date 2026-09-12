-- =============================================================================
-- Detalles Elena · 0001 · Tipos, extensiones y utilidades comunes
-- =============================================================================
-- Convenciones del proyecto:
--   * Todo en el esquema public, nombres en snake_case y en español.
--   * Claves primarias bigint identity (legibles: "pedido 456").
--   * Dinero: numeric(10,2) en bolivianos (Bs). Nunca float.
--   * Toda tabla lleva created_at / updated_at con trigger.
--   * RLS activo en todas las tablas (ver 0004).
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- Enumerados
-- ---------------------------------------------------------------------------
do $$ begin
  create type estado_publicacion as enum ('borrador','activo','agotado','temporada','inactivo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum ('nuevo','enviado_whatsapp','confirmado','en_produccion','listo','entregado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_entrega as enum ('recojo_tienda','envio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_item_pedido as enum ('producto','extra','personalizado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- slug: "Ramo Abanico XS con 1 girasol" -> "ramo-abanico-xs-con-1-girasol"
-- ---------------------------------------------------------------------------
create or replace function public.slugify(p_texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
           regexp_replace(
             lower(public.unaccent(coalesce(p_texto,''))),
             '[^a-z0-9]+', '-', 'g'
           )
         );
$$;

-- ---------------------------------------------------------------------------
-- Normalización de teléfono boliviano: deja solo dígitos
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_telefono(p_tel text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_tel,''), '[^0-9]', '', 'g'), '');
$$;
