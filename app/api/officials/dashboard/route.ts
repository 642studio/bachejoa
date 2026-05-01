import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../lib/auth';
import { getOfficialSessionAccount } from '../../../../lib/officials';
import { safeErrorResponse } from '../../../../lib/api';
import { REPORT_SELECT, REPORT_CATEGORIES } from '../../../../lib/reporting';
import { supabaseServer } from '../../../../lib/supabase/server';
import { resolveZoneByCoordinates } from '../../../../lib/zones';

export const runtime = 'nodejs';

type ReportRow = {
  id: string;
  status: string;
  category: string;
  subcategory: string;
  lat: number;
  lng: number;
  zone_id?: string | null;
  zone_name?: string | null;
};

export async function GET(request: Request) {
  const [user, official] = await Promise.all([
    getSessionUser(request),
    getOfficialSessionAccount(request),
  ]);
  const isAdmin = isPlatformAdmin(user);

  if (!isAdmin && !official) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const allowedCategories = isAdmin
    ? REPORT_CATEGORIES.map((item) => item.name)
    : (official?.categories ?? []);
  const allowedZones = isAdmin ? [] : ((official?.zones as string[] | undefined) ?? []);

  let reports: ReportRow[] = [];
  if (allowedCategories.length > 0) {
    const { data, error } = await supabaseServer
      .from('reports')
      .select(REPORT_SELECT)
      .in('category', allowedCategories)
      .neq('status', 'Archivado')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return safeErrorResponse(error, 'No se pudieron cargar los reportes.');
    }
    reports = (data ?? []) as ReportRow[];
  }

  if (!isAdmin && allowedZones.length > 0) {
    reports = reports.filter((report) => {
      const zone = resolveZoneByCoordinates(report.lat, report.lng);
      return allowedZones.includes(zone.id);
    });
  }

  reports = reports.map((report) => {
    const zone = resolveZoneByCoordinates(report.lat, report.lng);
    return {
      ...report,
      zone_id: report.zone_id ?? zone.id,
      zone_name: report.zone_name ?? zone.name,
    };
  });

  const summary = {
    total_open: reports.length,
    visible: reports.filter((item) => item.status === 'Visible').length,
    verified: reports.filter((item) => item.status === 'Verificado').length,
    in_review: reports.filter((item) => item.status === 'En revisión').length,
    repaired: reports.filter((item) => item.status === 'Reparado').length,
  };

  let officials: Array<{
    id: string;
    username: string;
    full_name: string;
    email: string | null;
    area: string | null;
    categories: string[];
    active: boolean;
    created_at: string;
    last_login_at: string | null;
  }> = [];

  if (isAdmin) {
    const { data, error } = await supabaseServer
      .from('official_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      return safeErrorResponse(error, 'No se pudieron cargar los funcionarios.');
    }
    officials = (data ?? []).map((item) => ({
      ...item,
      categories: item.categories ?? [],
      zones: item.zones ?? [],
    }));
  }

  return NextResponse.json({
    viewer: isAdmin
      ? {
          role: 'admin',
          username: user?.username ?? '',
          email: user?.email ?? '',
        }
      : {
          role: 'official',
          username: official?.username ?? '',
          full_name: official?.full_name ?? '',
          area: official?.area ?? '',
          categories: official?.categories ?? [],
          zones: (official?.zones as string[] | undefined) ?? [],
        },
    can_manage_credentials: isAdmin,
    allowed_categories: allowedCategories,
    allowed_zones: allowedZones,
    reports,
    summary,
    officials,
  });
}
