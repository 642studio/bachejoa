'use client';

import { useEffect, useMemo, useState } from 'react';

type ReportRecord = {
  id: string;
  lat: number;
  lng: number;
  type: string;
  photo_url: string | null;
  created_at: string;
  angry_count: number | null;
  repaired?: boolean | null;
  repaired_at?: string | null;
  repair_rating_avg?: number | null;
  repair_rating_count?: number | null;
};

const bacheTypes = [
  'Pequeña grieta',
  'Bache',
  'Bachesón',
  'Reparación inconclusa',
];

export default function StatsPage() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    const fetchAllReports = async () => {
      let all: ReportRecord[] = [];
      let cursor: { cursor: string; cursor_id: string } | null = null;
      while (true) {
        const params = new URLSearchParams();
        params.set('limit', '200');
        if (cursor) {
          params.set('cursor', cursor.cursor);
          params.set('cursor_id', cursor.cursor_id);
        }
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) break;
        const payload = (await res.json()) as {
          data: ReportRecord[];
          nextCursor: { cursor: string; cursor_id: string } | null;
        };
        const chunk = payload.data ?? [];
        all = all.concat(chunk);
        if (!payload.nextCursor) break;
        cursor = payload.nextCursor;
      }
      return all;
    };

    fetchAllReports()
      .then((data) => {
        if (!isActive) return;
        setReports(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!isActive) return;
        setReports([]);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const totals = useMemo(() => {
    const counts = new Map<string, number>();
    bacheTypes.forEach((type) => counts.set(type, 0));
    for (const report of reports) {
      const current = counts.get(report.type) ?? 0;
      counts.set(report.type, current + 1);
    }
    return counts;
  }, [reports]);

  const topAngry = useMemo(() => {
    return [...reports]
      .sort((a, b) => (b.angry_count ?? 0) - (a.angry_count ?? 0))
      .slice(0, 5);
  }, [reports]);

  const totalReports = reports.length;
  const totalAngry = reports.reduce(
    (sum, report) => sum + (report.angry_count ?? 0),
    0,
  );
  const withPhoto = reports.filter((report) => report.photo_url).length;
  const repairedTotal = reports.filter((report) => report.repaired).length;
  const repairedRated = reports.filter(
    (report) => (report.repair_rating_count ?? 0) > 0,
  ).length;
  const repairAvg =
    reports.reduce(
      (sum, report) =>
        sum + (report.repair_rating_avg ?? 0) * (report.repair_rating_count ?? 0),
      0,
    ) /
    Math.max(
      1,
      reports.reduce((sum, report) => sum + (report.repair_rating_count ?? 0), 0),
    );

  const latestRepaired = useMemo(() => {
    return reports
      .filter((report) => report.repaired && report.repaired_at)
      .sort(
        (a, b) =>
          new Date(b.repaired_at ?? 0).getTime() -
          new Date(a.repaired_at ?? 0).getTime(),
      )
      .slice(0, 5);
  }, [reports]);

  const latestWithPhoto = useMemo(() => {
    return reports
      .filter((report) => report.photo_url)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 6);
  }, [reports]);

  return (
    <main className="reportes-root min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="w-full text-center">
            <img
              alt="Bachejoa Map"
              className="mx-auto h-12 w-auto"
              src="/logo.png"
            />
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              Dashboard ciudadano
            </p>
            <h1 className="text-3xl font-[var(--font-display)] text-slate-900">
              Estadísticas de Bachejoa
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Un vistazo rápido a los reportes y su impacto.
            </p>
          </div>
          <a
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
            href="/map"
          >
            Volver al mapa
          </a>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            <h2 className="text-lg font-semibold">Resumen general</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl bg-sky-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Reportes
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : totalReports}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Reparados
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : repairedTotal}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Con foto
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : withPhoto}
                </p>
              </div>
              <div className="rounded-2xl bg-rose-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Me enojas
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : totalAngry}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-sky-200 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.15)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h3 className="text-lg font-semibold">El Presi reporta</h3>
                <p className="mt-2 text-sm text-slate-700">
                  “Aquí está el pulso de la ciudad. Entre más reportes, más presión
                  para arreglar lo que duele.”
                </p>
              </div>
              <img
                alt="El Presi"
                className="mx-auto h-44 w-auto sm:mx-0 sm:h-48 md:h-56"
                src="/personajes/presifull.svg"
              />
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Top 5 baches más odiados</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Basado en “Me enojas”
            </p>
          </div>
          <div className="mt-5 grid gap-4">
            {isLoading && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Cargando ranking...
              </div>
            )}
            {!isLoading && topAngry.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aún no hay reportes con reacciones.
              </div>
            )}
            {!isLoading &&
              topAngry.map((report, index) => (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {report.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(report.created_at).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600">
                      {report.angry_count ?? 0} enojos
                    </span>
                    <a
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                      href={`/map?focus=${report.id}`}
                    >
                      Ver en mapa
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="mt-10 rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <h2 className="text-lg font-semibold">Por tipo de reporte</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bacheTypes.map((type) => (
              <div
                key={type}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {type}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : totals.get(type) ?? 0}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            <h2 className="text-lg font-semibold">Reparaciones</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-emerald-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Reparadas
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : repairedTotal}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Con calificación
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : repairedRated}
                </p>
              </div>
              <div className="rounded-2xl bg-sky-100/80 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Promedio
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {isLoading ? '...' : repairAvg.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            <h3 className="text-lg font-semibold">Últimos 5 reparados</h3>
            <div className="mt-4 grid gap-3">
              {isLoading && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Cargando reparaciones...
                </div>
              )}
              {!isLoading && latestRepaired.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Aún no hay reparaciones reportadas.
                </div>
              )}
              {!isLoading &&
                latestRepaired.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {report.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        Reparado:{' '}
                        {new Date(report.repaired_at ?? '').toLocaleDateString(
                          'es-MX',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          },
                        )}
                      </p>
                    </div>
                    <a
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                      href={`/map?focus=${report.id}`}
                    >
                      Ver en mapa
                    </a>
                  </div>
                ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Últimos con foto</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Reportes recientes
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Cargando fotos...
              </div>
            )}
            {!isLoading && latestWithPhoto.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aún no hay reportes con foto.
              </div>
            )}
            {!isLoading &&
              latestWithPhoto.map((report) => (
                <div
                  key={report.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="h-36 w-full overflow-hidden bg-slate-100">
                    <img
                      alt={`Reporte ${report.type}`}
                      className="h-full w-full object-cover"
                      src={report.photo_url ?? ''}
                    />
                  </div>
                  <div className="px-4 py-3 text-sm text-slate-700">
                    <p className="font-semibold">{report.type}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <a
                      className="mt-2 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                      href={`/map?focus=${report.id}`}
                    >
                      Ver en mapa
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
