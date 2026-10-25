'use client'

import Icono from '@/components/Icono'
import { CAMPO } from '@/components/ui'
import { numeroDe } from '@/lib/acciones'
import { bs } from '@/lib/formato'

/**
 * Cambiar el precio de una línea y sumarle cosas escritas a mano.
 *
 * El mostrador no siempre cobra el precio de lista: se rebaja ("te lo dejo en
 * 60") o el cliente pide algo que no está en el sistema (un globo, un
 * chocolate) y el precio sube. Esta pieza se usa en dos lados: en Vender,
 * antes de registrar, y en la ficha de una venta ya hecha.
 *
 * Lo que se escribe acá es solo lo que se ve: el precio que vale lo pone la
 * base cuando se guarda.
 */

export interface ExtraEscrito {
  nombre: string
  precio: string
}

export interface Ajuste {
  /** vacío = se cobra el precio de lista */
  precio: string
  extras: ExtraEscrito[]
}

export const SIN_AJUSTE: Ajuste = { precio: '', extras: [] }

/** Lo que la vendedora escribió, como número (admite coma: "60,50"). */
export function monto(texto: string): number {
  const n = numeroDe(texto)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Precio por unidad con lo tocado a mano: el ramo más lo que se le sumó. */
export function precioConAjuste(precioLista: number, a: Ajuste | undefined): number {
  if (!a) return precioLista
  const base = a.precio.trim() === '' ? precioLista : monto(a.precio)
  return a.extras.reduce((s, e) => s + (e.nombre.trim() === '' ? 0 : monto(e.precio)), base)
}

export function hayAjuste(a: Ajuste | undefined): boolean {
  return !!a && (a.precio.trim() !== '' || a.extras.some((e) => e.nombre.trim() !== ''))
}

/** Lo que se le manda al servidor. */
export function ajusteParaGuardar(a: Ajuste | undefined) {
  return {
    precio: a && a.precio.trim() !== '' ? monto(a.precio) : null,
    extras: (a?.extras ?? [])
      .filter((e) => e.nombre.trim() !== '')
      .map((e) => ({ nombre: e.nombre.trim(), precio: monto(e.precio) })),
  }
}

const ENLACE = 'inline-flex min-h-11 items-center gap-1 text-sm text-rosa-700 hover:underline'

export default function AjusteLinea({
  nombre,
  precioLista,
  valor,
  alCambiar,
}: {
  nombre: string
  /** el precio con el que nació la línea */
  precioLista: number
  valor: Ajuste
  alCambiar: (a: Ajuste) => void
}) {
  const cambiandoPrecio = valor.precio.trim() !== ''

  function ponerExtra(i: number, campo: 'nombre' | 'precio', texto: string) {
    alCambiar({ ...valor, extras: valor.extras.map((e, j) => (j === i ? { ...e, [campo]: texto } : e)) })
  }

  return (
    <div className="mt-2 space-y-2">
      {cambiandoPrecio && (
        <div className="rounded-lg bg-rosa-50 p-2">
          <label className="block text-sm text-tinta-suave" htmlFor={`precio-${nombre}`}>
            ¿En cuánto se lo dejás? (cada uno)
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`precio-${nombre}`}
              inputMode="decimal"
              value={valor.precio}
              onChange={(e) => alCambiar({ ...valor, precio: e.target.value })}
              aria-label={`Precio de ${nombre}`}
              className={`${CAMPO} text-right tabular-nums`}
            />
            <button
              type="button"
              onClick={() => alCambiar({ ...valor, precio: '' })}
              aria-label={`Volver al precio de ${nombre}`}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-linea text-tinta-suave transition hover:border-alerta hover:text-alerta"
            >
              <Icono nombre="cerrar" className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-tinta-suave">Antes: {bs(precioLista)}</p>
        </div>
      )}

      {valor.extras.map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={e.nombre}
            onChange={(ev) => ponerExtra(i, 'nombre', ev.target.value)}
            placeholder="Qué se le agrega"
            aria-label={`Qué se le agrega a ${nombre}`}
            autoFocus={e.nombre === '' && e.precio === ''}
            className={`${CAMPO} min-w-0 flex-1`}
          />
          <input
            inputMode="decimal"
            value={e.precio}
            onChange={(ev) => ponerExtra(i, 'precio', ev.target.value)}
            placeholder="Bs"
            aria-label={`Precio de lo que se le agrega a ${nombre}`}
            className={`${CAMPO} w-20 shrink-0 text-right tabular-nums`}
          />
          <button
            type="button"
            onClick={() => alCambiar({ ...valor, extras: valor.extras.filter((_, j) => j !== i) })}
            aria-label="Sacar este extra"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-linea text-tinta-suave transition hover:border-alerta hover:text-alerta"
          >
            <Icono nombre="basura" className="size-4" />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-4">
        {!cambiandoPrecio && (
          <button
            type="button"
            onClick={() => alCambiar({ ...valor, precio: String(precioLista) })}
            className={ENLACE}
          >
            <Icono nombre="billetera" className="size-4" />
            Cambiar precio
          </button>
        )}
        <button
          type="button"
          onClick={() => alCambiar({ ...valor, extras: [...valor.extras, { nombre: '', precio: '' }] })}
          className={ENLACE}
        >
          <Icono nombre="sumar" className="size-4" />
          Añadir extra
        </button>
      </div>
    </div>
  )
}
