-- =============================================================================
-- Detalles Elena · 0007 · Carga inicial del catálogo (idempotente)
--   Datos tomados de PRECIOS.docx y de los nombres/precios de las fotos.
--   Precios en Bs. Los espacios vienen del análisis v3 (modelo de mochila).
--
--   SOLO CARGA INICIAL: cada bloque inserta únicamente si su tabla está vacía.
--   Una vez que hay datos, los maneja la dueña desde el panel y re-ejecutar
--   este archivo no puede pisarlos. (Antes cada bloque era "on conflict do
--   update": el 2026-09-13 una re-ejecución devolvió precios viejos.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
insert into public.categoria (nombre, slug, descripcion, orden, activa)
select * from (values
  ('Ramos cono',        'ramos-cono',        'Ramos armados en envoltorio cono, de chico a súper jumbo.', 1, true),
  ('Ramos abanico',     'ramos-abanico',     'Ramos armados en envoltorio abanico, de extra chico a súper jumbo.', 2, true),
  ('Carteras',          'carteras',          'Carteras de regalo con flores hechas a mano.', 3, true),
  ('Cajas y corazones', 'cajas-y-corazones', 'Cajas decoradas y cajas corazón con flores y chocolates.', 4, true)
) as v(nombre, slug, descripcion, orden, activa)
where not exists (select 1 from public.categoria)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Estilos de envoltorio
-- ---------------------------------------------------------------------------
insert into public.estilo (nombre, slug, descripcion, orden, activo)
select * from (values
  ('Cono',         'cono',         'Envoltorio cónico de papel coreano.', 1, true),
  ('Abanico',      'abanico',      'Envoltorio abierto en abanico.',      2, true),
  ('Cartera',      'cartera',      'Caja tipo cartera con asa.',          3, true),
  ('Caja corazón', 'caja-corazon', 'Caja en forma de corazón.',           4, true)
) as v(nombre, slug, descripcion, orden, activo)
where not exists (select 1 from public.estilo)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Tamaños
-- ---------------------------------------------------------------------------
insert into public.tamano (codigo, nombre, orden, activo)
select * from (values
  ('XS',   'Extra chico', 1, true),
  ('S',    'Chico',       2, true),
  ('M',    'Mediano',     3, true),
  ('L',    'Grande',      4, true),
  ('XL',   'Jumbo',       5, true),
  ('XXL',  'Súper jumbo', 6, true),
  ('XXXL', 'Mega jumbo',  7, true),
  ('U',    'Único',       8, true)
) as v(codigo, nombre, orden, activo)
where not exists (select 1 from public.tamano)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Envoltorios (precio base + capacidad en espacios)
-- ---------------------------------------------------------------------------
with datos(estilo_slug, tamano_codigo, precio_base, espacios) as (
  values
    ('cono',        'S',    20.00,  8.0),
    ('cono',        'M',    30.00, 10.0),
    ('cono',        'L',    40.00, 12.0),
    ('cono',        'XL',   50.00, 22.0),
    ('cono',        'XXL',  60.00, 28.0),
    ('cono',        'XXXL', 80.00, 40.0),
    ('abanico',     'XS',   10.00,  3.0),
    ('abanico',     'S',    15.00,  4.0),
    ('abanico',     'M',    20.00,  7.0),
    ('abanico',     'L',    25.00,  9.0),
    ('abanico',     'XL',   35.00, 12.0),
    ('abanico',     'XXL',  50.00, 24.0),
    ('cartera',     'U',    30.00, 11.0),
    ('caja-corazon','U',    80.00, 14.0)
)
insert into public.envoltorio (estilo_id, tamano_id, precio_base, espacios, activo)
select e.id, t.id, d.precio_base, d.espacios, true
from datos d
join public.estilo e on e.slug   = d.estilo_slug
join public.tamano t on t.codigo = d.tamano_codigo
where not exists (select 1 from public.envoltorio)
on conflict (estilo_id, tamano_id) do nothing;

-- ---------------------------------------------------------------------------
-- Categorías de extras
-- ---------------------------------------------------------------------------
insert into public.extra_categoria (nombre, slug, orden, activa)
select * from (values
  ('Flores',     'flores',     1, true),
  ('Follaje',    'follaje',    2, true),
  ('Accesorios', 'accesorios', 3, true),
  ('Juguetes',   'juguetes',   4, true),
  ('Peluches',   'peluches',   5, true)
) as v(nombre, slug, orden, activa)
where not exists (select 1 from public.extra_categoria)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Extras (precio de venta actual · espacios = volumen que ocupa)
--   estado 'borrador' = falta confirmar precio con Elena, no sale al catálogo.
-- ---------------------------------------------------------------------------
with datos(nombre, cat_slug, precio, espacios, estado, orden, descripcion) as (
  values
    ('Rosa',                  'flores',     4.00, 1.00,  'activo',   1, 'Rosa hecha a mano. Disponible en varios colores.'),
    ('Rosa semirealista',     'flores',     5.00, 1.00,  'activo',   2, 'Rosa semirealista hecha a mano, acabado más fino.'),
    ('Girasol',               'flores',     5.00, 2.00,  'activo',   3, 'Girasol hecho a mano.'),
    ('Margarita (3 tallos)',  'flores',     3.00, 1.00,  'activo',   4, 'Ramillete de margaritas de 3 tallos.'),
    ('Flor lirio',            'flores',     4.00, 1.50,  'activo',   5, 'Lirio hecho a mano.'),
    ('Flor limpiapipa',       'flores',     1.00, 0.50,  'activo',   6, 'Florcita de limpiapipas.'),
    ('Follaje papel de arroz','follaje',    1.00, 0.50,  'activo',   7, 'Follaje de papel de arroz.'),
    ('Follaje de hojas',      'follaje',    1.00, 0.50,  'activo',   8, 'Follaje de hojas decorativas.'),
    ('Malla',                 'follaje',    1.00, 0.50,  'activo',   9, 'Malla tul decorativa.'),
    ('Mariposa',              'accesorios', 2.00, 0.25,  'activo',  10, 'Mariposa decorativa.'),
    ('Corona',                'accesorios',15.00, 0.00,  'activo',  11, 'Corona decorativa de plástico.'),
    ('Corona metálica',       'accesorios',50.00, 0.00,  'activo',  12, 'Corona metálica.'),
    ('Tarjeta',               'accesorios', 4.00, 0.00,  'activo',  13, 'Tarjeta con dedicatoria.'),
    ('Hot Wheels',            'juguetes',  15.00, 2.00,  'activo',  14, 'Autito Hot Wheels en su caja.'),
    ('Peluche oso dormilón',  'peluches',  70.00, 8.00,  'borrador',15, 'PRECIO A CONFIRMAR. Costo 32,50 Bs; sugerido 70 Bs.'),
    ('Peluche Stitch',        'peluches', 100.00, 8.00,  'borrador',16, 'PRECIO A CONFIRMAR. Costo 50 Bs; sugerido 100 Bs.'),
    ('Luz led',               'accesorios',15.00, 0.00,  'borrador',17, 'PRECIO A CONFIRMAR. Costo 5 Bs; sugerido 15 Bs.'),
    ('Porta tarjeta',         'accesorios', 5.00, 0.00,  'borrador',18, 'PRECIO A CONFIRMAR. Costo 2 Bs; sugerido 5 Bs.')
)
insert into public.extra (extra_categoria_id, nombre, slug, descripcion, precio, espacios, estado, orden)
select ec.id, d.nombre, public.slugify(d.nombre), d.descripcion,
       d.precio, d.espacios, d.estado::estado_publicacion, d.orden
from datos d
join public.extra_categoria ec on ec.slug = d.cat_slug
where not exists (select 1 from public.extra)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- Zonas de envío (el costo final se cotiza por WhatsApp)
-- ---------------------------------------------------------------------------
insert into public.zona_envio (nombre, costo_referencia, activa)
select * from (values
  ('Cotoca',                  null::numeric, true),
  ('Santa Cruz de la Sierra', null::numeric, true),
  ('Otra zona',               null::numeric, true)
) as v(nombre, costo_referencia, activa)
where not exists (select 1 from public.zona_envio)
on conflict (nombre) do nothing;
