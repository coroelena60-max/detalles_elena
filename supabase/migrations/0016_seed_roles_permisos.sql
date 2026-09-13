-- =============================================================================
-- Detalles Elena · 0016 · Roles y permisos iniciales
--   Los códigos de permiso son el contrato con el panel: el front pregunta
--   por 'venta.editar', nunca por un id. Agregar permisos nuevos es insertar
--   filas acá, no migrar datos.
--
--   Para nombrar al primer administrador: la persona se registra en el panel
--   (Supabase Auth) y después, desde el SQL Editor:
--       select public.asignar_rol('correo@de.elena', 'admin');
-- =============================================================================

insert into public.permiso (codigo, modulo, descripcion) values
  -- administración
  ('usuario.ver',        'administracion', 'Ver los usuarios del panel'),
  ('usuario.editar',     'administracion', 'Crear, editar y desactivar usuarios'),
  ('rol.ver',            'administracion', 'Ver roles y permisos'),
  ('rol.editar',         'administracion', 'Crear roles y asignarles permisos'),
  ('bitacora.ver',       'administracion', 'Ver la bitácora de cambios'),
  -- maestro
  ('maestro.ver',        'maestro',        'Ver productos, categorías, extras y envoltorios'),
  ('maestro.editar',     'maestro',        'Crear y editar el catálogo maestro y sus recetas'),
  -- inventario
  ('inventario.ver',     'inventario',     'Ver existencias y movimientos'),
  ('inventario.editar',  'inventario',     'Registrar ajustes, mermas y producción'),
  -- compras
  ('proveedor.ver',      'compra',         'Ver proveedores'),
  ('proveedor.editar',   'compra',         'Crear y editar proveedores'),
  ('insumo.ver',         'compra',         'Ver insumos y sus costos'),
  ('insumo.editar',      'compra',         'Crear y editar insumos'),
  ('compra.ver',         'compra',         'Ver compras'),
  ('compra.editar',      'compra',         'Registrar y recibir compras'),
  -- ventas
  ('venta.ver',          'venta',          'Ver pedidos y ventas'),
  ('venta.editar',       'venta',          'Editar pedidos y cambiar su estado'),
  ('pago.registrar',     'venta',          'Registrar pagos y cobros'),
  ('cliente.ver',        'venta',          'Ver la ficha de los clientes'),
  ('cliente.editar',     'venta',          'Editar los datos de los clientes'),
  -- reportes
  ('reporte.ver',        'reporte',        'Ver los reportes de ventas, compras e inventario')
on conflict (codigo) do update
  set modulo = excluded.modulo, descripcion = excluded.descripcion;

insert into public.rol (nombre, slug, descripcion, es_sistema) values
  ('Administrador', 'admin',      'Acceso total al panel.', true),
  ('Vendedor',      'vendedor',   'Atiende pedidos, cobra y gestiona clientes.', true),
  ('Producción',    'produccion', 'Arma los pedidos y mueve el inventario del taller.', true)
-- nombre y descripción se editan desde el panel: re-ejecutar no los pisa
on conflict (slug) do update set es_sistema = true;

-- admin: todo
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r cross join public.permiso p
where r.slug = 'admin'
on conflict do nothing;

-- vendedor
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r join public.permiso p on p.codigo in (
  'venta.ver','venta.editar','pago.registrar','cliente.ver','cliente.editar',
  'maestro.ver','inventario.ver','reporte.ver'
)
where r.slug = 'vendedor'
on conflict do nothing;

-- producción
insert into public.rol_permiso (rol_id, permiso_id)
select r.id, p.id from public.rol r join public.permiso p on p.codigo in (
  'maestro.ver','maestro.editar','inventario.ver','inventario.editar',
  'insumo.ver','compra.ver','venta.ver','reporte.ver'
)
where r.slug = 'produccion'
on conflict do nothing;
