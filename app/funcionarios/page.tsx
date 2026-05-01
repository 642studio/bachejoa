'use client';

import { useEffect, useMemo, useState } from 'react';
import { REPORT_CATEGORIES, REPORT_STATUS_STAGES } from '../../lib/reporting';
import { CITY_ZONES } from '../../lib/zones';

type DashboardPayload = {
  viewer:
    | {
        role: 'admin';
        username: string;
        email: string;
      }
    | {
        role: 'official';
        username: string;
        full_name: string;
        area: string;
        categories: string[];
        zones: string[];
      };
  can_manage_credentials: boolean;
  allowed_categories: string[];
  allowed_zones: string[];
  reports: Array<{
    id: string;
    created_at: string;
    category: string;
    subcategory: string;
    status: string;
    lat: number;
    lng: number;
    photo_url: string | null;
    zone_id?: string | null;
    zone_name?: string | null;
  }>;
  summary: {
    total_open: number;
    visible: number;
    verified: number;
    in_review: number;
    repaired: number;
  };
  officials: Array<{
    id: string;
    username: string;
    full_name: string;
    email: string | null;
    area: string | null;
    categories: string[];
    zones?: string[];
    active: boolean;
    created_at: string;
    last_login_at: string | null;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function FuncionariosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newZones, setNewZones] = useState<string[]>([]);
  const [creatingOfficial, setCreatingOfficial] = useState(false);
  const [createError, setCreateError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/officials/dashboard');
    const data = (await res.json().catch(() => ({}))) as
      | DashboardPayload
      | { error?: string };
    if (res.status === 401) {
      setDashboard(null);
      setLoginOpen(true);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError('error' in data ? (data.error ?? 'No se pudo cargar.') : 'No se pudo cargar.');
      setLoading(false);
      return;
    }
    setDashboard(data as DashboardPayload);
    setLoginOpen(false);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard().catch(() => {
      setError('No se pudo cargar.');
      setLoading(false);
    });
  }, []);

  const reportRows = useMemo(() => dashboard?.reports ?? [], [dashboard]);

  async function loginOfficial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/officials/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setLoginError(data.error ?? 'Credenciales invalidas.');
        return;
      }
      setLoginUsername('');
      setLoginPassword('');
      await loadDashboard();
    } finally {
      setLoginLoading(false);
    }
  }

  async function logoutOfficial() {
    await fetch('/api/officials/logout', { method: 'POST' });
    setDashboard(null);
    setLoginOpen(true);
  }

  async function updateStatus(reportId: string, status: string) {
    setStatusLoadingId(reportId);
    setNotice('');
    try {
      const res = await fetch(`/api/officials/reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? 'No se pudo actualizar.');
        return;
      }
      await loadDashboard();
      setNotice('Etapa actualizada.');
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function createOfficial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');
    setCreatingOfficial(true);
    try {
      const res = await fetch('/api/officials/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          full_name: newFullName,
          email: newEmail,
          area: newArea,
          categories: newCategories,
          zones: newZones,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? 'No se pudo crear la credencial.');
        return;
      }
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewEmail('');
      setNewArea('');
      setNewCategories([]);
      setNewZones([]);
      setNotice('Credencial de funcionario creada.');
      await loadDashboard();
    } finally {
      setCreatingOfficial(false);
    }
  }

  return (
    <main className="reportes-root min-h-screen px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="reportes-header rounded-[28px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              href="/map"
            >
              Volver al mapa
            </a>
            <img alt="Bachejoa Map" className="h-10 w-auto" src="/logo.png" />
            <a
              className="rounded-full border border-white/60 bg-white/60 px-5 py-2 text-sm font-semibold text-slate-700"
              href="/admin"
            >
              Ir a admin
            </a>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-slate-500">
            Dashboard de funcionarios
          </p>
          <h1 className="mt-2 text-3xl font-[var(--font-display)] text-slate-900">
            /funcionarios
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Estructura operativa: credenciales, bandeja por categoria asignada,
            seguimiento por etapa y control de atencion.
          </p>
          {notice ? <p className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
          {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
        </header>

        {loading ? (
          <section className="mt-6 rounded-3xl bg-white/90 p-6 text-sm text-slate-600 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            Cargando dashboard...
          </section>
        ) : null}

        {loginOpen && !loading ? (
          <section className="mt-6 rounded-3xl bg-white/95 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)] sm:max-w-md">
            <h2 className="text-lg font-semibold text-slate-900">Acceso funcionario</h2>
            <p className="mt-1 text-xs text-slate-500">
              Ingresa con credenciales entregadas por admin.
            </p>
            <form className="mt-4 grid gap-3" onSubmit={loginOfficial}>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Usuario"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Contrasena"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
              <button
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                disabled={loginLoading}
                type="submit"
              >
                {loginLoading ? 'Entrando...' : 'Entrar'}
              </button>
              {loginError ? <p className="text-xs text-rose-600">{loginError}</p> : null}
            </form>
          </section>
        ) : null}

        {dashboard && !loading ? (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_14px_26px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Abiertos</p>
                <p className="mt-2 text-3xl font-semibold">{dashboard.summary.total_open}</p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_14px_26px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Visible</p>
                <p className="mt-2 text-3xl font-semibold">{dashboard.summary.visible}</p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_14px_26px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Verificado</p>
                <p className="mt-2 text-3xl font-semibold">{dashboard.summary.verified}</p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_14px_26px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">En revision</p>
                <p className="mt-2 text-3xl font-semibold">{dashboard.summary.in_review}</p>
              </article>
              <article className="rounded-2xl bg-white/90 p-4 shadow-[0_14px_26px_rgba(15,23,42,0.12)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reparado</p>
                <p className="mt-2 text-3xl font-semibold">{dashboard.summary.repaired}</p>
              </article>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-3xl bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Bandeja de atencion</h2>
                  <div className="text-right text-xs text-slate-500">
                    <p>{dashboard.allowed_categories.join(' · ')}</p>
                    <p>
                      {dashboard.allowed_zones.length
                        ? `Zonas: ${dashboard.allowed_zones.join(' · ')}`
                        : 'Zonas: todas'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 max-h-[620px] overflow-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Fecha
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Categoria
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Zona
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Etapa
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Accion
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {reportRows.map((report) => (
                        <tr key={report.id}>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {formatDate(report.created_at)}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                            {report.category}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{report.subcategory}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {report.zone_name ?? 'Fuera de zona'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{report.status}</td>
                          <td className="px-3 py-2">
                            <select
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              disabled={statusLoadingId === report.id}
                              value={report.status}
                              onChange={(event) =>
                                updateStatus(report.id, event.target.value)
                              }
                            >
                              {REPORT_STATUS_STAGES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reportRows.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-slate-500">Sin reportes en bandeja.</p>
                  ) : null}
                </div>
              </article>

              <div className="grid gap-6">
                {dashboard.can_manage_credentials ? (
                  <article className="rounded-3xl bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                    <h2 className="text-lg font-semibold">Credenciales de funcionarios</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Solo admin puede crear credenciales y categorias asignadas.
                    </p>
                    <form className="mt-4 grid gap-2" onSubmit={createOfficial}>
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Username"
                        value={newUsername}
                        onChange={(event) => setNewUsername(event.target.value)}
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Contrasena temporal"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Nombre completo"
                        value={newFullName}
                        onChange={(event) => setNewFullName(event.target.value)}
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Correo"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Area (opcional)"
                        value={newArea}
                        onChange={(event) => setNewArea(event.target.value)}
                      />
                      <div className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        {REPORT_CATEGORIES.map((category) => (
                          <label key={category.name} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              checked={newCategories.includes(category.name)}
                              type="checkbox"
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setNewCategories((prev) => [...prev, category.name]);
                                } else {
                                  setNewCategories((prev) =>
                                    prev.filter((item) => item !== category.name),
                                  );
                                }
                              }}
                            />
                            {category.name}
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Zonas asignadas
                        </p>
                        {CITY_ZONES.map((zone) => (
                          <label key={zone.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              checked={newZones.includes(zone.id)}
                              type="checkbox"
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setNewZones((prev) => [...prev, zone.id]);
                                } else {
                                  setNewZones((prev) =>
                                    prev.filter((item) => item !== zone.id),
                                  );
                                }
                              }}
                            />
                            {zone.name}
                          </label>
                        ))}
                        <p className="text-[11px] text-slate-500">
                          Si no seleccionas zonas, atendera todas.
                        </p>
                      </div>
                      <button
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        disabled={creatingOfficial}
                        type="submit"
                      >
                        {creatingOfficial ? 'Creando...' : 'Crear credencial'}
                      </button>
                      {createError ? <p className="text-xs text-rose-600">{createError}</p> : null}
                    </form>
                  </article>
                ) : (
                  <article className="rounded-3xl bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                    <h2 className="text-lg font-semibold">Sesion de funcionario</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {dashboard.viewer.role === 'official'
                        ? `Responsable: ${dashboard.viewer.full_name} (${dashboard.viewer.username}) · Zonas: ${
                            dashboard.viewer.zones.length
                              ? dashboard.viewer.zones.join(' · ')
                              : 'todas'
                          }`
                        : ''}
                    </p>
                    <button
                      className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={logoutOfficial}
                      type="button"
                    >
                      Cerrar sesion funcionario
                    </button>
                  </article>
                )}

                {dashboard.can_manage_credentials ? (
                  <article className="rounded-3xl bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                    <h2 className="text-lg font-semibold">Funcionarios registrados</h2>
                    <div className="mt-3 max-h-[260px] overflow-auto space-y-2 pr-1">
                      {dashboard.officials.map((official) => (
                        <div key={official.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {official.full_name} (@{official.username})
                          </p>
                          <p className="text-xs text-slate-600">
                            {official.email || 'Sin correo'} · {official.area || 'Sin area'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Categorias: {official.categories.join(' · ')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Zonas: {(official.zones ?? []).length ? (official.zones ?? []).join(' · ') : 'todas'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Alta: {formatDate(official.created_at)}
                          </p>
                        </div>
                      ))}
                      {dashboard.officials.length === 0 ? (
                        <p className="text-xs text-slate-500">Sin funcionarios cargados.</p>
                      ) : null}
                    </div>
                  </article>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
