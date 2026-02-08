import { NextResponse } from 'next/server';
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

  const payload = (await request.json().catch(() => ({}))) as {
    repaired?: boolean;
  };
  const nextRepaired = payload.repaired !== false;

  const updates = nextRepaired
    ? { repaired: true, repaired_at: new Date().toISOString() }
    : {
        repaired: false,
        repaired_at: null,
        repair_rating_avg: 0,
        repair_rating_count: 0,
      };

  const { data, error } = await supabaseServer
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .select(
      'id, lat, lng, type, photo_url, created_at, angry_count, repaired, repaired_at, repair_rating_avg, repair_rating_count',
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
