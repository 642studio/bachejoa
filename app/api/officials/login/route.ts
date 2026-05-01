import { NextResponse } from 'next/server';
import {
  createOfficialSession,
  getLegacyOfficialSessionCookieName,
  getOfficialSessionCookieOptions,
  getOfficialSessionCookieName,
} from '../../../../lib/officials';
import { burnPasswordTiming, verifyPassword } from '../../../../lib/auth';
import { checkCSRF, csrfErrorResponse } from '../../../../lib/csrf';
import { safeErrorResponse, tooManyRequests } from '../../../../lib/api';
import { supabaseServer } from '../../../../lib/supabase/server';
import { rateLimit } from '../../../../lib/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'officials:login', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = String(payload.username ?? '').trim();
  const password = String(payload.password ?? '');

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Usuario y contrasena requeridos.' },
      { status: 400 },
    );
  }

  const { data: official, error } = await supabaseServer
    .from('official_accounts')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error || !official || !official.active) {
    await burnPasswordTiming(password);
    return NextResponse.json({ error: 'Credenciales invalidas.' }, { status: 401 });
  }

  const ok = await verifyPassword(password, official.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Credenciales invalidas.' }, { status: 401 });
  }

  const session = await createOfficialSession(official.id, request);
  const { error: lastLoginError } = await supabaseServer
    .from('official_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', official.id);
  if (lastLoginError) {
    return safeErrorResponse(lastLoginError, 'No se pudo iniciar sesión.');
  }

  const response = NextResponse.json({
    official: {
      id: official.id,
      username: official.username,
      full_name: official.full_name,
      email: official.email,
      area: official.area,
      categories: official.categories ?? [],
      zones: official.zones ?? [],
      active: official.active,
      created_at: official.created_at,
    },
  });

  response.cookies.set(
    getOfficialSessionCookieName(),
    session.token,
    getOfficialSessionCookieOptions(session.maxAge),
  );
  response.cookies.set(getLegacyOfficialSessionCookieName(), '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
