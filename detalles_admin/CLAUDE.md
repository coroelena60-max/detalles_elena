# detalles_admin

Ver `../CLAUDE.md` en la raíz del repo: ahí está todo el contexto del proyecto
(reglas, modelo de base de datos, requerimientos y estado). La §5.5 describe cómo está
construido este panel.

Recordatorios rápidos:
- **pnpm**, nunca npm. En esta máquina: `corepack pnpm dev` (arranca en el 3001).
- Variables de entorno en `.env.local` (plantilla en `.env.local.example`).
- El esquema de la BD se cambia solo por migración en `../supabase/migrations/`.
- Después de una migración, regenerar los tipos:
  `corepack pnpm dlx supabase gen types typescript --project-id nrwamzgxwttgvaqqodfp --schema public > src/types/database.ts`
  (necesita `SUPABASE_ACCESS_TOKEN` en el entorno).
- Toda página de módulo empieza con `await exigirPermiso('<codigo>')`, y las escrituras
  con reglas de negocio van por RPC, no por `update` suelto.
- La `service_role` **no se usa en el panel**: la sesión del usuario + RLS alcanzan.
  Está en `.env.local` solo para tareas administrativas fuera del request.
