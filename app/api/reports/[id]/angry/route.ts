import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase/server';
import { getClientFingerprint, rateLimit } from '../../../../../lib/security';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const request = _request;
  const reportId = params.id;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:angry', 30, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
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
    .select('angry_count')
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

  const nextCount = (existing.angry_count ?? 0) + 1;

  const { data, error } = await supabaseServer
    .from('reports')
    .update({ angry_count: nextCount })
    .eq('id', reportId)
    .select('angry_count')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ angry_count: data?.angry_count ?? nextCount });
}
