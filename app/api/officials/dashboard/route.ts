import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../lib/auth';
import { getOfficialSessionAccount } from '../../../../lib/officials';
import { REPORT_SELECT, REPORT_CATEGORIES } from '../../../../lib/reporting';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type ReportRow = {
  id: string;
  status: string;
  category: string;
  subcategory: string;
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    reports = (data ?? []) as ReportRow[];
  }

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
      .select(
        'id, username, full_name, email, area, categories, active, created_at, last_login_at',
      )
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    officials = (data ?? []).map((item) => ({
      ...item,
      categories: item.categories ?? [],
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
        },
    can_manage_credentials: isAdmin,
    allowed_categories: allowedCategories,
    reports,
    summary,
    officials,
  });
}
