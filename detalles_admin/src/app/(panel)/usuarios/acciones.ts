'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'

export type Resultado = { ok: boolean; mensaje: string }

/**
 * Administración de personas y roles.
 *
 * Los candados de verdad viven en la base (migraciones 0017 y 0019): el
 * catálogo de permisos es de solo lectura, los roles de sistema no se borran,
 * el rol admin no pierde permisos y nadie puede dejar la tienda sin ningún
 * administrador activo. Acá solo se traducen esos errores a algo legible.
 */
function traducir(mensaje: string): string {
  if (mensaje.includes('rol_nombre_uk')) return 'Ya existe un rol con ese nombre.'
  if (mensaje.includes('rol_slug_uk')) return 'Ya existe un rol parecido: cambiá el nombre.'
  if (mensaje.includes('perfil_telefono_ck')) return 'El teléfono tiene que ser de 7 a 15 dígitos.'
  if (mensaje.includes('row-level security') || mensaje.includes('permission denied')) {
    return 'Tu cuenta no tiene permiso para hacer este cambio.'
  }
  return mensaje
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export async function guardarPerfil(
  id: string,
  nombre: string,
  telefono: string,
): Promise<Resultado> {
  if (nombre.trim().length < 2) return { ok: false, mensaje: 'El nombre es muy corto.' }

  const sb = await clienteServidor()
  const { error } = await sb
    .from('perfil')
    .update({
      nombre: nombre.trim(),
      telefono: telefono.replace(/\D/g, '') || null,
    })
    .eq('id', id)

  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${id}`)
  return { ok: true, mensaje: 'Datos guardados.' }
}

/** Desactivar es sacarle la entrada al panel; la cuenta de Auth queda igual. */
export async function cambiarActivo(id: string, activo: boolean): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.from('perfil').update({ activo }).eq('id', id)
  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${id}`)
  return {
    ok: true,
    mensaje: activo ? 'La persona puede volver a entrar.' : 'La persona ya no entra al panel.',
  }
}

export async function darRol(perfilId: string, rolId: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb
    .from('usuario_rol')
    .upsert({ perfil_id: perfilId, rol_id: rolId }, { onConflict: 'perfil_id,rol_id' })
  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${perfilId}`)
  return { ok: true, mensaje: 'Rol asignado.' }
}

export async function quitarRol(perfilId: string, rolId: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb
    .from('usuario_rol')
    .delete()
    .eq('perfil_id', perfilId)
    .eq('rol_id', rolId)
  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${perfilId}`)
  return { ok: true, mensaje: 'Rol quitado.' }
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** El slug es la llave estable del rol: se arma del nombre y después no se toca. */
function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function crearRol(
  nombre: string,
  descripcion: string,
): Promise<Resultado & { id?: number }> {
  const limpio = nombre.trim()
  if (limpio.length < 3) return { ok: false, mensaje: 'El nombre del rol es muy corto.' }

  const slug = slugificar(limpio)
  if (!slug) return { ok: false, mensaje: 'Ese nombre no sirve como rol: usá letras.' }

  const sb = await clienteServidor()
  const { data, error } = await sb
    .from('rol')
    .insert({ nombre: limpio, slug, descripcion: descripcion.trim() || null })
    .select('id')
    .single()

  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios/roles')
  return { ok: true, id: data.id, mensaje: 'Rol creado. Ahora elegí qué puede hacer.' }
}

export async function guardarRol(
  id: number,
  nombre: string,
  descripcion: string,
  activo: boolean,
): Promise<Resultado> {
  const limpio = nombre.trim()
  if (limpio.length < 3) return { ok: false, mensaje: 'El nombre del rol es muy corto.' }

  const sb = await clienteServidor()
  const { error } = await sb
    .from('rol')
    .update({ nombre: limpio, descripcion: descripcion.trim() || null, activo })
    .eq('id', id)

  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios/roles')
  revalidatePath(`/usuarios/roles/${id}`)
  return { ok: true, mensaje: 'Rol actualizado.' }
}

export async function borrarRol(id: number): Promise<Resultado> {
  const sb = await clienteServidor()
  const { error } = await sb.from('rol').delete().eq('id', id)
  if (error) return { ok: false, mensaje: traducir(error.message) }
  revalidatePath('/usuarios/roles')
  revalidatePath('/usuarios')
  return { ok: true, mensaje: 'Rol borrado.' }
}

/**
 * La pantalla manda la lista FINAL de códigos y la base calcula altas y bajas.
 * Así no hay estados intermedios: o queda como se ve, o no cambia nada.
 */
export async function definirPermisos(
  rolId: number,
  codigos: string[],
): Promise<Resultado> {
  const sb = await clienteServidor()
  const { data, error } = await sb.rpc('definir_permisos_rol', {
    p_rol_id: rolId,
    p_codigos: codigos,
  })

  if (error) return { ok: false, mensaje: traducir(error.message) }

  const r = (data ?? {}) as { agregados?: number; quitados?: number }
  const alta = r.agregados ?? 0
  const baja = r.quitados ?? 0

  revalidatePath('/usuarios/roles')
  revalidatePath(`/usuarios/roles/${rolId}`)

  if (alta === 0 && baja === 0) return { ok: true, mensaje: 'No había nada que cambiar.' }
  const partes = []
  if (alta) partes.push(`${alta} permiso${alta === 1 ? '' : 's'} más`)
  if (baja) partes.push(`${baja} menos`)
  return { ok: true, mensaje: `Guardado: ${partes.join(' y ')}.` }
}
