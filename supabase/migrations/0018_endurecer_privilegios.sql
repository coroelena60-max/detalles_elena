-- =============================================================================
-- Detalles Elena · 0018 · Endurecer privilegios heredados
--
--   Supabase crea el esquema public con `grant all on tables to anon,
--   authenticated`. Eso incluye TRUNCATE, TRIGGER y REFERENCES, que los
--   `grant select` de las migraciones anteriores nunca quitaron.
--
--   TRUNCATE es el peligroso: **no respeta RLS**. Con la clave publicable
--   (que viaja en el navegador) el rol anon tenía derecho de truncar
--   `producto`, `pedido` y `cliente`. No hay un endpoint de PostgREST que lo
--   dispare hoy, pero es un privilegio que nadie necesita y que convierte
--   cualquier otro fallo en pérdida total de datos.
--
--   TRIGGER también sobra: permite colgar un trigger propio de una tabla.
--
--   Esta migración es idempotente y no toca los grants legítimos
--   (select para anon, CRUD para authenticated: eso lo sigue filtrando RLS).
-- =============================================================================

do $$
declare
  r record;
begin
  -- tablas y vistas del esquema public
  for r in
    select c.relname, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v','m','p')
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated',
                   r.relname);
  end loop;
end $$;

-- que las tablas y vistas futuras tampoco los hereden
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- anon no necesita ejecutar nada que no esté explícitamente permitido
-- (crear_pedido y marcar_pedido_enviado_whatsapp se le vuelven a otorgar en 0005)
revoke all on schema public from anon;
grant usage on schema public to anon;
