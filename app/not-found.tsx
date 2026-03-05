import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-sky-100 text-slate-900 flex items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-3xl border-4 border-slate-900 bg-white/90 shadow-[10px_10px_0_#0f172a] p-8 text-center">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
          404
        </p>
        <h1 className="mt-3 text-3xl font-[var(--font-display)]">
          Esta ruta no existe
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Regresa al mapa para seguir revisando reportes.
        </p>
        <Link
          href="/map"
          className="mt-6 inline-flex items-center justify-center rounded-full border-2 border-slate-900 bg-yellow-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-[4px_4px_0_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Ir al mapa
        </Link>
      </section>
    </main>
  );
}
