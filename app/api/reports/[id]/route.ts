import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../../lib/api';
import { writeAuditLog } from '../../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../../lib/csrf';
import { supabaseServer } from '../../../../lib/supabase/server';
import { rateLimit } from '../../../../lib/security';
import { removeReportPhoto } from '../../../../lib/storage';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:delete', 6, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo el admin puede eliminar reportes.' },
      { status: 403 },
    );
  }

  const { data: report, error: reportError } = await supabaseServer
    .from('reports')
    .select('id, photo_url')
    .eq('id', reportId)
    .maybeSingle();
  if (reportError) {
    return safeErrorResponse(reportError, 'No se pudo cargar el reporte.');
  }
  if (!report) {
    return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  }

  const { error } = await supabaseServer
    .from('reports')
    .delete()
    .eq('id', reportId);

  if (error) {
    return safeErrorResponse(error, 'No se pudo eliminar el reporte.');
  }

  await removeReportPhoto(report.photo_url);
  await writeAuditLog(
    request,
    { type: 'user', id: user?.id },
    'report.delete',
    'report',
    reportId,
  );

  return NextResponse.json({ ok: true });
}
