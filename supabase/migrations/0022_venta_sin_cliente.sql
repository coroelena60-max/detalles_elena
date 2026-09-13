-- =============================================================================
-- 0022 · Venta sin cliente
--
-- En la tienda muchas ventas son a alguien que no deja sus datos. Para eso hay
-- un cliente genérico "S/N" (sin nombre) con teléfono 0000000: la venta queda
-- colgada de él y en el panel se muestra como "S/C" (sin cliente).
--
-- - crear_venta_mostrador(p_cliente => null | {"sin_cliente": true}) lo usa.
-- - El genérico no se renombra ni se borra (trigger), así que aunque alguien
--   escriba 0000000 en el catálogo no le cambia el nombre.
-- =============================================================================

insert into public.cliente (nombre, telefono, notas)
values ('S/N', '0000000', 'Cliente genérico para ventas de mostrador sin datos del comprador.')
on conflict (telefono) do nothing;

create or replace function public.telefono_sin_cliente()
returns text language sql immutable as $$ select '0000000'::text $$;

create or replace function public.tg_proteger_cliente_generico()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.telefono = public.telefono_sin_cliente() then
      raise exception 'El cliente genérico S/N no se puede borrar' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.telefono = public.telefono_sin_cliente() then
    new.telefono := old.telefono;
    new.nombre   := 'S/N';
    new.email    := null;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_cliente_generico on public.cliente;
create trigger proteger_cliente_generico
  before update or delete on public.cliente
  for each row execute function public.tg_proteger_cliente_generico();

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

  if p_cliente is null
     or jsonb_typeof(p_cliente) <> 'object'
     or coalesce((p_cliente->>'sin_cliente')::boolean, false) then
    p_cliente := jsonb_build_object('nombre', 'S/N', 'telefono', public.telefono_sin_cliente());
  end if;

  v_res := public.crear_pedido(p_cliente, p_items, '{"tipo":"recojo_tienda"}'::jsonb, p_nota);

  update public.pedido
     set canal        = 'mostrador',
         estado       = 'confirmado',
         atendido_por = auth.uid()
   where id = (v_res->>'id')::bigint;

  return v_res || jsonb_build_object('estado', 'confirmado');
end;
$$;
