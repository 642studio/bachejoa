const personajes = [
  {
    name: 'El Presi',
    role: 'Autoridad principal',
    image: '/personajes/presi.svg',
    text:
      'El Presi siempre está “al tanto” de lo que pasa en la ciudad. Le llegan todos los reportes importantes, los revisa con calma… y promete que pronto habrá solución. Pronto, muy pronto…',
  },
  {
    name: 'El Poli',
    role: 'Seguridad y orden',
    image: '/personajes/poli.svg',
    text:
      'El Poli recibe los reportes que afectan el tránsito y la seguridad. Siempre anda patrullando, levantando informes y tratando de que los baches no causen accidentes. Aunque a veces… anda en otra llamada.',
  },
  {
    name: 'El Doc',
    role: 'Evaluador de riesgos',
    image: '/personajes/doc.svg',
    text:
      'El Doc analiza qué tan grave está la salud municipal. Mide el daño, revisa el peligro. Si él se preocupa… es por algo.',
  },
  {
    name: 'La Maña',
    role: 'Soluciones “alternativas”',
    image: '/personajes/mana.svg',
    text:
      'La Maña siempre aparece cuando nadie más responde. A veces tapa, a veces parcha, a veces solo deja el recuerdo. No es oficial… pero ahí anda.',
  },
];

const comingSoon = [
  { name: 'El de Obras' },
  { name: 'El del Alumbrado' },
  { name: 'El del Agua' },
  { name: 'El Gestor' },
];

export default function PersonajesPage() {
  return (
    <main className="reportes-root min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="reportes-header space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <img
              alt="Bachejoa Map"
              className="h-10 w-auto"
              src="/logo.png"
            />
            <a
              className="rounded-full border border-white/60 bg-white/60 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              href="/map"
            >
              Volver al mapa
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Personajes de Bachejoa
            </p>
            <h1 className="text-3xl font-[var(--font-display)] text-slate-900">
              Conoce a quienes “se encargan” de tus reportes 👀
            </h1>
          </div>
          <p className="max-w-2xl text-sm text-slate-600">
            En Bachejoa Map, cada reporte llega a un personaje distinto. Todos son
            ficticios, pero… curiosamente se parecen a la realidad.
          </p>
          <p className="text-xs text-slate-500">
            Los personajes son representaciones satíricas con fines informativos y
            humorísticos.
          </p>
        </header>

        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {personajes.map((item, index) => (
            <article
              key={item.name}
              className="reportes-card overflow-hidden rounded-3xl bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="relative h-48 overflow-hidden bg-sky-100 px-6 py-4">
                <img
                  alt={item.name}
                  className="h-full w-full object-contain object-bottom"
                  src={item.image}
                />
              </div>
              <div className="space-y-2 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">{item.name}</h2>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {item.role}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{item.text}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-14">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔜</span>
            <h2 className="text-2xl font-semibold">
              Próximos personajes
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            El universo Bachejoa sigue creciendo. Muy pronto llegarán nuevos
            personajes para más tipos de reportes.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {comingSoon.map((item) => (
              <article
                key={item.name}
                className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-5 py-6 text-center"
              >
                <div className="mx-auto h-16 w-16 rounded-full bg-slate-200" />
                <h3 className="mt-4 text-sm font-semibold text-slate-700">
                  {item.name}
                </h3>
                <span className="mt-2 inline-flex rounded-full bg-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Coming Soon
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
