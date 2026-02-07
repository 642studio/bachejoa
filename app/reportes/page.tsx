const bacheCards = [
  {
    title: 'Pequeña grieta en el pavimento',
    subtitle: 'Fisura leve en la superficie del camino.',
    detail: 'No afecta la circulación, pero indica desgaste inicial.',
    image: '/grieta.png',
  },
  {
    title: 'Bache',
    subtitle: 'Hoyo con afectación mínima',
    detail:
      'Pequeña depresión en el pavimento. Puede sentirse al pasar, pero no obliga a frenar.',
    image: '/bache.png',
  },
  {
    title: 'Bachesón',
    subtitle: 'Hoyo de alto impacto',
    detail:
      'Daño profundo en la vía. Obliga a reducir la velocidad para evitar daños al vehículo.',
    image: '/bacheson.png',
  },
  {
    title: 'Reparación inconclusa',
    subtitle: 'Daño por obra sin terminar',
    detail:
      'Afectación causada por trabajos de Oomapasn. La vialidad fue intervenida pero no reparada correctamente.',
    image: '/reparacion_inconclusa.png',
  },
];

export default function ReportesPage() {
  return (
    <main className="reportes-root min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="reportes-header flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Bachejoa Map
            </p>
            <h1 className="text-3xl font-[var(--font-display)] text-slate-900">
              Tipos de reporte
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Selecciona el tipo de bache para continuar al mapa y marcar el punto
              exacto.
            </p>
          </div>
          <a
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
            href="/map"
          >
            Ir al mapa general
          </a>
        </header>

        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {bacheCards.map((card, index) => (
            <a
              key={card.title}
              className="reportes-card text-left overflow-hidden rounded-3xl bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] transition hover:-translate-y-1"
              href="/map"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  alt={card.title}
                  className="h-full w-full object-cover"
                  src={card.image}
                />
              </div>
              <div className="space-y-3 px-5 py-4">
                <h2 className="text-base font-semibold">{card.title}</h2>
                <p className="text-xs text-slate-500">{card.subtitle}</p>
                <p className="text-xs text-slate-500">{card.detail}</p>
                <span className="text-sm font-semibold text-slate-900">
                  Reportar →
                </span>
              </div>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}
