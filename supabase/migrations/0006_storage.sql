-- =============================================================================
-- Detalles Elena · 0006 · Storage de imágenes
--   Bucket público de solo lectura. La escritura la hace el panel admin
--   autenticado (o el service_role en la carga inicial).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists catalogo_lectura_publica on storage.objects;
create policy catalogo_lectura_publica on storage.objects
  for select to anon, authenticated using (bucket_id = 'catalogo');

drop policy if exists catalogo_escritura_autenticada on storage.objects;
create policy catalogo_escritura_autenticada on storage.objects
  for insert to authenticated with check (bucket_id = 'catalogo');

drop policy if exists catalogo_update_autenticada on storage.objects;
create policy catalogo_update_autenticada on storage.objects
  for update to authenticated using (bucket_id = 'catalogo');
