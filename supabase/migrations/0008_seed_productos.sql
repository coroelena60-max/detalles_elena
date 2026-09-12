-- =============================================================================
-- Detalles Elena · 0008 · Productos ya definidos (los 16 fotografiados)
--   Nombre y precio salen del nombre de archivo de cada foto.
--   La composición (cuántas flores lleva) sale del mismo nombre y de PRECIOS.docx.
--   'descripcion' queda con un texto base para que Elena lo edite en el panel.
-- =============================================================================

with datos(codigo, nombre, cat_slug, estilo_slug, tamano, precio,
           lead_time_dias, minutos_armado, destacado, orden, descripcion) as (
  values
    -- ---- Ramos abanico -----------------------------------------------------
    ('AB-XS-001','Ramo abanico XS con 1 girasol',                  'ramos-abanico','abanico','XS',   20.00, 1,  70, false,  1,'Ramo abanico extra chico con 1 girasol hecho a mano. Ideal para un detalle sencillo.'),
    ('AB-S-001', 'Ramo abanico S con 3 rosas',                     'ramos-abanico','abanico','S',    35.00, 1,  75, true,   2,'Ramo abanico chico con 3 rosas hechas a mano.'),
    ('AB-M-001', 'Ramo abanico M con 5 rosas',                     'ramos-abanico','abanico','M',    45.00, 1,  85, true,   3,'Ramo abanico mediano con 5 rosas hechas a mano.'),
    ('AB-M-002', 'Ramo abanico M con 3 rosas y 2 Hot Wheels',      'ramos-abanico','abanico','M',    75.00, 1,  75, false,  4,'Ramo abanico mediano con 3 rosas y 2 autitos Hot Wheels. Para niños y coleccionistas.'),
    ('AB-L-001', 'Ramo abanico L con 3 girasoles',                 'ramos-abanico','abanico','L',    55.00, 1,  90, false,  5,'Ramo abanico grande con 3 girasoles hechos a mano.'),
    ('AB-L-002', 'Ramo abanico L con 3 rosas y 3 Hot Wheels',      'ramos-abanico','abanico','L',   100.00, 1,  75, false,  6,'Ramo abanico grande con 3 rosas y 3 autitos Hot Wheels.'),
    ('AB-XL-001','Ramo abanico XL jumbo con 5 girasoles',          'ramos-abanico','abanico','XL',   85.00, 2, 170, true,   7,'Ramo abanico jumbo con 5 girasoles hechos a mano.'),
    ('AB-XXL-001','Ramo abanico XXL súper jumbo con 14 rosas y peluche oso dormilón','ramos-abanico','abanico','XXL',250.00,2,190,true,8,'Ramo abanico súper jumbo con 14 rosas hechas a mano y peluche oso dormilón. Regalo grande para fecha especial.'),
    -- ---- Ramos cono --------------------------------------------------------
    ('CO-S-001', 'Ramo cono S con 7 rosas',                        'ramos-cono','cono','S',    40.00, 1,  95, true,   9,'Ramo cono chico con 7 rosas hechas a mano.'),
    ('CO-L-001', 'Ramo cono L con 1 girasol y 8 rosas',            'ramos-cono','cono','L',    85.00, 1, 110, false, 10,'Ramo cono grande con 1 girasol y 8 rosas hechas a mano.'),
    ('CO-XL-001','Ramo cono XL con 20 rosas y 2 mariposas',        'ramos-cono','cono','XL',  140.00, 2, 160, true,  11,'Ramo cono jumbo con 20 rosas hechas a mano y 2 mariposas decorativas.'),
    ('CO-XXL-001','Ramo cono XXL jumbo con 7 girasoles',           'ramos-cono','cono','XXL', 160.00, 2, 190, false, 12,'Ramo cono súper jumbo con 7 girasoles hechos a mano.'),
    ('CO-XXXL-001','Ramo cono XXXL súper jumbo con 20 girasoles',  'ramos-cono','cono','XXXL',280.00, 3, 320, true,  13,'Ramo cono mega jumbo con 20 girasoles hechos a mano. El más grande del catálogo.'),
    -- ---- Carteras ----------------------------------------------------------
    ('CA-U-001', 'Cartera negra con 3 girasoles y 5 margaritas',   'carteras','cartera','U',    70.00, 1, 120, false, 14,'Cartera negra de regalo con 3 girasoles y 5 margaritas hechas a mano.'),
    ('CA-U-002', 'Cartera rosada con 3 girasoles y 4 rosas',       'carteras','cartera','U',    80.00, 1, 110, true,  15,'Cartera rosada de regalo con 3 girasoles y 4 rosas hechas a mano.'),
    ('CA-U-003', 'Cartera blanca con 4 girasoles y 1 margarita',   'carteras','cartera','U',    80.00, 1, 106, false, 16,'Cartera blanca de regalo con 4 girasoles y 1 margarita hechas a mano.')
)
insert into public.producto (categoria_id, envoltorio_id, codigo, nombre, slug, descripcion,
                             precio, precio_desde, estado, destacado, lead_time_dias,
                             minutos_armado, orden)
select c.id, env.id, d.codigo, d.nombre, public.slugify(d.nombre), d.descripcion,
       d.precio, false, 'activo'::estado_publicacion, d.destacado, d.lead_time_dias,
       d.minutos_armado, d.orden
from datos d
join public.categoria c  on c.slug = d.cat_slug
join public.estilo  e    on e.slug = d.estilo_slug
join public.tamano  t    on t.codigo = d.tamano
join public.envoltorio env on env.estilo_id = e.id and env.tamano_id = t.id
on conflict (codigo) do update
  set nombre         = excluded.nombre,
      slug           = excluded.slug,
      descripcion    = excluded.descripcion,
      precio         = excluded.precio,
      categoria_id   = excluded.categoria_id,
      envoltorio_id  = excluded.envoltorio_id,
      destacado      = excluded.destacado,
      lead_time_dias = excluded.lead_time_dias,
      minutos_armado = excluded.minutos_armado,
      orden          = excluded.orden,
      estado         = 'activo';

-- ---------------------------------------------------------------------------
-- Composición: qué lleva cada producto
-- ---------------------------------------------------------------------------
with comp(producto_codigo, extra_nombre, cantidad) as (
  values
    ('AB-XS-001',  'Girasol',                 1),
    ('AB-S-001',   'Rosa',                    3),
    ('AB-M-001',   'Rosa',                    5),
    ('AB-M-002',   'Rosa',                    3),
    ('AB-M-002',   'Hot Wheels',              2),
    ('AB-L-001',   'Girasol',                 3),
    ('AB-L-002',   'Rosa',                    3),
    ('AB-L-002',   'Hot Wheels',              3),
    ('AB-XL-001',  'Girasol',                 5),
    ('AB-XXL-001', 'Rosa',                   14),
    ('AB-XXL-001', 'Peluche oso dormilón',    1),
    ('CO-S-001',   'Rosa',                    7),
    ('CO-L-001',   'Girasol',                 1),
    ('CO-L-001',   'Rosa',                    8),
    ('CO-XL-001',  'Rosa',                   20),
    ('CO-XL-001',  'Mariposa',                2),
    ('CO-XXL-001', 'Girasol',                 7),
    ('CO-XXXL-001','Girasol',                20),
    ('CA-U-001',   'Girasol',                 3),
    ('CA-U-001',   'Margarita (3 tallos)',    5),
    ('CA-U-002',   'Girasol',                 3),
    ('CA-U-002',   'Rosa',                    4),
    ('CA-U-003',   'Girasol',                 4),
    ('CA-U-003',   'Margarita (3 tallos)',    1)
)
insert into public.producto_extra (producto_id, extra_id, cantidad)
select p.id, e.id, c.cantidad
from comp c
join public.producto p on p.codigo = c.producto_codigo
join public.extra    e on e.nombre = c.extra_nombre
on conflict (producto_id, extra_id) do update set cantidad = excluded.cantidad;
