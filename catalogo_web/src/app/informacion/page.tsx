import type { Metadata } from 'next'
import { enlaceConsultaWhatsapp } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Información' }

export default function PaginaInformacion() {
  return (
    <div className="contenedor py-8">
      <h1 className="text-2xl font-semibold">Información</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-rosa-200 bg-white p-5">
          <h2 className="text-base font-semibold">La tienda</h2>
          <p className="mt-2 text-sm text-tinta-suave">
            Detalles Elena hace ramos, carteras y cajas con flores hechas a mano,
            una por una. Trabajamos en Cotoca y hacemos entregas en Santa Cruz de la
            Sierra.
          </p>
          <p className="mt-3 text-sm text-tinta-suave">
            Todo es personalizable: tamaño, colores, cantidad de flores y extras.
            Si querés algo distinto a lo que ves en el catálogo, escribinos y lo
            armamos.
          </p>
        </section>

        <section className="rounded-2xl border border-rosa-200 bg-white p-5">
          <h2 className="text-base font-semibold">Contacto y redes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={enlaceConsultaWhatsapp()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rosa-700 hover:underline"
              >
                WhatsApp 63398762
              </a>
            </li>
            <li>
              <a
                href="https://www.tiktok.com/@detalles_elenac"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rosa-700 hover:underline"
              >
                TikTok @detalles_elenac
              </a>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-rosa-200 bg-white p-5">
          <h2 className="text-base font-semibold">Cómo se paga</h2>
          <p className="mt-2 text-sm text-tinta-suave">
            En esta página no se paga nada. Armás tu pedido, te damos un código y
            coordinamos el pago y la entrega por WhatsApp.
          </p>
        </section>

        <section className="rounded-2xl border border-rosa-200 bg-white p-5">
          <h2 className="text-base font-semibold">Envíos</h2>
          <p className="mt-2 text-sm text-tinta-suave">
            El costo del envío no está incluido en los precios: depende de la zona y
            se cotiza por WhatsApp. También podés recoger el pedido en la tienda.
          </p>
        </section>

        <section className="rounded-2xl border border-rosa-200 bg-white p-5 sm:col-span-2">
          <h2 className="text-base font-semibold">Tiempos de entrega</h2>
          <p className="mt-2 text-sm text-tinta-suave">
            Cada producto muestra su plazo en la ficha. Los ramos chicos y medianos
            suelen estar listos en 1 día; los jumbo pueden tomar 2 o 3. En fechas
            especiales (Día de la Madre, 21 de septiembre) conviene encargar con
            varios días de anticipación, porque la producción es artesanal y tiene un
            tope diario.
          </p>
        </section>
      </div>
    </div>
  )
}
