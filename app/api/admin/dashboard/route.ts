import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../lib/auth';
import { safeErrorResponse } from '../../../../lib/api';
import { resolveZoneByCoordinates } from '../../../../lib/zones';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

const TRAFFIC_DAYS = 14;

type TrafficRow = {
  created_at: string;
};

type DashboardUser = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'citizen';
  created_at: string;
};

type ReportPoint = {
  lat: number;
  lng: number;
};

function relationMissing(errorCode?: string) {
  return errorCode === '42P01';
}

function getDayKey(dateLike: string) {
  return new Date(dateLike).toISOString().slice(0, 10);
}

function buildDayBuckets(days: number) {
  const result: string[] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() - i);
    result.push(day.toISOString().slice(0, 10));
  }
  return result;
}

function aggregateByDay(rows: TrafficRow[], buckets: string[]) {
  const map = new Map<string, number>();
  buckets.forEach((key) => map.set(key, 0));
  rows.forEach((row) => {
    const key = getDayKey(row.created_at);
    if (!map.has(key)) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return buckets.map((key) => map.get(key) ?? 0);
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Acceso solo para administradores.' },
      { status: 403 },
    );
  }

  const sinceDate = new Date(Date.now() - TRAFFIC_DAYS * 24 * 60 * 60 * 1000);
  const sinceIso = sinceDate.toISOString();
  const trafficDays = buildDayBuckets(TRAFFIC_DAYS);

  const [
    totalUsersQuery,
    totalReportsQuery,
    totalRepairedQuery,
    totalWithPhotoQuery,
    usersListQuery,
    inboxQuery,
    reportsTrafficQuery,
    usersTrafficQuery,
    contactsTrafficQuery,
    reportsZoneQuery,
  ] = await Promise.all([
    supabaseServer.from('users').select('id', { head: true, count: 'exact' }),
    supabaseServer.from('reports').select('id', { head: true, count: 'exact' }),
    supabaseServer
      .from('reports')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'Reparado'),
    supabaseServer
      .from('reports')
      .select('id', { head: true, count: 'exact' })
      .not('photo_url', 'is', null),
    supabaseServer
      .from('users')
      .select('id, username, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseServer
      .from('contact_requests')
      .select('id, name, contact, topic, message, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseServer
      .from('reports')
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabaseServer
      .from('users')
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabaseServer
      .from('contact_requests')
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabaseServer.from('reports').select('lat,lng').limit(8000),
  ]);

  if (usersListQuery.error || totalUsersQuery.error || totalReportsQuery.error) {
    return safeErrorResponse(
      usersListQuery.error ?? totalUsersQuery.error ?? totalReportsQuery.error,
      'No se pudo cargar el panel admin.',
    );
  }

  const inboxMissing = relationMissing(inboxQuery.error?.code);
  const contactsTrafficMissing = relationMissing(contactsTrafficQuery.error?.code);

  if (
    (inboxQuery.error && !inboxMissing) ||
    (contactsTrafficQuery.error && !contactsTrafficMissing)
  ) {
    return safeErrorResponse(
      inboxQuery.error ?? contactsTrafficQuery.error,
      'No se pudo cargar la bandeja de contacto.',
    );
  }

  const reportsTrafficRows = (reportsTrafficQuery.data ?? []) as TrafficRow[];
  const usersTrafficRows = (usersTrafficQuery.data ?? []) as TrafficRow[];
  const users = (usersListQuery.data ?? []) as DashboardUser[];
  const reportPoints = (reportsZoneQuery.data ?? []) as ReportPoint[];
  const contactsTrafficRows = contactsTrafficMissing
    ? []
    : (((contactsTrafficQuery.data ?? []) as TrafficRow[]) ?? []);

  const traffic = {
    days: trafficDays,
    reports: aggregateByDay(reportsTrafficRows, trafficDays),
    signups: aggregateByDay(usersTrafficRows, trafficDays),
    contacts: aggregateByDay(contactsTrafficRows, trafficDays),
  };

  const zoneCountMap = new Map<string, number>();
  reportPoints.forEach((point) => {
    const zone = resolveZoneByCoordinates(point.lat, point.lng);
    zoneCountMap.set(zone.name, (zoneCountMap.get(zone.name) ?? 0) + 1);
  });
  const zones = Array.from(zoneCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    me: user,
    summary: {
      total_users: totalUsersQuery.count ?? 0,
      total_reports: totalReportsQuery.count ?? 0,
      total_repaired: totalRepairedQuery.count ?? 0,
      total_with_photo: totalWithPhotoQuery.count ?? 0,
      admin_users: users.filter((item) => item.role === 'admin').length,
      citizen_users: users.filter((item) => item.role !== 'admin').length,
      contact_requests: inboxMissing ? 0 : (inboxQuery.data?.length ?? 0),
    },
    users,
    inbox: inboxMissing ? [] : (inboxQuery.data ?? []),
    traffic,
    zones,
    warnings: [
      ...(inboxMissing
        ? ['La tabla public.contact_requests no existe en esta base de datos.']
        : []),
      ...(contactsTrafficMissing
        ? ['No se pudo incluir tráfico de contactos por falta de tabla.']
        : []),
    ],
  });
}
