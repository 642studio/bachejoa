import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../../../lib/api';
import { writeAuditLog } from '../../../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../../../lib/csrf';
import { REPORT_SELECT } from '../../../../../lib/reporting';
import { rateLimit } from '../../../../../lib/security';
import {
  removeReportPhoto,
  uploadProcessedReportPhoto,
} from '../../../../../lib/storage';
import { supabaseServer } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:photo', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Necesitas una cuenta para agregar foto.' },
      { status: 401 },
    );
  }

  const { data: report, error: reportError } = await supabaseServer
    .from('reports')
    .select('id, user_id, photo_url')
    .eq('id', reportId)
    .maybeSingle();

  if (reportError) {
    return safeErrorResponse(reportError, 'No se pudo cargar el reporte.');
  }
  if (!report) {
    return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  }

  const isOwner = report.user_id === user.id;
  const isAdmin = isPlatformAdmin(user);
  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: 'No puedes modificar este reporte.' },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const photo = formData?.get('photo');
  if (!(photo instanceof File) || photo.size <= 0) {
    return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 });
  }

  const upload = await uploadProcessedReportPhoto(photo);
  if (upload.error || !upload.publicUrl) {
    return NextResponse.json(
      { error: upload.error ?? 'No se pudo procesar la foto.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer
    .from('reports')
    .update({ photo_url: upload.publicUrl })
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    await removeReportPhoto(upload.publicUrl);
    return safeErrorResponse(error, 'No se pudo guardar la foto.');
  }

  await removeReportPhoto(report.photo_url);
  await writeAuditLog(
    request,
    { type: 'user', id: user.id },
    'report.photo.replace',
    'report',
    reportId,
    { had_previous_photo: Boolean(report.photo_url) },
  );

  return NextResponse.json(data);
}
