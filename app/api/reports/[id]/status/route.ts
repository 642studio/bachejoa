import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../../../lib/api';
import { writeAuditLog } from '../../../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../../../lib/csrf';
import {
  REPORT_SELECT,
} from '../../../../../lib/reporting';
import { StatusSchema } from '../../../../../lib/schemas';
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

  const rate = await rateLimit(request, 'reports:status', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo el admin puede cambiar etapas.' },
      { status: 403 },
    );
  }

  const parsed = StatusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  const { status } = parsed.data;

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
    { type: 'user', id: user?.id },
    'report.status.update',
    'report',
    reportId,
    { status },
  );

  return NextResponse.json(data);
}
