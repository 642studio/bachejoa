import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase/server';
import { getClientFingerprint, rateLimit } from '../../../../../lib/security';
import { safeErrorResponse, tooManyRequests } from '../../../../../lib/api';
import { checkCSRF, csrfErrorResponse } from '../../../../../lib/csrf';
import { RatingSchema } from '../../../../../lib/schemas';

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

  const rate = await rateLimit(request, 'reports:rating', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const parsed = RatingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }
  const { rating } = parsed.data;

  const { data: existing, error: fetchError } = await supabaseServer
    .from('reports')
    .select('id, repaired')
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

  const { data, error } = await supabaseServer
    .from('reports')
    .select('repair_rating_avg, repair_rating_count')
    .eq('id', reportId)
    .single();

  if (error) {
    return safeErrorResponse(error, 'No se pudo registrar la calificación.');
  }

  return NextResponse.json({
    repair_rating_avg: data?.repair_rating_avg ?? 0,
    repair_rating_count: data?.repair_rating_count ?? 0,
  });
}
