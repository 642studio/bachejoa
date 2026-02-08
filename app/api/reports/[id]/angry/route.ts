import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const reportId = params.id;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseServer
    .from('reports')
    .select('angry_count')
    .eq('id', reportId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
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
