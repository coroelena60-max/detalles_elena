'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useCarrito } from '@/lib/carrito/CarritoProvider'
import { bs } from '@/lib/formato'
import type { ZonaEnvio } from '@/types/database'
import { crearPedido, type DatosPedido } from '../acciones'

const claseCampo =
  'mt-1 w-full rounded-xl border border-rosa-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rosa-400'

export default function FormularioPedido({ zonas }: { zonas: ZonaEnvio[] }) {
  const router = useRouter()
  const { lineas, total, vaciar, listo } = useCarrito()
  const [enviando, iniciarEnvio] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tipoEntrega, setTipoEntrega] = useState<'recojo_tienda' | 'envio'>(
    'recojo_tienda',
  )

  if (listo && lineas.length === 0) {
    return (
      <div className="contenedor py-12">
        <h1 className="text-2xl font-semibold">Tu pedido está vacío</h1>
        <Link
          href="/productos"
          className="mt-6 inline-block rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white"
        >
          Ver el catálogo
        </Link>
      </div>
    )
  }

  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    const f = new FormData(evento.currentTarget)

    const datos: DatosPedido = {
      nombre: String(f.get('nombre') ?? ''),
      telefono: String(f.get('telefono') ?? ''),
      email: String(f.get('email') ?? ''),
      tipoEntrega,
      direccion: String(f.get('direccion') ?? ''),
      referencia: String(f.get('referencia') ?? ''),
      destinatario: String(f.get('destinatario') ?? ''),
      telefonoEntrega: String(f.get('telefonoEntrega') ?? ''),
      zonaEnvioId: f.get('zona') ? Number(f.get('zona')) : null,
      fechaEntrega: String(f.get('fecha') ?? ''),
      instrucciones: String(f.get('instrucciones') ?? ''),
      nota: String(f.get('nota') ?? ''),
      aceptaCondiciones: f.get('aceptaCondiciones') === 'si',
      items: lineas.map((l) => ({
        tipo: l.tipo,
        referenciaId: l.referenciaId,
        cantidad: l.cantidad,
        ...(l.dedicatoria ? { dedicatoria: l.dedicatoria } : {}),
        ...(l.extras && l.extras.length > 0
          ? {
              extras: l.extras.map((e) => ({
                extraId: e.extraId,
                cantidad: e.cantidad,
              })),
            }
          : {}),
      })),
    }

    const nombre = datos.nombre.trim()

    iniciarEnvio(async () => {
      const r = await crearPedido(datos)
      if (!r.ok) {
        setError(r.mensaje)
        return
      }
      vaciar()
      router.push(
        `/pedido/${r.codigo}?n=${encodeURIComponent(nombre)}&t=${r.total}`,
      )
    })
  }

  return (
    <div className="contenedor py-8">
      <h1 className="text-2xl font-semibold">Confirmar el pedido</h1>
      <p className="mt-2 max-w-2xl text-sm text-tinta-suave">
        Dejanos tus datos. Al confirmar generamos tu código de pedido y lo terminás
        de coordinar por WhatsApp con la tienda. No se paga nada en esta página.
      </p>

      <form onSubmit={alEnviar} className="mt-7 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <fieldset className="rounded-2xl border border-rosa-200 bg-white p-5">
            <legend className="px-1 text-sm font-semibold">Tus datos</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                Nombre y apellido *
                <input
                  name="nombre"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  className={claseCampo}
                />
              </label>

              <label className="block text-sm">
                WhatsApp *
                <input
                  name="telefono"
                  required
                  inputMode="tel"
                  placeholder="70012345"
                  autoComplete="tel"
                  className={claseCampo}
                />
              </label>

              <label className="block text-sm sm:col-span-2">
                Correo (opcional)
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={claseCampo}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-rosa-200 bg-white p-5">
            <legend className="px-1 text-sm font-semibold">Entrega</legend>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['recojo_tienda', 'Recojo en la tienda'],
                  ['envio', 'Quiero envío'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <label
                  key={valor}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                    tipoEntrega === valor
                      ? 'border-rosa-500 bg-rosa-100 font-medium text-rosa-700'
                      : 'border-rosa-200 text-tinta-suave'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipoEntrega"
                    value={valor}
                    checked={tipoEntrega === valor}
                    onChange={() => setTipoEntrega(valor)}
                    className="sr-only"
                  />
                  {etiqueta}
                </label>
              ))}
            </div>

            {tipoEntrega === 'envio' && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  Dirección *
                  <input
                    name="direccion"
                    required
                    minLength={5}
                    maxLength={200}
                    autoComplete="street-address"
                    className={claseCampo}
                  />
                </label>

                <label className="block text-sm">
                  Zona
                  <select name="zona" className={claseCampo} defaultValue="">
                    <option value="">Elegir…</option>
                    {zonas.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  Referencia
                  <input name="referencia" maxLength={200} className={claseCampo} />
                </label>

                <label className="block text-sm">
                  ¿Para quién es? (si no es para vos)
                  <input name="destinatario" maxLength={120} className={claseCampo} />
                </label>

                <label className="block text-sm">
                  Teléfono de quien recibe
                  <input name="telefonoEntrega" inputMode="tel" className={claseCampo} />
                </label>

                <p className="text-xs text-tinta-suave sm:col-span-2">
                  Si nos das los datos de otra persona, que sea con su permiso: los
                  usamos solo para la entrega.
                </p>

                <label className="block text-sm">
                  Fecha deseada
                  <input name="fecha" type="date" className={claseCampo} />
                </label>

                <label className="block text-sm sm:col-span-2">
                  Instrucciones para la entrega
                  <input name="instrucciones" maxLength={300} className={claseCampo} />
                </label>
              </div>
            )}

            <p className="mt-4 text-xs text-tinta-suave">
              El costo del envío no está incluido: se cotiza por WhatsApp según la zona.
            </p>
          </fieldset>

          <fieldset className="rounded-2xl border border-rosa-200 bg-white p-5">
            <legend className="px-1 text-sm font-semibold">Dedicatoria o nota</legend>
            <label className="block text-sm">
              <span className="sr-only">Nota del pedido</span>
              <textarea
                name="nota"
                rows={3}
                maxLength={500}
                placeholder="Ej: la tarjeta que diga «Feliz cumple, mamá»"
                className={claseCampo}
              />
            </label>
          </fieldset>
        </div>

        {/* Resumen */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-rosa-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lineas.map((l) => (
                <li key={l.clave} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate text-tinta-suave">
                    {l.cantidad} × {l.nombre}
                  </span>
                  <span className="shrink-0">{bs(l.precio * l.cantidad)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-rosa-100 pt-3">
              <span className="text-sm text-tinta-suave">Subtotal</span>
              <strong className="text-lg">{bs(total)}</strong>
            </div>

            <label className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-tinta-suave">
              <input
                type="checkbox"
                name="aceptaCondiciones"
                value="si"
                required
                className="mt-0.5 size-4 shrink-0 accent-rosa-600"
              />
              <span>
                Acepto los{' '}
                <Link
                  href="/terminos"
                  target="_blank"
                  className="text-rosa-700 underline"
                >
                  términos y condiciones
                </Link>{' '}
                y autorizo el uso de mis datos para gestionar este pedido, según la{' '}
                <Link
                  href="/privacidad"
                  target="_blank"
                  className="text-rosa-700 underline"
                >
                  política de privacidad
                </Link>
                .
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-rosa-100 p-3 text-sm text-rosa-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando || !listo}
              className="mt-5 w-full rounded-full bg-rosa-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-rosa-600 disabled:opacity-60"
            >
              {enviando ? 'Generando tu código…' : 'Confirmar y enviar por WhatsApp'}
            </button>
            <Link
              href="/pedido"
              className="mt-3 block text-center text-xs text-tinta-suave hover:text-rosa-700"
            >
              Volver al pedido
            </Link>
          </div>
        </aside>
      </form>
    </div>
  )
}
