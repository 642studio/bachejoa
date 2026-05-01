import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase/server';
import { getClientFingerprint, rateLimit } from '../../../../../lib/security';
import { tooManyRequests, safeErrorResponse } from '../../../../../lib/api';
import { checkCSRF, csrfErrorResponse } from '../../../../../lib/csrf';

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

  const rate = await rateLimit(request, 'reports:angry', 30, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const { fingerprint } = getClientFingerprint(request);
  const { data: existingVote } = await supabaseServer
    .from('report_angry_votes')
    .select('id')
    .eq('report_id', reportId)
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  if (existingVote) {
    return NextResponse.json({ error: 'Already voted.' }, { status: 409 });
  }

  const { data: existing, error: fetchError } = await supabaseServer
    .from('reports')
    .select('id')
    .eq('id', reportId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const { error: voteError } = await supabaseServer
    .from('report_angry_votes')
    .insert({ report_id: reportId, fingerprint });

  if (voteError) {
    return NextResponse.json({ error: 'Already voted.' }, { status: 409 });
  }

  const { data, error } = await supabaseServer
    .from('reports')
    .select('angry_count')
    .eq('id', reportId)
    .single();

  if (error) {
    return safeErrorResponse(error, 'No se pudo registrar el voto.');
  }

  return NextResponse.json({ angry_count: data?.angry_count ?? 0 });
}
