/**
 * Utilidades para las server actions de todo el panel.
 *
 * Los mensajes de error de Postgres son para programadores; acá se traducen
 * los que una persona de la tienda puede llegar a ver. Los que lanzan
 * nuestras propias funciones (raise exception) ya vienen en castellano y se
 * dejan pasar tal cual.
 */
export type Resultado<T = undefined> =
  | ({ ok: true; mensaje: string } & (T extends undefined ? object : { dato: T }))
  | { ok: false; mensaje: string }

const TRADUCCIONES: [RegExp, string][] = [
  [/row-level security|permission denied|42501/i, 'Tu cuenta no tiene permiso para hacer este cambio.'],
  [/violates foreign key constraint.*(is still referenced|still referenced)/i,
   'No se puede borrar: hay otros registros que lo usan. Desactivalo en su lugar.'],
  [/is still referenced/i, 'No se puede borrar: hay otros registros que lo usan. Desactivalo en su lugar.'],
  [/_nombre_uk|duplicate key.*nombre/i, 'Ya existe uno con ese nombre.'],
  [/_telefono_uk/i, 'Ya hay un cliente con ese teléfono.'],
  [/telefono_ck/i, 'El teléfono tiene que tener entre 7 y 15 dígitos, sin espacios.'],
  [/email_ck/i, 'Revisá el correo: no parece válido.'],
  [/_cantidad_ck/i, 'La cantidad tiene que ser mayor a cero.'],
  [/_precio_ck|_costo_ck|_monto_ck/i, 'El monto no puede ser negativo.'],
  [/invalid input syntax for type (numeric|integer|bigint)/i, 'Hay un número mal escrito.'],
  [/invalid input syntax for type date/i, 'Hay una fecha mal escrita.'],
]

export function traducirError(mensaje: string): string {
  for (const [patron, texto] of TRADUCCIONES) {
    if (patron.test(mensaje)) return texto
  }
  return mensaje
}

export function numeroDe(valor: FormDataEntryValue | string | null | undefined): number {
  if (valor === null || valor === undefined) return NaN
  const texto = String(valor).trim().replace(',', '.')
  return texto === '' ? NaN : Number(texto)
}

export function textoDe(valor: FormDataEntryValue | null | undefined): string {
  return typeof valor === 'string' ? valor.trim() : ''
}
