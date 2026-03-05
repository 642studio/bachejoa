'use client';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6">
        <main className="w-full max-w-lg rounded-3xl border-4 border-slate-900 bg-white shadow-[10px_10px_0_#0f172a] p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
            Error global
          </p>
          <h1 className="mt-3 text-2xl font-bold">No pudimos cargar Bachejoa</h1>
          <p className="mt-3 text-sm text-slate-600">
            Reinicia la pantalla y vuelve a intentar.
          </p>
          <pre className="mt-4 rounded-xl bg-slate-100 p-3 text-left text-xs text-slate-700 overflow-auto">
            {error.message || 'Error desconocido'}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 inline-flex items-center justify-center rounded-full border-2 border-slate-900 bg-yellow-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-[4px_4px_0_#0f172a]"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
