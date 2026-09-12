export default function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-full bg-rosa-300 text-base text-white"
      >
        ❀
      </span>
      <span className="leading-tight">
        <span className="block text-base font-semibold tracking-tight text-tinta">
          Detalles Elena
        </span>
        <span className="block text-[11px] uppercase tracking-widest text-tinta-suave">
          hecho a mano
        </span>
      </span>
    </span>
  )
}
