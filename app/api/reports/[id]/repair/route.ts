import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../lib/auth';
import { REPORT_SELECT } from '../../../../../lib/reporting';
import { supabaseServer } from '../../../../../lib/supabase/server';
import { rateLimit } from '../../../../../lib/security';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:repair', 8, 60);
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

  const payload = (await request.json().catch(() => ({}))) as {
    repaired?: boolean;
  };
  const nextRepaired = payload.repaired !== false;

  const updates = nextRepaired
    ? {
        status: 'Reparado',
        repaired: true,
        repaired_at: new Date().toISOString(),
      }
    : {
        status: 'Visible',
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
