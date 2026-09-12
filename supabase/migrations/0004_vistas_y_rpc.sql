-- =============================================================================
-- Detalles Elena · 0004 · Vistas públicas del catálogo + RPC de creación de pedido
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Vista: catálogo público de productos (lo único que ve el cliente)
-- ---------------------------------------------------------------------------
create or replace view public.v_catalogo_producto
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  p.slug,
  p.descripcion,
  p.precio,
  p.precio_desde,
  p.destacado,
  p.lead_time_dias,
  p.estado,
  p.orden,
  c.id    as categoria_id,
  c.nombre as categoria_nombre,
  c.slug   as categoria_slug,
  e.nombre as estilo_nombre,
  t.codigo as tamano_codigo,
  t.nombre as tamano_nombre,
  env.espacios as espacios_capacidad,
  (select pi.url from public.producto_imagen pi
     where pi.producto_id = p.id
     order by pi.es_principal desc, pi.orden, pi.id
     limit 1) as imagen_principal
from public.producto p
join public.categoria c        on c.id = p.categoria_id
left join public.envoltorio env on env.id = p.envoltorio_id
left join public.estilo e       on e.id = env.estilo_id
left join public.tamano t       on t.id = env.tamano_id
where p.estado in ('activo','agotado','temporada')
  and c.activa;

comment on view public.v_catalogo_producto is
  'Catálogo público. Solo productos publicados. Usada por catalogo_web.';

-- ---------------------------------------------------------------------------
-- RPC: crear_pedido
--   Único camino por el que el catálogo web escribe en la base.
--   Recalcula TODOS los precios en el servidor: el navegador no define montos.
--   Devuelve {id, codigo, subtotal, total} para armar el mensaje de WhatsApp.
--
--   p_cliente : {"nombre":"...", "telefono":"...", "email":"..."}
--   p_entrega : {"tipo":"recojo_tienda"|"envio", "direccion":"...", ...}
--   p_items   : [
--     {"tipo":"producto","producto_id":1,"cantidad":1,"dedicatoria":"...",
--      "extras":[{"extra_id":3,"cantidad":2}]},
--     {"tipo":"extra","extra_id":5,"cantidad":3},
--     {"tipo":"personalizado","envoltorio_id":7,"cantidad":1,
--      "extras":[{"extra_id":1,"cantidad":5}]}
--   ]
-- ---------------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_cliente jsonb,
  p_items   jsonb,
  p_entrega jsonb default '{}'::jsonb,
  p_nota    text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre        text := btrim(coalesce(p_cliente->>'nombre',''));
  v_telefono      text := public.normalizar_telefono(p_cliente->>'telefono');
  v_email         text := nullif(btrim(coalesce(p_cliente->>'email','')),'');
  v_tipo_entrega  tipo_entrega;
  v_cliente_id    bigint;
  v_pedido_id     bigint;
  v_item          jsonb;
  v_extra         jsonb;
  v_tipo          tipo_item_pedido;
  v_cantidad      integer;
  v_nombre_item   text;
  v_base          numeric(10,2);
  v_extras_unit   numeric(10,2);
  v_espacios_uso  numeric(10,2);
  v_espacios_cap  numeric(10,2);
  v_item_id       bigint;
  v_subtotal      numeric(10,2) := 0;
  v_rec           record;
  v_ex            record;
  v_ext_cant      numeric(8,2);
  v_ext_sub       numeric(10,2);
begin
  -- ---- validaciones de cabecera -------------------------------------------
  if length(v_nombre) < 2 then
    raise exception 'El nombre del cliente es obligatorio' using errcode = '22023';
  end if;
  if v_telefono is null or v_telefono !~ '^[0-9]{7,15}$' then
    raise exception 'Teléfono inválido' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados items en el pedido' using errcode = '22023';
  end if;

  v_tipo_entrega := coalesce(nullif(p_entrega->>'tipo',''), 'recojo_tienda')::tipo_entrega;

  if v_tipo_entrega = 'envio'
     and length(btrim(coalesce(p_entrega->>'direccion',''))) < 5 then
    raise exception 'Para envío se requiere la dirección' using errcode = '22023';
  end if;

  -- ---- cliente (upsert por teléfono) --------------------------------------
  insert into public.cliente (nombre, telefono, email)
  values (v_nombre, v_telefono, v_email)
  on conflict (telefono) do update
     set nombre = excluded.nombre,
         email  = coalesce(excluded.email, public.cliente.email)
  returning id into v_cliente_id;

  -- ---- cabecera del pedido ------------------------------------------------
  insert into public.pedido (cliente_id, estado, tipo_entrega, nota_cliente, canal)
  values (v_cliente_id, 'nuevo', v_tipo_entrega, nullif(btrim(coalesce(p_nota,'')),''), 'catalogo_web')
  returning id into v_pedido_id;

  -- ---- items --------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_tipo     := (v_item->>'tipo')::tipo_item_pedido;
    v_cantidad := greatest(1, coalesce((v_item->>'cantidad')::integer, 1));
    if v_cantidad > 99 then
      raise exception 'Cantidad fuera de rango' using errcode = '22023';
    end if;

    v_base         := 0;
    v_extras_unit  := 0;
    v_espacios_uso := 0;
    v_espacios_cap := null;

    if v_tipo = 'producto' then
      select p.id, p.nombre, p.precio, env.espacios
        into v_rec
        from public.producto p
        left join public.envoltorio env on env.id = p.envoltorio_id
       where p.id = (v_item->>'producto_id')::bigint
         and p.estado in ('activo','temporada');
      if not found then
        raise exception 'Producto no disponible: %', v_item->>'producto_id' using errcode = '22023';
      end if;
      v_nombre_item  := v_rec.nombre;
      v_base         := v_rec.precio;
      v_espacios_cap := v_rec.espacios;

    elsif v_tipo = 'extra' then
      select e.id, e.nombre, e.precio
        into v_rec
        from public.extra e
       where e.id = (v_item->>'extra_id')::bigint
         and e.estado in ('activo','temporada');
      if not found then
        raise exception 'Extra no disponible: %', v_item->>'extra_id' using errcode = '22023';
      end if;
      v_nombre_item := v_rec.nombre;
      v_base        := v_rec.precio;

    else -- personalizado
      select env.id, env.precio_base, env.espacios,
             es.nombre || ' ' || tm.codigo as nombre
        into v_rec
        from public.envoltorio env
        join public.estilo es on es.id = env.estilo_id
        join public.tamano tm on tm.id = env.tamano_id
       where env.id = (v_item->>'envoltorio_id')::bigint
         and env.activo;
      if not found then
        raise exception 'Envoltorio no disponible: %', v_item->>'envoltorio_id' using errcode = '22023';
      end if;
      v_nombre_item  := 'Ramo personalizado ' || v_rec.nombre;
      v_base         := v_rec.precio_base;
      v_espacios_cap := v_rec.espacios;
    end if;

    insert into public.pedido_item
      (pedido_id, tipo, producto_id, extra_id, envoltorio_id,
       nombre, precio_unitario, cantidad, subtotal, dedicatoria, nota)
    values
      (v_pedido_id, v_tipo,
       case when v_tipo = 'producto' then (v_item->>'producto_id')::bigint end,
       case when v_tipo = 'extra'    then (v_item->>'extra_id')::bigint end,
       case when v_tipo = 'personalizado' then (v_item->>'envoltorio_id')::bigint end,
       v_nombre_item, v_base, v_cantidad, v_base * v_cantidad,
       nullif(btrim(coalesce(v_item->>'dedicatoria','')),''),
       nullif(btrim(coalesce(v_item->>'nota','')),''))
    returning id into v_item_id;

    -- ---- extras de la línea ----------------------------------------------
    if jsonb_typeof(coalesce(v_item->'extras','null'::jsonb)) = 'array' then
      for v_extra in select * from jsonb_array_elements(v_item->'extras')
      loop
        v_ext_cant := coalesce((v_extra->>'cantidad')::numeric, 1);
        if v_ext_cant <= 0 or v_ext_cant > 200 then
          raise exception 'Cantidad de extra fuera de rango' using errcode = '22023';
        end if;

        select e.id, e.nombre, e.precio, e.espacios
          into v_ex
          from public.extra e
         where e.id = (v_extra->>'extra_id')::bigint
           and e.estado in ('activo','temporada');
        if not found then
          raise exception 'Extra no disponible: %', v_extra->>'extra_id' using errcode = '22023';
        end if;

        v_ext_sub      := round(v_ex.precio * v_ext_cant, 2);
        v_extras_unit  := v_extras_unit + v_ext_sub;
        v_espacios_uso := v_espacios_uso + (v_ex.espacios * v_ext_cant);

        insert into public.pedido_item_extra
          (pedido_item_id, extra_id, nombre, cantidad, precio_unitario, subtotal)
        values
          (v_item_id, v_ex.id, v_ex.nombre, v_ext_cant, v_ex.precio, v_ext_sub);
      end loop;

      -- regla de la "mochila": los extras no pueden exceder la capacidad
      if v_espacios_cap is not null and v_espacios_uso > v_espacios_cap then
        raise exception 'No caben tantos extras en ese tamaño (usa % de % espacios)',
          v_espacios_uso, v_espacios_cap using errcode = '22023';
      end if;

      -- el precio unitario de la línea incluye sus extras
      update public.pedido_item
         set precio_unitario = v_base + v_extras_unit,
             subtotal        = (v_base + v_extras_unit) * v_cantidad
       where id = v_item_id;
    end if;

    v_subtotal := v_subtotal + ((v_base + v_extras_unit) * v_cantidad);
  end loop;

  -- ---- entrega ------------------------------------------------------------
  if v_tipo_entrega = 'envio' then
    insert into public.entrega
      (pedido_id, zona_envio_id, destinatario, telefono, direccion,
       referencia, fecha_entrega, franja_horaria, instrucciones)
    values
      (v_pedido_id,
       nullif(p_entrega->>'zona_envio_id','')::bigint,
       nullif(btrim(coalesce(p_entrega->>'destinatario','')),''),
       public.normalizar_telefono(p_entrega->>'telefono'),
       btrim(p_entrega->>'direccion'),
       nullif(btrim(coalesce(p_entrega->>'referencia','')),''),
       nullif(p_entrega->>'fecha_entrega','')::date,
       nullif(btrim(coalesce(p_entrega->>'franja_horaria','')),''),
       nullif(btrim(coalesce(p_entrega->>'instrucciones','')),''));
  end if;

  -- ---- totales (el envío se cotiza por WhatsApp: no se suma acá) ----------
  update public.pedido
     set subtotal = v_subtotal,
         total    = v_subtotal
   where id = v_pedido_id;

  return (
    select jsonb_build_object(
             'id', p.id,
             'codigo', p.codigo,
             'subtotal', p.subtotal,
             'total', p.total,
             'estado', p.estado
           )
    from public.pedido p where p.id = v_pedido_id
  );
end;
$$;

comment on function public.crear_pedido(jsonb,jsonb,jsonb,text) is
  'Crea el pedido del catálogo web recalculando precios en el servidor. Devuelve el código para WhatsApp.';

-- ---------------------------------------------------------------------------
-- RPC: marcar_pedido_enviado_whatsapp
--   El catálogo la llama cuando el cliente efectivamente abre WhatsApp.
--   Sirve para medir conversión (pedidos armados vs. pedidos que llegaron).
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
   where codigo = upper(btrim(p_codigo));
end;
$$;
