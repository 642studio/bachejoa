import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../../lib/auth';
import { getOfficialSessionAccount } from '../../../../../../lib/officials';
import { isValidReportStatus, REPORT_SELECT } from '../../../../../../lib/reporting';
import { supabaseServer } from '../../../../../../lib/supabase/server';
import { rateLimit } from '../../../../../../lib/security';

export const runtime = 'nodejs';

type StatusPayload = {
  status?: string;
};

const OFFICIAL_ALLOWED_STATUSES = new Set(['En revisión', 'Reparado', 'Archivado']);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'officials:reports:status', 30, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const [user, official] = await Promise.all([
    getSessionUser(request),
    getOfficialSessionAccount(request),
  ]);
  const isAdmin = isPlatformAdmin(user);

  if (!isAdmin && !official) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as StatusPayload;
  const status = String(payload.status ?? '').trim();

  if (!isValidReportStatus(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  if (!isAdmin && !OFFICIAL_ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'Etapa no permitida para funcionario.' },
      { status: 403 },
    );
  }

  const { data: report, error: reportError } = await supabaseServer
    .from('reports')
    .select('id, category')
    .eq('id', reportId)
    .maybeSingle();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  }

  if (!isAdmin) {
    const categories = official?.categories ?? [];
    if (!categories.includes(report.category)) {
      return NextResponse.json(
        { error: 'No tienes permiso sobre esta categoria.' },
        { status: 403 },
      );
    }
  }

  const updates =
    status === 'Reparado'
      ? { status, repaired: true, repaired_at: new Date().toISOString() }
      : {
          status,
          repaired: false,
          repaired_at: null,
          repair_rating_avg: 0,
          repair_rating_count: 0,
        };

  const { data, error } = await supabaseServer
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
