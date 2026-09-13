-- =============================================================================
-- Detalles Elena · 0009 · Imágenes del catálogo
--   Requisito previo: subir la carpeta assets/catalogo/ al bucket 'catalogo'
--   del Storage de Supabase, manteniendo las subcarpetas productos/ extras/ marca/.
--   Los nombres de archivo son el código del producto en minúscula (ab-s-001.webp)
--   o el slug del extra (girasol.webp).
--
--   SOLO CARGA INICIAL: las fotos de producto se insertan únicamente si la tabla
--   está vacía, y las de extras solo si ningún extra tiene foto todavía. Antes,
--   re-ejecutar resucitaba como PRINCIPAL fotos que la dueña había borrado desde
--   el panel (y del bucket): quedaban rotas y la foto nueva perdía la marca
--   (pasó el 2026-09-13).
-- =============================================================================

-- para poder re-ejecutar sin duplicar
alter table public.producto_imagen
  drop constraint if exists producto_imagen_path_uk;
alter table public.producto_imagen
  add constraint producto_imagen_path_uk unique (producto_id, storage_path);

-- ---------------------------------------------------------------------------
-- Imágenes de producto
-- ---------------------------------------------------------------------------
with base(url) as (
  values ('https://nrwamzgxwttgvaqqodfp.supabase.co/storage/v1/object/public/catalogo/')
),
datos(producto_codigo, archivo, orden, es_principal) as (
  values
    ('AB-XS-001',   'productos/ab-xs-001.webp',   1, true),
    ('AB-S-001',    'productos/ab-s-001.webp',    1, true),
    ('AB-M-001',    'productos/ab-m-001.webp',    1, true),
    ('AB-M-002',    'productos/ab-m-002.webp',    1, true),
    ('AB-L-001',    'productos/ab-l-001.webp',    1, true),
    ('AB-L-002',    'productos/ab-l-002.webp',    1, true),
    ('AB-XL-001',   'productos/ab-xl-001.webp',   1, true),
    ('AB-XL-001',   'productos/ab-xl-001-2.webp', 2, false),
    ('AB-XXL-001',  'productos/ab-xxl-001.webp',  1, true),
    ('CO-S-001',    'productos/co-s-001.webp',    1, true),
    ('CO-L-001',    'productos/co-l-001.webp',    1, true),
    ('CO-XL-001',   'productos/co-xl-001.webp',   1, true),
    ('CO-XXL-001',  'productos/co-xxl-001.webp',  1, true),
    ('CO-XXXL-001', 'productos/co-xxxl-001.webp', 1, true),
    ('CA-U-001',    'productos/ca-u-001.webp',    1, true),
    ('CA-U-002',    'productos/ca-u-002.webp',    1, true),
    ('CA-U-003',    'productos/ca-u-003.webp',    1, true)
)
insert into public.producto_imagen (producto_id, storage_path, url, alt, orden, es_principal)
select p.id, d.archivo, b.url || d.archivo, p.nombre, d.orden, d.es_principal
from datos d
cross join base b
join public.producto p on p.codigo = d.producto_codigo
-- en el WHERE: el trigger BEFORE de foto principal (0017) desmarcaría la foto
-- principal actual aunque la fila después chocara con el ON CONFLICT
where not exists (select 1 from public.producto_imagen)
on conflict (producto_id, storage_path) do nothing;

-- ---------------------------------------------------------------------------
-- Imágenes de extras
-- ---------------------------------------------------------------------------
update public.extra e
   set imagen_url = 'https://nrwamzgxwttgvaqqodfp.supabase.co/storage/v1/object/public/catalogo/extras/'
                    || d.archivo
from (values
    ('Rosa',                  'rosa.webp'),
    ('Rosa semirealista',     'rosa-semirealista.webp'),
    ('Girasol',               'girasol.webp'),
    ('Margarita (3 tallos)',  'margarita-3-tallos.webp'),
    ('Flor lirio',            'flor-lirio.webp'),
    ('Flor limpiapipa',       'flor-limpiapipa.webp'),
    ('Follaje papel de arroz','follaje-papel-de-arroz.webp'),
    ('Follaje de hojas',      'follaje-de-hojas.webp'),
    ('Malla',                 'malla.webp'),
    ('Mariposa',              'mariposa.webp'),
    ('Corona',                'corona.webp'),
    ('Corona metálica',       'corona-metalica.webp'),
    ('Tarjeta',               'tarjeta.webp'),
    ('Hot Wheels',            'hot-wheels.webp')
) as d(nombre, archivo)
where e.nombre = d.nombre
  and not exists (select 1 from public.extra x where x.imagen_url is not null);
