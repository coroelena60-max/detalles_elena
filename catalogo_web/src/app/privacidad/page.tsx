import type { Metadata } from 'next'
import { DocumentoLegal, Seccion } from '@/components/DocumentoLegal'
import { enlaceConsultaWhatsapp, numeroWhatsappVisible } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos pide Detalles Elena al hacer un pedido, para qué los usa y cómo pedir que se corrijan o se borren.',
}

export default function PaginaPrivacidad() {
  const whatsapp = (
    <a
      href={enlaceConsultaWhatsapp('mis datos personales')}
      target="_blank"
      rel="noopener noreferrer"
      className="text-rosa-700 hover:underline"
    >
      WhatsApp {numeroWhatsappVisible()}
    </a>
  )

  return (
    <DocumentoLegal
      titulo="Política de privacidad"
      resumen="En corto: pedimos solo los datos que hacen falta para preparar y entregar tu pedido, no los vendemos ni los usamos para publicidad sin tu permiso, y podés pedirnos por WhatsApp que los corrijamos o los borremos."
    >
      <Seccion titulo="Quién cuida tus datos">
        <p>
          <strong>Detalles Elena</strong>, emprendimiento de flores y detalles hechos a
          mano con base en Cotoca, Santa Cruz, Bolivia. Para cualquier consulta sobre
          tus datos escribinos al {whatsapp}.
        </p>
      </Seccion>

      <Seccion titulo="Qué datos pedimos">
        <p>Solo cuando confirmás un pedido:</p>
        <ul>
          <li><strong>Tuyos:</strong> nombre, número de WhatsApp y, si querés, tu correo.</li>
          <li>
            <strong>De la entrega</strong> (solo si pedís envío): dirección, zona,
            referencia, fecha deseada e instrucciones.
          </li>
          <li>
            <strong>De quien recibe</strong> (opcional): su nombre y teléfono.
          </li>
          <li><strong>Del pedido:</strong> los productos, la dedicatoria y las notas que escribas.</li>
        </ul>
        <p>
          Para mirar el catálogo no hace falta registrarse ni dar ningún dato. Tampoco
          pedimos datos de tarjetas ni cuentas bancarias en esta página.
        </p>
      </Seccion>

      <Seccion titulo="Para qué los usamos">
        <ul>
          <li>Preparar tu pedido y coordinar con vos el pago y la entrega por WhatsApp.</li>
          <li>Entregarlo en la dirección que nos diste.</li>
          <li>Atender cambios, reclamos o consultas sobre ese pedido.</li>
          <li>Llevar el registro de ventas que exigen las normas contables y tributarias.</li>
        </ul>
        <p>
          No los usamos para otra cosa. Si alguna vez quisiéramos mandarte
          promociones, te lo preguntaríamos antes y podrías decir que no en cualquier
          momento.
        </p>
      </Seccion>

      <Seccion titulo="Tu consentimiento">
        <p>
          Al marcar la casilla del formulario de pedido nos autorizás a usar tus datos
          para lo que dice arriba. Podés retirar esa autorización cuando quieras
          escribiéndonos; no afecta lo que ya se hizo antes de retirarla.
        </p>
      </Seccion>

      <Seccion titulo="Datos de otra persona">
        <p>
          Si el regalo es para otra persona y nos das su nombre, teléfono o dirección,
          hacelo solo si sabés que está de acuerdo. Esos datos los usamos únicamente
          para la entrega.
        </p>
      </Seccion>

      <Seccion titulo="Con quién los compartimos">
        <p><strong>No vendemos ni alquilamos tus datos.</strong> Solo los ven:</p>
        <ul>
          <li>
            Las personas de la tienda que atienden, preparan y entregan pedidos, cada una
            con su propio usuario y solo con los permisos que necesita.
          </li>
          <li>
            Quien lleva el envío, que recibe solo lo necesario para entregar (nombre,
            dirección y teléfono de quien recibe).
          </li>
          <li>
            Los servicios tecnológicos que usamos para que la página funcione: la base de
            datos (Supabase) y el alojamiento de la página (Vercel). Sus servidores pueden
            estar fuera de Bolivia.
          </li>
          <li>
            WhatsApp (Meta), cuando vos nos escribís por ahí. Lo que pasa dentro de
            WhatsApp se rige también por la política de privacidad de WhatsApp.
          </li>
          <li>Una autoridad, solo con orden judicial o cuando la ley lo exija.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Lo que se guarda en tu celular">
        <p>
          El carrito se guarda en el almacenamiento de tu propio navegador para que no
          lo pierdas si cerrás la página. No se manda a ningún lado hasta que confirmás
          el pedido, y se borra al confirmarlo. También se guarda ahí que ya cerraste el
          aviso de privacidad, para no volver a mostrártelo.
        </p>
        <p>
          Medimos las visitas con Vercel Web Analytics, que cuenta páginas vistas de
          forma anónima y sin cookies. No usamos cookies de publicidad ni de
          seguimiento.
        </p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo los guardamos">
        <p>
          Mientras dure tu pedido y, después, el tiempo que las normas contables y
          tributarias de Bolivia nos obligan a conservar el registro de una venta.
          Pasado ese plazo los borramos o los dejamos anónimos.
        </p>
      </Seccion>

      <Seccion titulo="Cómo los protegemos">
        <ul>
          <li>La página funciona con conexión cifrada (HTTPS).</li>
          <li>
            Los pedidos no se pueden leer desde la página pública: solo desde el panel de
            la tienda, con usuario y contraseña.
          </li>
          <li>Cada persona del equipo ve solo lo que su función necesita.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>En cualquier momento podés pedirnos:</p>
        <ul>
          <li>Saber qué datos tuyos tenemos.</li>
          <li>Corregirlos o actualizarlos.</li>
          <li>
            Borrarlos, salvo lo que la ley nos obligue a conservar del registro de ventas
            (en ese caso te lo explicamos).
          </li>
          <li>Que dejemos de usarlos.</li>
        </ul>
        <p>
          Escribinos al {whatsapp} desde el número que usaste en el pedido (así
          sabemos que sos vos) o con tu código de pedido. Te respondemos a la brevedad.
        </p>
        <p>
          Además, la Constitución Política del Estado reconoce tu derecho a la privacidad
          e intimidad (artículo 21) y te da la Acción de Protección de Privacidad
          (artículos 130 y 131) si creés que tus datos se usan de forma indebida.
        </p>
      </Seccion>

      <Seccion titulo="Menores de edad">
        <p>
          Los pedidos los hace una persona mayor de 18 años. Si sos menor, pedile a una
          persona adulta que haga el pedido por vos.
        </p>
      </Seccion>

      <Seccion titulo="Normas que seguimos">
        <p>
          Bolivia todavía no tiene una ley general de protección de datos personales.
          Mientras tanto seguimos lo que ya está vigente: la Constitución Política del
          Estado (artículos 21, 130 y 131), la Ley 164 de Telecomunicaciones y
          Tecnologías de Información y Comunicación y su reglamento, el Decreto Supremo
          1793 (artículos 56 y 57, sobre datos personales y mensajes comerciales), y la
          Ley 453 de Derechos de las Usuarias y los Usuarios y de las Consumidoras y los
          Consumidores.
        </p>
        <p>
          Si cambia la ley o cambia lo que hacemos con tus datos, actualizamos esta
          página y la fecha de arriba.
        </p>
      </Seccion>
    </DocumentoLegal>
  )
}
