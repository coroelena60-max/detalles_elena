import type { Metadata } from 'next'
import Link from 'next/link'
import { DocumentoLegal, Seccion } from '@/components/DocumentoLegal'
import { enlaceConsultaWhatsapp, numeroWhatsappVisible } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Cómo funcionan los pedidos, precios, entregas, cambios y reclamos en Detalles Elena.',
}

export default function PaginaTerminos() {
  const whatsapp = (
    <a
      href={enlaceConsultaWhatsapp('un pedido')}
      target="_blank"
      rel="noopener noreferrer"
      className="text-rosa-700 hover:underline"
    >
      WhatsApp {numeroWhatsappVisible()}
    </a>
  )

  return (
    <DocumentoLegal
      titulo="Términos y condiciones"
      resumen="En corto: en esta página armás tu pedido y recibís un código; el pedido se confirma, se paga y se coordina la entrega por WhatsApp. El envío se cotiza aparte. Si algo llega mal, escribinos y lo solucionamos."
    >
      <Seccion titulo="Quiénes somos">
        <p>
          <strong>Detalles Elena</strong> hace ramos, carteras, cajas y detalles con
          flores hechas a mano, en Cotoca, Santa Cruz, Bolivia. Contacto: {whatsapp}.
          Al hacer un pedido en esta página aceptás estas condiciones.
        </p>
      </Seccion>

      <Seccion titulo="Cómo funciona un pedido">
        <ul>
          <li>Elegís productos o armás tu ramo y confirmás tus datos.</li>
          <li>
            La página te da un <strong>código de pedido</strong> (por ejemplo
            PED-00123) y te lleva a WhatsApp para mandárnoslo.
          </li>
          <li>
            <strong>El código todavía no es una compra cerrada:</strong> el pedido queda
            confirmado cuando la tienda te lo confirma por WhatsApp y acuerdan el pago y
            la entrega.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Precios">
        <ul>
          <li>Todos los precios están en bolivianos (Bs).</li>
          <li>
            El total lo calcula el sistema al confirmar, con los precios vigentes en ese
            momento. Si ves «desde Bs X», el precio final depende del tamaño o de lo que
            elijas, y te lo confirmamos antes de cerrar.
          </li>
          <li>
            <strong>El envío no está incluido</strong>: depende de la zona y se cotiza por
            WhatsApp antes de confirmar.
          </li>
          <li>
            Si hubiera un error evidente en un precio, te avisamos antes de confirmar y
            vos decidís si seguís con el pedido.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Productos hechos a mano">
        <p>
          Cada pieza se hace a mano, una por una. Las fotos muestran el producto real,
          pero puede haber pequeñas diferencias de color, forma o armado entre una pieza
          y otra.
        </p>
        <p>
          Si falta algún material o color, te proponemos por WhatsApp un reemplazo de
          valor similar antes de preparar el pedido, y vos decidís.
        </p>
        <p>
          Los productos marcados como «agotado» no se pueden pedir, y los de «temporada»
          están disponibles solo por un tiempo.
        </p>
      </Seccion>

      <Seccion titulo="Pago">
        <p>
          <strong>En esta página no se paga nada</strong> ni se piden datos de tarjeta.
          La forma de pago se acuerda por WhatsApp con la tienda. Pagá solo a través de
          lo que te indique nuestro número oficial ({numeroWhatsappVisible()}).
        </p>
      </Seccion>

      <Seccion titulo="Entrega">
        <ul>
          <li>Podés recoger el pedido en la tienda o pedir envío.</li>
          <li>
            Cada producto muestra su plazo de preparación. La fecha que elegís en el
            formulario es la que deseás: la confirmamos por WhatsApp según la carga del
            taller.
          </li>
          <li>
            En fechas especiales (Día de la Madre, 21 de septiembre, San Valentín)
            conviene pedir con varios días de anticipación.
          </li>
          <li>
            Revisá que la dirección y el teléfono de quien recibe estén bien. Si no se
            puede entregar por un dato equivocado o porque no había nadie, coordinamos
            por WhatsApp un nuevo intento.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Cambios y cancelaciones">
        <p>
          Mientras no hayamos empezado a preparar tu pedido, podés cambiarlo o
          cancelarlo sin costo avisándonos por WhatsApp.
        </p>
        <p>
          Como cada pieza se hace a mano y por encargo, cuando ya empezamos a
          prepararla los cambios o la cancelación se conversan caso por caso, teniendo
          en cuenta el material y el trabajo que ya se usaron.
        </p>
      </Seccion>

      <Seccion titulo="Si algo salió mal">
        <p>
          Si tu pedido llega dañado, incompleto o distinto de lo que acordamos,
          escribinos al {whatsapp} con tu código de pedido y, si podés, una foto. Según
          el caso lo reparamos, lo cambiamos por uno igual o similar, o te devolvemos lo
          que pagaste.
        </p>
        <p>
          Nada de lo que dice esta página limita los derechos que te da la Ley 453 de
          Derechos de las Usuarias y los Usuarios y de las Consumidoras y los
          Consumidores. Si no quedás conforme con nuestra respuesta, podés presentar tu
          reclamo ante la unidad de defensa del consumidor de tu municipio o ante el
          Viceministerio de Defensa de los Derechos del Usuario y del Consumidor.
        </p>
      </Seccion>

      <Seccion titulo="Tus datos">
        <p>
          Lo que hacemos con los datos que nos das está en la{' '}
          <Link href="/privacidad" className="text-rosa-700 hover:underline">
            Política de privacidad
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="Fotos y marca">
        <p>
          Las fotos, el nombre y el logo de Detalles Elena son nuestros. Podés
          compartirlos para recomendarnos, pero no usarlos para vender a nombre de otra
          persona o negocio.
        </p>
      </Seccion>

      <Seccion titulo="Cambios en estas condiciones">
        <p>
          Podemos actualizar estas condiciones; la fecha de arriba indica la última
          versión. Cada pedido se rige por las condiciones vigentes el día en que lo
          hiciste. Se aplican las leyes del Estado Plurinacional de Bolivia.
        </p>
      </Seccion>
    </DocumentoLegal>
  )
}
