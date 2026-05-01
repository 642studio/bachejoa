'use client';

import { useEffect, useMemo, useState } from 'react';

type AdminUser = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'citizen';
  created_at: string;
};

type ContactInbox = {
  id: string;
  name: string;
  contact: string;
  topic: string | null;
  message: string;
  created_at: string;
};

type DashboardPayload = {
  me: {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'citizen';
  };
  summary: {
    total_users: number;
    total_reports: number;
    total_repaired: number;
    total_with_photo: number;
    admin_users: number;
    citizen_users: number;
    contact_requests: number;
  };
  users: AdminUser[];
  inbox: ContactInbox[];
  traffic: {
    days: string[];
    reports: number[];
    signups: number[];
    contacts: number[];
  };
  zones: Array<{
    name: string;
    count: number;
  }>;
  warnings: string[];
};

type DashboardError = {
  error?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDay(day: string) {
  return new Date(day).toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
  });
}

type SeriesKey = 'reports' | 'signups' | 'contacts';

const seriesLabel: Record<SeriesKey, string> = {
  reports: 'Reportes',
  signups: 'Registros',
  contacts: 'Contactos',
};

const seriesColor: Record<SeriesKey, string> = {
  reports: '#0f172a',
  signups: '#0ea5e9',
  contacts: '#22c55e',
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [trafficSeries, setTrafficSeries] = useState<SeriesKey>('reports');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/dashboard');
        const data = (await res.json().catch(() => ({}))) as
          | DashboardPayload
          | DashboardError;
        if (!active) return;
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
          setPayload(null);
          return;
        }
        if (!res.ok) {
          setError(
            'error' in data
              ? (data.error ?? 'No se pudo cargar el panel admin.')
              : 'No se pudo cargar el panel admin.',
          );
          return;
        }
        setPayload(data as DashboardPayload);
      } catch {
        if (!active) return;
        setError('No se pudo cargar el panel admin.');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const selectedSeries = useMemo(() => {
    if (!payload) return [];
    return payload.traffic[trafficSeries];
  }, [payload, trafficSeries]);

  const maxSeries = useMemo(() => {
    return Math.max(1, ...selectedSeries);
  }, [selectedSeries]);

  if (loading) {
    return (
      <main className="reportes-root min-h-screen px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-[32px] bg-white/90 p-8 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <p className="text-sm text-slate-600">Cargando panel admin...</p>
        </div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="reportes-root min-h-screen px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-rose-200 bg-white/95 p-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <p className="text-xs uppercase tracking-[0.3em] text-rose-500">Bloqueado</p>
          <h1 className="mt-3 text-3xl font-[var(--font-display)] text-slate-900">
            Acceso restringido
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Esta sección está disponible solamente para usuarios con rol admin.
          </p>
          <a
            className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
            href="/map"
          >
            Volver al mapa
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="reportes-root min-h-screen px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="reportes-header rounded-[32px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
              href="/map"
            >
              Volver al mapa
            </a>
            <img alt="Bachejoa Map" className="h-10 w-auto" src="/logo.png" />
            <a
              className="rounded-full border border-white/60 bg-white/60 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              href="/parche"
            >
              Notas del parche
            </a>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-500">
            Panel administrativo
          </p>
          <h1 className="mt-2 text-3xl font-[var(--font-display)]">/admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            Vista operativa para seguimiento de comunidad, reportes y contacto.
          </p>
          {payload ? (
            <p className="mt-2 text-xs text-slate-500">
              Sesión admin: @{payload.me.username} ({payload.me.email})
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          {payload?.warnings?.length ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {payload.warnings.join(' ')}
            </div>
          ) : null}
        </header>

        {payload && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Usuarios registrados
                </p>
                <p className="mt-2 text-3xl font-semibold">{payload.summary.total_users}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {payload.summary.admin_users} admin · {payload.summary.citizen_users} ciudadanos
                </p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reportes totales</p>
                <p className="mt-2 text-3xl font-semibold">{payload.summary.total_reports}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {payload.summary.total_repaired} reparados
                </p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Con foto</p>
                <p className="mt-2 text-3xl font-semibold">{payload.summary.total_with_photo}</p>
                <p className="mt-1 text-xs text-slate-500">Evidencia comunitaria</p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Bandeja contacto</p>
                <p className="mt-2 text-3xl font-semibold">{payload.summary.contact_requests}</p>
                <p className="mt-1 text-xs text-slate-500">Solicitudes recibidas</p>
              </article>
            </section>

            <section className="mt-6 rounded-[28px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Tráfico de los últimos días</h2>
                  <p className="text-xs text-slate-500">
                    Actividad de plataforma por día (14 días).
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
                  {(['reports', 'signups', 'contacts'] as SeriesKey[]).map((key) => (
                    <button
                      key={key}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        key === trafficSeries
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                      onClick={() => setTrafficSeries(key)}
                      type="button"
                    >
                      {seriesLabel[key]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-2 sm:grid-cols-14">
                {payload.traffic.days.map((day, index) => {
                  const value = selectedSeries[index] ?? 0;
                  const height = `${Math.max(8, Math.round((value / maxSeries) * 112))}px`;
                  return (
                    <div key={day} className="flex flex-col items-center justify-end gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">{value}</span>
                      <div
                        className="w-full rounded-md"
                        style={{
                          height,
                          backgroundColor: seriesColor[trafficSeries],
                        }}
                        title={`${formatDay(day)}: ${value}`}
                      />
                      <span className="text-[10px] text-slate-400">{formatDay(day)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 rounded-[28px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
              <h2 className="text-lg font-semibold">Distribución por zona</h2>
              <p className="mt-1 text-xs text-slate-500">
                Conteo automático por zona según coordenadas del reporte.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {payload.zones.map((zone) => (
                  <article
                    key={zone.name}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{zone.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{zone.count} reportes</p>
                  </article>
                ))}
                {payload.zones.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin datos de zonas.</p>
                ) : null}
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <article className="rounded-[28px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                <h2 className="text-lg font-semibold">Bandeja de contacto</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Personas que solicitaron seguimiento.
                </p>
                <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
                  {payload.inbox.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      No hay mensajes en bandeja.
                    </p>
                  ) : (
                    payload.inbox.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <span className="text-[11px] text-slate-500">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{item.contact}</p>
                        {item.topic ? (
                          <p className="mt-2 text-xs font-semibold text-slate-700">
                            Tema: {item.topic}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {item.message}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </article>

              <article className="rounded-[28px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                <h2 className="text-lg font-semibold">Usuarios registrados</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Usuarios de la plataforma y su rol actual.
                </p>
                <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Usuario
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Correo
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Rol
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Alta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {payload.users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-3 py-2 text-sm font-semibold text-slate-900">
                            @{user.username}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{user.email}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                user.role === 'admin'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-sky-100 text-sky-700'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {formatDate(user.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
