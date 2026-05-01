import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../../../lib/api';
import { writeAuditLog } from '../../../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../../../lib/csrf';
import { REPORT_SELECT } from '../../../../../lib/reporting';
import { ReportTypeSchema } from '../../../../../lib/schemas';
import { rateLimit } from '../../../../../lib/security';
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

  const rate = await rateLimit(request, 'reports:type', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo el admin puede cambiar el tipo de reporte.' },
      { status: 403 },
    );
  }

  const parsed = ReportTypeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Categoría o tipo inválido.' },
      { status: 400 },
    );
  }
  const { category, subcategory } = parsed.data;

  const { data, error } = await supabaseServer
    .from('reports')
    .update({
      category,
      subcategory,
      type: subcategory,
    })
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    return safeErrorResponse(error, 'No se pudo cambiar el tipo.');
  }

  await writeAuditLog(
    request,
    { type: 'user', id: user?.id },
    'report.type.update',
    'report',
    reportId,
    { category, subcategory },
  );

  return NextResponse.json(data);
}
