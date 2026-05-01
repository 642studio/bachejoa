import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../lib/api';
import { claimAnonymousReportsForUser } from '../../../lib/report-ownership';
import { rateLimit } from '../../../lib/security';
import { supabaseServer } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const rate = await rateLimit(request, 'account:read', 30, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const claim = await claimAnonymousReportsForUser(request, user.id);
  if (claim.error) {
    console.error('[account] anonymous report claim failed', claim.error);
  }

  const { data: reports, error } = await supabaseServer
    .from('reports')
    .select(
      'id, created_at, lat, lng, category, subcategory, status, photo_url, angry_count, repaired, repaired_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return safeErrorResponse(error, 'No se pudo cargar la cuenta.');
  }

  return NextResponse.json({
    user,
    reports: reports ?? [],
  });
}
