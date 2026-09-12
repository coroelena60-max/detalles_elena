-- =============================================================================
-- Detalles Elena · 0005 · Row Level Security y permisos
--
-- Principio: con la clave pública (anon) SOLO se puede LEER el catálogo
-- publicado y CREAR un pedido a través de la función crear_pedido().
-- Nadie puede leer pedidos ni datos de clientes desde el navegador.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS activo en todo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categoria','estilo','tamano','envoltorio','extra_categoria','extra',
    'producto','producto_imagen','producto_extra',
    'cliente','zona_envio','pedido','pedido_item','pedido_item_extra','entrega']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Lectura pública del catálogo publicado
-- ---------------------------------------------------------------------------
drop policy if exists categoria_lectura_publica on public.categoria;
create policy categoria_lectura_publica on public.categoria
  for select to anon, authenticated using (activa);

drop policy if exists estilo_lectura_publica on public.estilo;
create policy estilo_lectura_publica on public.estilo
  for select to anon, authenticated using (activo);

drop policy if exists tamano_lectura_publica on public.tamano;
create policy tamano_lectura_publica on public.tamano
  for select to anon, authenticated using (activo);

drop policy if exists envoltorio_lectura_publica on public.envoltorio;
create policy envoltorio_lectura_publica on public.envoltorio
  for select to anon, authenticated using (activo);

drop policy if exists extra_categoria_lectura_publica on public.extra_categoria;
create policy extra_categoria_lectura_publica on public.extra_categoria
  for select to anon, authenticated using (activa);

drop policy if exists extra_lectura_publica on public.extra;
create policy extra_lectura_publica on public.extra
  for select to anon, authenticated using (estado in ('activo','agotado','temporada'));

drop policy if exists producto_lectura_publica on public.producto;
create policy producto_lectura_publica on public.producto
  for select to anon, authenticated using (estado in ('activo','agotado','temporada'));

drop policy if exists producto_imagen_lectura_publica on public.producto_imagen;
create policy producto_imagen_lectura_publica on public.producto_imagen
  for select to anon, authenticated using (
    exists (select 1 from public.producto p
             where p.id = producto_imagen.producto_id
               and p.estado in ('activo','agotado','temporada'))
  );

drop policy if exists producto_extra_lectura_publica on public.producto_extra;
create policy producto_extra_lectura_publica on public.producto_extra
  for select to anon, authenticated using (
    exists (select 1 from public.producto p
             where p.id = producto_extra.producto_id
               and p.estado in ('activo','agotado','temporada'))
  );

drop policy if exists zona_envio_lectura_publica on public.zona_envio;
create policy zona_envio_lectura_publica on public.zona_envio
  for select to anon, authenticated using (activa);

-- ---------------------------------------------------------------------------
-- 3. Pedidos y clientes: sin políticas para anon.
--    RLS sin política = nada. Solo entran por crear_pedido() (security definer)
--    y los lee el panel admin con service_role / políticas propias (fase 2).
-- ---------------------------------------------------------------------------
revoke insert, update, delete on
  public.categoria, public.estilo, public.tamano, public.envoltorio,
  public.extra_categoria, public.extra, public.producto,
  public.producto_imagen, public.producto_extra, public.zona_envio
from anon;

revoke select, insert, update, delete on
  public.cliente, public.pedido, public.pedido_item,
  public.pedido_item_extra, public.entrega
from anon;

-- ---------------------------------------------------------------------------
-- 4. Funciones expuestas al catálogo web
-- ---------------------------------------------------------------------------
revoke all on function public.crear_pedido(jsonb,jsonb,jsonb,text) from public;
grant execute on function public.crear_pedido(jsonb,jsonb,jsonb,text) to anon, authenticated;

revoke all on function public.marcar_pedido_enviado_whatsapp(text) from public;
grant execute on function public.marcar_pedido_enviado_whatsapp(text) to anon, authenticated;

grant select on public.v_catalogo_producto to anon, authenticated;
