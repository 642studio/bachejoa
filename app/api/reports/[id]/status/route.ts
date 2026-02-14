import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../lib/auth';
import {
  isValidReportStatus,
  REPORT_SELECT,
} from '../../../../../lib/reporting';
import { rateLimit } from '../../../../../lib/security';
import { supabaseServer } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type StatusPayload = {
  status?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:status', 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo el admin puede cambiar etapas.' },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as StatusPayload;
  const status = String(payload.status ?? '').trim();

  if (!isValidReportStatus(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
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
