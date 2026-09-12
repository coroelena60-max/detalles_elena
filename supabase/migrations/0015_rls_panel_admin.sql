-- =============================================================================
-- Detalles Elena · 0015 · RLS y permisos del panel admin
--   Regla de oro: `anon` (el catálogo web) no gana un solo permiso nuevo acá.
--   Todo lo del panel es para `authenticated`, y cada tabla pide un permiso
--   concreto vía public.tiene_permiso(). Sin rol asignado, un usuario logueado
--   no ve nada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS activo en todo lo nuevo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfil','rol','permiso','rol_permiso','usuario_rol','bitacora',
    'proveedor','insumo','compra','compra_item',
    'movimiento_inventario','parametro',
    'extra_insumo','envoltorio_insumo','producto_insumo','pago'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Políticas por tabla: [tabla, permiso para leer, permiso para escribir]
-- ---------------------------------------------------------------------------
do $$
declare
  m text[];
  mapa text[][] := array[
    -- administración
    ['rol',                   'rol.ver',        'rol.editar'],
    ['permiso',               'rol.ver',        'rol.editar'],
    ['rol_permiso',           'rol.ver',        'rol.editar'],
    ['usuario_rol',           'usuario.ver',    'usuario.editar'],
    -- compras
    ['proveedor',             'proveedor.ver',  'proveedor.editar'],
    ['insumo',                'insumo.ver',     'insumo.editar'],
    ['compra',                'compra.ver',     'compra.editar'],
    ['compra_item',           'compra.ver',     'compra.editar'],
    -- inventario
    ['movimiento_inventario', 'inventario.ver', 'inventario.editar'],
    -- producción y costos
    ['extra_insumo',          'maestro.ver',    'maestro.editar'],
    ['envoltorio_insumo',     'maestro.ver',    'maestro.editar'],
    ['producto_insumo',       'maestro.ver',    'maestro.editar'],
    ['parametro',             'maestro.ver',    'maestro.editar'],
    -- ventas
    ['pago',                  'venta.ver',      'pago.registrar'],
    -- maestro del catálogo (ya tienen su política de lectura pública)
    ['categoria',             'maestro.ver',    'maestro.editar'],
    ['estilo',                'maestro.ver',    'maestro.editar'],
    ['tamano',                'maestro.ver',    'maestro.editar'],
    ['envoltorio',            'maestro.ver',    'maestro.editar'],
    ['extra_categoria',       'maestro.ver',    'maestro.editar'],
    ['extra',                 'maestro.ver',    'maestro.editar'],
    ['producto',              'maestro.ver',    'maestro.editar'],
    ['producto_imagen',       'maestro.ver',    'maestro.editar'],
    ['producto_extra',        'maestro.ver',    'maestro.editar'],
    ['zona_envio',            'maestro.ver',    'maestro.editar'],
    -- ventas: pedidos y clientes
    ['cliente',               'cliente.ver',    'cliente.editar'],
    ['pedido',                'venta.ver',      'venta.editar'],
    ['pedido_item',           'venta.ver',      'venta.editar'],
    ['pedido_item_extra',     'venta.ver',      'venta.editar'],
    ['entrega',               'venta.ver',      'venta.editar']
  ];
begin
  foreach m slice 1 in array mapa
  loop
    execute format('drop policy if exists %I on public.%I', m[1] || '_panel_lectura', m[1]);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.tiene_permiso(%L))',
      m[1] || '_panel_lectura', m[1], m[2]);

    execute format('drop policy if exists %I on public.%I', m[1] || '_panel_escritura', m[1]);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.tiene_permiso(%L)) with check (public.tiene_permiso(%L))',
      m[1] || '_panel_escritura', m[1], m[3], m[3]);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Perfil y bitácora: reglas propias
-- ---------------------------------------------------------------------------
drop policy if exists perfil_propio on public.perfil;
create policy perfil_propio on public.perfil
  for select to authenticated
  using (id = auth.uid() or public.tiene_permiso('usuario.ver'));

drop policy if exists perfil_editar_propio on public.perfil;
create policy perfil_editar_propio on public.perfil
  for update to authenticated
  using (id = auth.uid() or public.tiene_permiso('usuario.editar'))
  with check (id = auth.uid() or public.tiene_permiso('usuario.editar'));

drop policy if exists perfil_alta on public.perfil;
create policy perfil_alta on public.perfil
  for insert to authenticated
  with check (public.tiene_permiso('usuario.editar'));

drop policy if exists perfil_baja on public.perfil;
create policy perfil_baja on public.perfil
  for delete to authenticated
  using (public.tiene_permiso('usuario.editar'));

-- la bitácora se lee, no se edita: la escriben las funciones security definer
drop policy if exists bitacora_lectura on public.bitacora;
create policy bitacora_lectura on public.bitacora
  for select to authenticated
  using (public.tiene_permiso('bitacora.ver'));

-- ---------------------------------------------------------------------------
-- 4. Grants: la tabla se abre a authenticated, RLS decide fila por fila
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfil','rol','permiso','rol_permiso','usuario_rol',
    'proveedor','insumo','compra','compra_item',
    'movimiento_inventario','parametro',
    'extra_insumo','envoltorio_insumo','producto_insumo','pago',
    'categoria','estilo','tamano','envoltorio','extra_categoria','extra',
    'producto','producto_imagen','producto_extra','zona_envio',
    'cliente','pedido','pedido_item','pedido_item_extra','entrega'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  grant select on public.bitacora to authenticated;
end $$;

-- secuencias de las tablas con identity
do $$
declare s record;
begin
  for s in
    select sequence_schema, sequence_name
      from information_schema.sequences where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence %I.%I to authenticated',
                   s.sequence_schema, s.sequence_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Vistas del panel (solo authenticated; el catálogo usa v_catalogo_producto)
-- ---------------------------------------------------------------------------
do $$
declare v text;
begin
  foreach v in array array[
    'v_existencia_insumo','v_existencia_extra','v_existencia_producto','v_stock_bajo',
    'v_costo_extra','v_costo_envoltorio','v_costo_producto','v_margen_producto',
    'v_pedido_saldo','v_reporte_ventas_dia','v_reporte_ventas_mes',
    'v_reporte_producto_vendido','v_reporte_extra_vendido','v_reporte_compras_mes',
    'v_reporte_consumo_insumo','v_tablero_admin'
  ]
  loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- La vista del catálogo hereda todos los privilegios por defecto del esquema:
-- anon solo debe poder leerla.
revoke insert, update, delete, truncate on public.v_catalogo_producto from anon, authenticated;
grant select on public.v_catalogo_producto to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funciones del panel: nunca para anon
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.tiene_permiso(text)',
    'public.es_admin()',
    'public.mis_permisos()',
    'public.registrar_movimiento(tipo_item_inventario,bigint,tipo_movimiento,numeric,text,numeric,text)',
    'public.recibir_compra(bigint)',
    'public.registrar_salida_pedido(bigint)',
    'public.recalcular_compra(bigint)',
    'public.costear_configuracion(bigint,jsonb)',
    'public.producir_extra(bigint,numeric)',
    'public.recalcular_pedido(bigint)',
    'public.registrar_pago(bigint,numeric,metodo_pago,text,text)',
    'public.cambiar_estado_pedido(bigint,estado_pedido,text)',
    'public.crear_venta_mostrador(jsonb,jsonb,text)',
    'public.parametro_valor(text,numeric)',
    'public.redondear_a_5(numeric)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- asignar_rol es de administración pura: solo service_role (o el SQL Editor)
revoke all on function public.asignar_rol(text,text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Bitácora automática en lo que importa auditar
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['producto','extra','envoltorio','insumo','compra',
                           'pedido','pago','usuario_rol','rol_permiso','parametro']
  loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function public.tg_bitacora()', t);
  end loop;
end $$;
