-- =============================================================================
-- 0026 · Límites y candados (auditoría de seguridad del 2026-09-14)
--
-- 1. Límite de pedidos del catálogo. La clave publicable es pública: cualquiera
--    puede llamar a crear_pedido() directo por la API, sin pasar por la página.
--    El freno tiene que estar en la base. Solo aplica a llamadas SIN sesión
--    (rol anon); el panel y el SQL Editor no tienen límite.
--      · 5 pedidos por cliente (teléfono) por hora
--      · 40 pedidos del catálogo en total cada 10 minutos
-- 2. marcar_pedido_enviado_whatsapp(): los códigos son correlativos (PED-00001,
--    PED-00002…), así que cualquiera podía marcar pedidos ajenos. Ahora solo
--    sirve durante las 2 horas siguientes a crear el pedido.
-- 3. recalcular_pedido(): security definer y ejecutable por cualquier cuenta con
--    sesión, sin permiso. El panel no la llama; solo la usan otras funciones
--    (que corren como dueño), así que se le quita el acceso directo.
-- 4. recalcular_compra(): el panel sí la llama; ahora exige compra.editar a quien
--    tiene sesión (los triggers y el SQL Editor siguen igual).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Límite de pedidos del catálogo
-- ---------------------------------------------------------------------------
create index if not exists pedido_cliente_fecha_idx on public.pedido (cliente_id, created_at desc);

create or replace function public.tg_limitar_pedidos_catalogo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  -- sin claims = SQL Editor / scripts; con "sub" = alguien con sesión (el panel)
  if v_claims is null or v_claims ? 'sub' or coalesce(v_claims->>'role', '') <> 'anon' then
    return new;
  end if;

  if (select count(*) from public.pedido p
       where p.cliente_id = new.cliente_id
         and p.canal <> 'mostrador'
         and p.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Ya recibimos varios pedidos seguidos con este número. Escribinos por WhatsApp y lo armamos juntos.'
      using errcode = 'P0001';
  end if;

  if (select count(*) from public.pedido p
       where p.canal <> 'mostrador'
         and p.created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Estamos recibiendo muchos pedidos en este momento. Probá de nuevo en unos minutos o escribinos por WhatsApp.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists limitar_pedidos_catalogo on public.pedido;
create trigger limitar_pedidos_catalogo
  before insert on public.pedido
  for each row execute function public.tg_limitar_pedidos_catalogo();

-- ---------------------------------------------------------------------------
-- 2. Marcar "enviado por WhatsApp" solo para pedidos recién creados
-- ---------------------------------------------------------------------------
create or replace function public.marcar_pedido_enviado_whatsapp(p_codigo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pedido
     set estado = case when estado = 'nuevo' then 'enviado_whatsapp' else estado end,
         enviado_whatsapp_at = coalesce(enviado_whatsapp_at, now())
   where codigo = upper(btrim(p_codigo))
     and created_at > now() - interval '2 hours';
end;
$$;

revoke all on function public.marcar_pedido_enviado_whatsapp(text) from public;
grant execute on function public.marcar_pedido_enviado_whatsapp(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. recalcular_pedido: solo por dentro de otras funciones
-- ---------------------------------------------------------------------------
revoke all on function public.recalcular_pedido(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. recalcular_compra: con sesión, exige compra.editar
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_compra(p_compra_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sub numeric(12,2);
begin
  if auth.uid() is not null then
    perform public.exigir_permiso('compra.editar');
  end if;

  select coalesce(sum(subtotal), 0) into v_sub
    from public.compra_item where compra_id = p_compra_id;
  update public.compra
     set subtotal = v_sub,
         total    = greatest(v_sub - descuento, 0)
   where id = p_compra_id;
end;
$$;

revoke all on function public.recalcular_compra(bigint) from public, anon;
grant execute on function public.recalcular_compra(bigint) to authenticated;
