import Link from 'next/link'
import BotonesContacto from '@/components/BotonesContacto'
import Marca from '@/components/Marca'

export default function PieDePagina() {
  const anio = new Date().getFullYear()
  return (
    <footer className="border-t border-rosa-200 bg-white">
      <div className="contenedor grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <Marca />
          <p className="mt-3 text-sm text-tinta-suave">
            Flores hechas a mano · Cotoca y Santa Cruz
          </p>
        </div>
        <nav aria-label="Secciones">
          <h2 className="text-sm font-semibold">Catálogo</h2>
          <ul className="mt-3 space-y-2 text-sm text-tinta-suave">
            <li><Link className="hover:text-rosa-700" href="/productos">Todos los productos</Link></li>
            <li><Link className="hover:text-rosa-700" href="/extras">Flores y extras</Link></li>
            <li><Link className="hover:text-rosa-700" href="/pedido">Mi pedido</Link></li>
            <li><Link className="hover:text-rosa-700" href="/informacion">Información</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-semibold">Contacto</h2>
          <BotonesContacto className="mt-3" />
          <p className="mt-3 text-xs text-tinta-suave">El envío se cotiza aparte.</p>
        </div>
      </div>
      <div className="contenedor flex flex-wrap gap-x-4 gap-y-2 pb-8 text-xs text-tinta-suave">
        <p>© {anio} Detalles Elena. Todos los derechos reservados.</p>
        <Link className="hover:text-rosa-700" href="/terminos">Términos y condiciones</Link>
        <Link className="hover:text-rosa-700" href="/privacidad">Política de privacidad</Link>
      </div>
    </footer>
  )
}
