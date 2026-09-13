// Arma supabase/base-nueva.sql (NO versionado) con todas las migraciones en orden,
// para montar la base en un proyecto de Supabase VACÍO o para probar en local.
// Uso (desde la raíz del repo):  node supabase/generar-base-nueva.mjs
//
// En la base real NUNCA se corre este archivo: se aplica solo la migración nueva.
// Por eso el archivo empieza con un candado que se niega a seguir si la base ya
// tiene el esquema (el 2026-09-13 correr todo junto pisó datos de la dueña).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const carpeta = path.join(dir, 'migrations')
const archivos = fs
  .readdirSync(carpeta)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort()

const encabezado = `-- =============================================================================
-- Detalles Elena · BASE NUEVA (catálogo web + panel admin)
-- Generado: ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')} con supabase/generar-base-nueva.mjs
--
-- SOLO PARA UN PROYECTO DE SUPABASE VACÍO (o una base local de prueba).
-- En la base real se aplica únicamente la migración nueva, archivo por archivo.
-- Si esta base ya tiene las tablas, el candado de abajo corta todo sin tocar nada.
-- (Con psql, correrlo con -v ON_ERROR_STOP=1 para que el candado frene el resto.)
--
-- 0009 (imágenes) sólo funciona bien después de subir assets/catalogo/ al bucket.
-- Después de aplicar, nombrar al primer administrador:
--   select public.asignar_rol('correo@de.elena', 'admin');
-- =============================================================================

do $candado$
begin
  if to_regclass('public.producto') is not null then
    raise exception 'ALTO: esta base ya tiene el esquema de Detalles Elena. base-nueva.sql es solo para una base VACÍA; en la base real aplicá únicamente la migración nueva (supabase/migrations/NNNN_...sql).';
  end if;
end
$candado$;`

const partes = archivos.map((f) => {
  const sql = fs.readFileSync(path.join(carpeta, f), 'utf8').replace(/\r\n/g, '\n')
  return `-- ${'>'.repeat(24)} migrations/${f} ${'<'.repeat(24)}\n\n${sql.trimEnd()}\n`
})

const destino = path.join(dir, 'base-nueva.sql')
fs.writeFileSync(destino, `${encabezado}\n\n\n${partes.join('\n\n')}`)
console.log(`base-nueva.sql generado con ${archivos.length} migraciones (no se sube al repo).`)
