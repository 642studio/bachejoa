import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../../lib/api';
import { checkCSRF, csrfErrorResponse } from '../../../../lib/csrf';
import { claimAnonymousReportsForUser } from '../../../../lib/report-ownership';
import { rateLimit } from '../../../../lib/security';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

const AVATAR_OPTIONS = ['bart.svg', 'homer.svg', 'lisa.svg', 'marge.svg'] as const;

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ user: null, stats: null });
  }

  const claim = await claimAnonymousReportsForUser(request, user.id);
  if (claim.error) {
    console.error('[auth:me] anonymous report claim failed', claim.error);
  }

  const [{ count: totalCount }, { count: verifiedCount }] = await Promise.all([
    supabaseServer
      .from('reports')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id),
    supabaseServer
      .from('reports')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
      .eq('status', 'Verificado'),
  ]);

  return NextResponse.json({
    user,
    stats: {
      reports_total: totalCount ?? 0,
      reports_verified: verifiedCount ?? 0,
    },
  });
}

export async function PATCH(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'auth:profile:update', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    avatar_key?: string;
  };
  const avatarKey = String(payload.avatar_key ?? '').trim();

  if (!AVATAR_OPTIONS.includes(avatarKey as (typeof AVATAR_OPTIONS)[number])) {
    return NextResponse.json({ error: 'Avatar inválido.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('users')
    .update({ avatar_key: avatarKey })
    .eq('id', user.id)
    .select('id, username, email, role, avatar_key, created_at')
    .single();

  if (error || !data) {
    return safeErrorResponse(error, 'No se pudo actualizar el perfil.');
  }

  return NextResponse.json({ user: data });
}
