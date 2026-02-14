import AudioControls from '../components/AudioControls';
import { REPORT_CATEGORIES } from '../../lib/reporting';

type Card = {
  title: string;
  subtitle: string;
  detail: string;
  image: string;
};

const imageByCategory: Record<string, string> = {
  Baches: '/reportes_thumbs/bache.svg',
  Luminarias: '/reportes_thumbs/luz_thumb.svg',
  Agua: '/reportes_thumbs/agua_thumb.svg',
  Basura: '/reportes_thumbs/basura_thumb.svg',
  Drenaje: '/reportes_thumbs/drenaje_thumb.svg',
};

const reportCards: Card[] = REPORT_CATEGORIES.map((category) => ({
  title: category.name,
  subtitle: `Incluye ${category.subcategories.length} subtipos`,
  detail: category.subcategories.join(' · '),
  image: imageByCategory[category.name] ?? '/thumb.png',
}));

const newCards = reportCards.filter((card) => card.title !== 'Baches');
const bacheSubtypeCards: Card[] = [
  {
    title: 'Grieta',
    subtitle: 'Daño superficial',
    detail: 'Fisura inicial en el pavimento.',
    image: '/reportes_thumbs/grieta_thumb.svg',
  },
  {
    title: 'Bache',
    subtitle: 'Hoyo en vialidad',
    detail: 'Afecta la circulación y seguridad vehicular.',
    image: '/reportes_thumbs/bache.svg',
  },
  {
    title: 'Bacheson',
    subtitle: 'Daño de alto impacto',
    detail: 'Riesgo alto para llantas y suspensión.',
    image: '/reportes_thumbs/bacheson.svg',
  },
  {
    title: 'Reparacion inconclusa',
    subtitle: 'Obra sin cierre correcto',
    detail: 'Intervención incompleta que sigue afectando la vialidad.',
    image: '/reportes_thumbs/reparacion_inconclusa.svg',
  },
];

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <a
          key={card.title}
          className="reportes-card overflow-hidden rounded-3xl bg-white text-left shadow-[0_20px_40px_rgba(15,23,42,0.12)] transition hover:-translate-y-1"
          href="/map"
          style={{ animationDelay: `${index * 120}ms` }}
        >
          <div className="relative h-40 overflow-hidden bg-slate-100">
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
            <span className="text-sm font-semibold text-slate-900">Reportar →</span>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function ReportesPage() {
  return (
    <main className="reportes-root min-h-screen text-slate-900">
      <AudioControls src="/audio/songintro2.mp3" loop={false} autoPlay />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="reportes-header flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/">
              <img alt="Bachejoa Map" className="mb-2 h-10 w-auto" src="/logo.png" />
            </a>
            <h1 className="text-3xl font-[var(--font-display)] text-slate-900">
              Tipos de reporte
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Civic Data Platform. Plataforma ciudadana de reportes urbanos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
              href="/map"
            >
              Ir al mapa general
            </a>
            <a
              className="rounded-full border border-white/60 bg-white/60 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              href="/personajes"
            >
              Personajes
            </a>
          </div>
        </header>

        <section className="mt-10">
          <div className="relative overflow-hidden rounded-[32px] bg-sky-300/60 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.18)] sm:px-8">
            <div className="max-w-3xl pr-0 text-sm text-slate-800 sm:pr-52">
              <p>👋 Bienvenido a Bachejoa Map.</p>
              <p className="mt-2">Aquí puedes reportar incidencias urbanas por categoría.</p>
              <p className="mt-2">
                Cada reporte puede ir dirigido a un personaje distinto, representando a
                quienes “se encargan” de resolverlo.
              </p>
              <p className="mt-2">
                Conócelos, participa y ayúdanos a entender cómo vive Navojoa sus problemas
                reales.
              </p>
            </div>
            <img
              alt="El Presi"
              className="pointer-events-none absolute bottom-0 right-6 hidden h-40 w-auto sm:block"
              src="/personajes/presi-mid.png"
            />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">NUEVOS</h2>
          </div>
          <CardGrid cards={newCards} />
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Baches</h2>
          </div>
          <CardGrid cards={bacheSubtypeCards} />
        </section>
      </div>
    </main>
  );
}
