'use client';

import { useEffect, useMemo, useState } from 'react';
import { REPORT_CATEGORIES } from '../../lib/reporting';

type AccountUser = {
  id: string;
  username: string;
  email: string;
  role?: 'citizen' | 'admin';
  avatar_key?: string;
  created_at?: string;
};

type AccountReport = {
  id: string;
  created_at: string;
  lat: number;
  lng: number;
  category: string | null;
  subcategory: string | null;
  status: string | null;
  photo_url: string | null;
  angry_count: number | null;
  repaired: boolean | null;
  repaired_at: string | null;
};

type Medal = {
  id: string;
  group: string;
  icon: string;
  title: string;
  description: string;
  points: number;
  threshold?: number;
  progress?: (metrics: Metrics) => number;
  achieved?: (metrics: Metrics) => boolean;
  manual?: boolean;
};

type Metrics = {
  totalReports: number;
  validReports: number;
  withPhoto: number;
  verifiedByStatus: number;
  repairedCount: number;
  changedStatusCount: number;
  repairedFromUser: number;
  distinctZones: number;
  bachesonCount: number;
  strongEvidenceCount: number;
  earlyActionCount: number;
};

const medals: Medal[] = [
  {
    id: 'first-report',
    group: 'Participación',
    icon: '🧱',
    title: 'Primer Reporte',
    description: 'Se desbloquea al enviar 1 reporte.',
    points: 10,
    threshold: 1,
    progress: (m) => m.validReports,
  },
  {
    id: 'vecino-atento',
    group: 'Participación',
    icon: '🧱',
    title: 'Vecino Atento',
    description: '5 reportes válidos.',
    points: 20,
    threshold: 5,
    progress: (m) => m.validReports,
  },
  {
    id: 'ojo-calle',
    group: 'Participación',
    icon: '🧱',
    title: 'Ojo en la Calle',
    description: '15 reportes válidos.',
    points: 35,
    threshold: 15,
    progress: (m) => m.validReports,
  },
  {
    id: 'cronista-urbano',
    group: 'Participación',
    icon: '🧱',
    title: 'Cronista Urbano',
    description: '30 reportes válidos.',
    points: 55,
    threshold: 30,
    progress: (m) => m.validReports,
  },
  {
    id: 'patrulla-ciudadana',
    group: 'Participación',
    icon: '🧱',
    title: 'Patrulla Ciudadana',
    description: '50 reportes verificados.',
    points: 90,
    threshold: 50,
    progress: (m) => m.verifiedByStatus,
  },

  {
    id: 'testigo-visual',
    group: 'Calidad',
    icon: '📸',
    title: 'Testigo Visual',
    description: 'Primer reporte con foto.',
    points: 15,
    threshold: 1,
    progress: (m) => m.withPhoto,
  },
  {
    id: 'verificador-campo',
    group: 'Calidad',
    icon: '📸',
    title: 'Verificador de Campo',
    description: '5 reportes con evidencia.',
    points: 35,
    threshold: 5,
    progress: (m) => m.withPhoto,
  },
  {
    id: 'archivo-realidad',
    group: 'Calidad',
    icon: '📸',
    title: 'Archivo de la Realidad',
    description: '15 reportes verificados por imagen.',
    points: 70,
    threshold: 15,
    progress: (m) => m.withPhoto,
  },

  {
    id: 'detectado',
    group: 'Impacto',
    icon: '🔎',
    title: 'Detectado',
    description: 'Uno de tus reportes cambia de estado.',
    points: 20,
    threshold: 1,
    progress: (m) => m.changedStatusCount,
  },
  {
    id: 'ya-quedo',
    group: 'Impacto',
    icon: '🔎',
    title: 'Ya Quedó',
    description: 'Un reporte tuyo marcado como reparado.',
    points: 30,
    threshold: 1,
    progress: (m) => m.repairedFromUser,
  },
  {
    id: 'si-sirvio',
    group: 'Impacto',
    icon: '🔎',
    title: 'Sí Sirvió',
    description: '5 reportes que pasaron a reparado.',
    points: 75,
    threshold: 5,
    progress: (m) => m.repairedFromUser,
  },

  {
    id: 'recorredor-colonias',
    group: 'Cobertura',
    icon: '🗺️',
    title: 'Recorredor de Colonias',
    description: 'Reportes en 3 zonas distintas.',
    points: 25,
    threshold: 3,
    progress: (m) => m.distinctZones,
  },
  {
    id: 'cartografo-bache',
    group: 'Cobertura',
    icon: '🗺️',
    title: 'Cartógrafo del Bache',
    description: 'Reportes en 6 zonas distintas.',
    points: 55,
    threshold: 6,
    progress: (m) => m.distinctZones,
  },
  {
    id: 'conoce-ciudad',
    group: 'Cobertura',
    icon: '🗺️',
    title: 'Conoce la Ciudad',
    description: 'Reportes distribuidos en zonas distintas.',
    points: 90,
    threshold: 10,
    progress: (m) => m.distinctZones,
  },

  {
    id: 'esquivador',
    group: 'ADN Bachejoa',
    icon: '😏',
    title: 'Esquivador Profesional',
    description: '10 reportes.',
    points: 25,
    threshold: 10,
    progress: (m) => m.totalReports,
  },
  {
    id: 'suspension-riesgo',
    group: 'ADN Bachejoa',
    icon: '😏',
    title: 'Suspensión en Riesgo',
    description: '20 reportes.',
    points: 45,
    threshold: 20,
    progress: (m) => m.totalReports,
  },
  {
    id: 'era-crater',
    group: 'ADN Bachejoa',
    icon: '😏',
    title: 'Esto Ya Era Cráter',
    description: 'Primer “bachesón”.',
    points: 25,
    threshold: 1,
    progress: (m) => m.bachesonCount,
  },
  {
    id: 'no-era-charco',
    group: 'ADN Bachejoa',
    icon: '😏',
    title: 'No Era Charco',
    description: 'Reporte con evidencia fuerte.',
    points: 30,
    threshold: 1,
    progress: (m) => m.strongEvidenceCount,
  },
  {
    id: 'lo-vi-lo-marque',
    group: 'ADN Bachejoa',
    icon: '😏',
    title: 'Lo Vi, Lo Marqué',
    description: 'Acción rápida tras crear cuenta.',
    points: 20,
    threshold: 1,
    progress: (m) => m.earlyActionCount,
  },

  {
    id: 'fundadores',
    group: 'Especiales',
    icon: '⭐',
    title: 'Fundadores del Mapa',
    description: 'Usuarios de las primeras semanas.',
    points: 120,
    manual: true,
  },
  {
    id: 'historicas-24h',
    group: 'Especiales',
    icon: '⭐',
    title: '24 Horas Históricas',
    description: 'Participaron en el día del lanzamiento.',
    points: 100,
    manual: true,
  },
  {
    id: 'modo-sonora',
    group: 'Especiales',
    icon: '⭐',
    title: 'Modo Sonora',
    description: 'Primeros reportes fuera de Navojoa.',
    points: 140,
    manual: true,
  },
];

const levels = [
  { name: 'Nivel 1 · Observador', min: 0 },
  { name: 'Nivel 2 · Vecino Activo', min: 60 },
  { name: 'Nivel 3 · Reportero Urbano', min: 150 },
  { name: 'Nivel 4 · Auditor Ciudadano', min: 280 },
  { name: 'Nivel 5 · Agente Cívico', min: 430 },
  { name: 'Nivel 6 · Leyenda Bachejoa', min: 650 },
];

function zoneKey(lat: number, lng: number) {
  return `${lat.toFixed(2)}|${lng.toFixed(2)}`;
}

export default function CuentaPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [reports, setReports] = useState<AccountReport[]>([]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetch('/api/account')
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          user?: AccountUser;
          reports?: AccountReport[];
        };
        if (!res.ok) {
          throw new Error(payload.error ?? 'No se pudo cargar tu cuenta.');
        }
        if (!active) return;
        setUser(payload.user ?? null);
        setReports(payload.reports ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Error inesperado.');
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo<Metrics>(() => {
    const totalReports = reports.length;
    const validReports = reports.filter((r) => r.status !== 'Archivado').length;
    const withPhoto = reports.filter((r) => Boolean(r.photo_url)).length;
    const verifiedByStatus = reports.filter((r) => r.status === 'Verificado').length;
    const repairedCount = reports.filter((r) => r.status === 'Reparado' || r.repaired).length;
    const changedStatusCount = reports.filter(
      (r) => r.status && !['Creado', 'Visible'].includes(r.status),
    ).length;
    const repairedFromUser = reports.filter(
      (r) => r.status === 'Reparado' || r.repaired,
    ).length;
    const distinctZones = new Set(reports.map((r) => zoneKey(r.lat, r.lng))).size;
    const bachesonCount = reports.filter(
      (r) => (r.subcategory ?? r.category ?? '').toLowerCase() === 'bacheson',
    ).length;
    const strongEvidenceCount = reports.filter(
      (r) => Boolean(r.photo_url) && (r.angry_count ?? 0) >= 3,
    ).length;
    const accountCreated = new Date(user?.created_at ?? 0).getTime();
    const earlyActionCount = reports.filter((r) => {
      if (!accountCreated) return false;
      return new Date(r.created_at).getTime() <= accountCreated + 24 * 60 * 60 * 1000;
    }).length;

    return {
      totalReports,
      validReports,
      withPhoto,
      verifiedByStatus,
      repairedCount,
      changedStatusCount,
      repairedFromUser,
      distinctZones,
      bachesonCount,
      strongEvidenceCount,
      earlyActionCount,
    };
  }, [reports, user?.created_at]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    REPORT_CATEGORIES.forEach((c) => map.set(c.name, 0));
    reports.forEach((r) => {
      const key = r.category ?? 'Baches';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [reports]);

  const subtypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    REPORT_CATEGORIES.forEach((c) =>
      c.subcategories.forEach((s) => map.set(`${c.name}::${s}`, 0)),
    );
    reports.forEach((r) => {
      const key = `${r.category ?? 'Baches'}::${r.subcategory ?? r.category ?? ''}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [reports]);

  const medalState = useMemo(() => {
    const withProgress = medals.map((m) => {
      if (m.manual) return { ...m, earned: false, current: 0 };
      const current = m.progress ? m.progress(metrics) : 0;
      const earned = m.achieved ? m.achieved(metrics) : current >= (m.threshold ?? 1);
      return { ...m, earned, current };
    });

    const score = withProgress
      .filter((m) => m.earned)
      .reduce((sum, m) => sum + m.points, 0);

    const currentLevel =
      [...levels].reverse().find((level) => score >= level.min) ?? levels[0];
    const nextLevel = levels.find((level) => level.min > currentLevel.min) ?? null;

    const progress = nextLevel
      ? Math.min(
          100,
          Math.round(
            ((score - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100,
          ),
        )
      : 100;

    return { withProgress, score, currentLevel, nextLevel, progress };
  }, [metrics]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-10">Cargando tu cuenta...</div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <h1 className="text-3xl font-[var(--font-display)]">Mi Cuenta</h1>
          <p className="mt-4 text-sm text-slate-600">
            {error ?? 'Necesitas iniciar sesión para ver tu cuenta.'}
          </p>
          <a
            href="/map"
            className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Ir al mapa
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">
              Panel de Cuenta
            </p>
            <h1 className="mt-1 text-4xl font-[var(--font-display)]">Mi Cuenta</h1>
            <p className="mt-2 text-sm text-slate-600">
              Gestión de perfil, historial y progreso ciudadano.
            </p>
          </div>
          <a
            href="/map"
            className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Volver al mapa
          </a>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4">
              <img
                src={`/avatares/${user.avatar_key ?? 'bart.svg'}`}
                alt="Avatar"
                className="h-20 w-20 rounded-full border border-slate-200 bg-slate-50 object-cover"
              />
              <div>
                <p className="text-2xl font-semibold">@{user.username}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Miembro desde{' '}
                  {new Date(user.created_at ?? '').toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-100 p-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Reportes</p>
                <p className="mt-2 text-3xl font-semibold">{metrics.totalReports}</p>
              </div>
              <div className="rounded-2xl bg-cyan-100 p-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Verificados</p>
                <p className="mt-2 text-3xl font-semibold">{metrics.verifiedByStatus}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Reparados</p>
                <p className="mt-2 text-3xl font-semibold">{metrics.repairedCount}</p>
              </div>
              <div className="rounded-2xl bg-amber-100 p-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Con foto</p>
                <p className="mt-2 text-3xl font-semibold">{metrics.withPhoto}</p>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold">Desglose por categoría</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {REPORT_CATEGORIES.map((category) => (
                  <div key={category.name} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{category.name}</p>
                    <p className="mt-2 text-2xl font-semibold">{categoryCounts.get(category.name) ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold">Desglose por tipo de reporte</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {REPORT_CATEGORIES.flatMap((category) =>
                  category.subcategories.map((subtype) => {
                    const key = `${category.name}::${subtype}`;
                    return (
                      <div key={key} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {category.name}
                        </p>
                        <p className="text-sm font-semibold">{subtype}</p>
                        <p className="mt-2 text-xl font-semibold">{subtypeCounts.get(key) ?? 0}</p>
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-3xl bg-white p-6 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Puntuación</p>
            <p className="mt-2 text-4xl font-semibold text-slate-900">{medalState.score}</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">{medalState.currentLevel.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {medalState.nextLevel
                ? `Siguiente: ${medalState.nextLevel.name} (${medalState.nextLevel.min} pts)`
                : 'Nivel máximo alcanzado'}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${medalState.progress}%` }}
              />
            </div>

            <div className="mt-6 grid gap-2 text-sm">
              <p className="font-semibold">Borrador de premios</p>
              <p className="text-xs text-slate-500">
                Propuesta inicial para gamificación y niveles.
              </p>
            </div>
            <div className="mt-3 max-h-[580px] space-y-2 overflow-auto pr-1">
              {medalState.withProgress.map((medal) => {
                const threshold = medal.threshold ?? 0;
                const current = (medal as Medal & { current?: number }).current ?? 0;
                const earned = (medal as Medal & { earned?: boolean }).earned ?? false;
                return (
                  <div
                    key={medal.id}
                    className={`rounded-xl border px-3 py-2 ${
                      earned
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      {medal.group}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {medal.icon} {medal.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{medal.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {medal.manual
                        ? `Manual · ${medal.points} pts`
                        : `Progreso ${current}/${threshold} · ${medal.points} pts`}
                    </p>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold">Historial de reportes</h2>
          {reports.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aún no tienes reportes en tu cuenta.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {report.category ?? 'Baches'} · {report.subcategory ?? report.category ?? 'Sin tipo'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {report.status ?? 'Visible'} · {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.photo_url ? (
                      <img
                        src={report.photo_url}
                        alt="Evidencia"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
                        Sin foto
                      </div>
                    )}
                    <a
                      href={`/map?focus=${report.id}`}
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Ver
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
