import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth';
import { rateLimit } from '../../../lib/security';
import { supabaseServer } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const rate = await rateLimit(request, 'account:read', 30, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { data: reports, error } = await supabaseServer
    .from('reports')
    .select(
      'id, created_at, lat, lng, category, subcategory, status, photo_url, angry_count, repaired, repaired_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user,
    reports: reports ?? [],
  });
}
