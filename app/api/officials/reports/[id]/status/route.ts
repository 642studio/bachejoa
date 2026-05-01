import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../../lib/auth';
import { getOfficialSessionAccount } from '../../../../../../lib/officials';
import { safeErrorResponse, tooManyRequests } from '../../../../../../lib/api';
import { writeAuditLog } from '../../../../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../../../../lib/csrf';
import { REPORT_SELECT } from '../../../../../../lib/reporting';
import { StatusSchema } from '../../../../../../lib/schemas';
import { supabaseServer } from '../../../../../../lib/supabase/server';
import { rateLimit } from '../../../../../../lib/security';
import { resolveZoneByCoordinates } from '../../../../../../lib/zones';

export const runtime = 'nodejs';

const OFFICIAL_ALLOWED_STATUSES = new Set(['En revisión', 'Reparado', 'Archivado']);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'officials:reports:status', 30, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const [user, official] = await Promise.all([
    getSessionUser(request),
    getOfficialSessionAccount(request),
  ]);
  const isAdmin = isPlatformAdmin(user);

  if (!isAdmin && !official) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const parsed = StatusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  const { status } = parsed.data;

  if (!isAdmin && !OFFICIAL_ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'Etapa no permitida para funcionario.' },
      { status: 403 },
    );
  }

  const { data: report, error: reportError } = await supabaseServer
    .from('reports')
    .select('id, category, lat, lng')
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
    const officialZones = ((official?.zones as string[] | undefined) ?? []).filter(
      Boolean,
    );
    if (officialZones.length > 0) {
      const zone = resolveZoneByCoordinates(report.lat, report.lng);
      if (!officialZones.includes(zone.id)) {
        return NextResponse.json(
          { error: 'No tienes permiso en esta zona.' },
          { status: 403 },
        );
      }
    }
  }

  const updates =
    status === 'Reparado'
      ? { status, repaired: true, repaired_at: new Date().toISOString() }
      : {
          status,
          repaired: false,
          repaired_at: null,
        };

  const { data, error } = await supabaseServer
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    return safeErrorResponse(error, 'No se pudo cambiar el estatus.');
  }

  await writeAuditLog(
    request,
    isAdmin
      ? { type: 'user', id: user?.id }
      : { type: 'official', id: official?.id },
    'report.status.update',
    'report',
    reportId,
    { status },
  );

  return NextResponse.json(data);
}
