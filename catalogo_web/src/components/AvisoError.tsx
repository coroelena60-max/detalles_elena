export default function AvisoError({
  titulo = 'No pudimos cargar el catálogo',
  detalle,
}: {
  titulo?: string
  detalle?: string
}) {
  return (
    <div className="rounded-2xl border border-rosa-300 bg-white p-6">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="mt-2 text-sm text-tinta-suave">
        Revisá la conexión con la base de datos. Si el problema sigue, escribinos por
        WhatsApp y te atendemos igual.
      </p>
      {detalle && (
        <p className="mt-3 rounded-lg bg-rosa-50 p-3 font-mono text-xs text-tinta-suave">
          {detalle}
        </p>
      )}
    </div>
  )
}
