import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase/server';
import { getClientFingerprint, rateLimit } from '../../../../../lib/security';

export const runtime = 'nodejs';

type RatingPayload = {
  rating?: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:rating', 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as RatingPayload;
  const rating = Number(payload.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseServer
    .from('reports')
    .select('repair_rating_avg, repair_rating_count, repaired')
    .eq('id', reportId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (!existing.repaired) {
    return NextResponse.json(
      { error: 'Report not repaired.' },
      { status: 400 },
    );
  }

  const { fingerprint } = getClientFingerprint(request);
  const { data: existingVote } = await supabaseServer
    .from('report_repair_ratings')
    .select('id')
    .eq('report_id', reportId)
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  if (existingVote) {
    return NextResponse.json({ error: 'Already rated.' }, { status: 409 });
  }

  const { error: voteError } = await supabaseServer
    .from('report_repair_ratings')
    .insert({ report_id: reportId, fingerprint, rating });

  if (voteError) {
    return NextResponse.json({ error: 'Already rated.' }, { status: 409 });
  }

  const currentAvg = Number(existing.repair_rating_avg ?? 0);
  const currentCount = Number(existing.repair_rating_count ?? 0);
  const nextCount = currentCount + 1;
  const nextAvg = (currentAvg * currentCount + rating) / nextCount;

  const { data, error } = await supabaseServer
    .from('reports')
    .update({ repair_rating_avg: nextAvg, repair_rating_count: nextCount })
    .eq('id', reportId)
    .select('repair_rating_avg, repair_rating_count')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    repair_rating_avg: data?.repair_rating_avg ?? nextAvg,
    repair_rating_count: data?.repair_rating_count ?? nextCount,
  });
}
