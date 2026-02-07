import Link from 'next/link';

type SearchParams = {
  tipo?: string;
};

export default function ReportarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tipo = searchParams.tipo ?? 'Bache';

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Bachejoa Map
            </p>
            <h1 className="text-3xl font-[var(--font-display)] text-slate-900">
              Reportar {tipo}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Confirma el tipo seleccionado y continúa al mapa para ubicar el punto.
            </p>
          </div>
          <Link
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
            href="/map"
          >
            Abrir mapa
          </Link>
        </header>

        <section className="mt-10 space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            <h2 className="text-lg font-semibold">Resumen rápido</h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Tipo seleccionado
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {tipo}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Paso siguiente
                </p>
                <p className="mt-2 text-sm">
                  En el mapa, coloca el pin donde viste el bache y agrega una foto.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full bg-yellow-400 px-6 py-2 text-sm font-semibold text-slate-900"
              href="/map"
            >
              Ir al mapa
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-6 py-2 text-sm text-slate-700"
              href="/reportes"
            >
              Cambiar tipo
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
