import { NextResponse } from 'next/server';
import {
  burnPasswordTiming,
  createSession,
  getLegacySessionCookieName,
  getSessionCookieOptions,
  getSessionCookieName,
  verifyPassword,
} from '../../../../lib/auth';
import { csrfErrorResponse, checkCSRF } from '../../../../lib/csrf';
import { safeErrorResponse, tooManyRequests } from '../../../../lib/api';
import { LoginSchema } from '../../../../lib/schemas';
import { rateLimit } from '../../../../lib/security';
import { createSupabaseServerAuthClient } from '../../../../lib/supabase/auth';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'auth:login', 20, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }
  const rawIdentifier = String(parsed.data.identifier ?? parsed.data.email ?? '').trim();
  const password = parsed.data.password;

  const selectColumns =
    'id, username, email, role, avatar_key, created_at, password_hash';
  const isEmail = rawIdentifier.includes('@');
  const identifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier;
  const lookup = await supabaseServer
    .from('users')
    .select(selectColumns)
    .eq(isEmail ? 'email' : 'username', identifier)
    .maybeSingle();

  if (lookup.error) {
    await burnPasswordTiming(password);
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const user = lookup.data;

  if (user?.password_hash) {
    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const session = await createSession(user.id, request);
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar_key: user.avatar_key,
        created_at: user.created_at,
      },
    });
    response.cookies.set(
      getSessionCookieName(),
      session.token,
      getSessionCookieOptions(session.maxAge),
    );
    response.cookies.set(getLegacySessionCookieName(), '', {
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  const email = user?.email ?? (isEmail ? identifier : null);
  if (!email) {
    await burnPasswordTiming(password);
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const supabaseAuth = createSupabaseServerAuthClient(request, (cookie) => {
    cookiesToSet.push(cookie);
  });

  if (!supabaseAuth) {
    return safeErrorResponse(null, 'Auth no configurado.');
  }

  const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    await burnPasswordTiming(password);
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from('users')
    .select('id, username, email, role, avatar_key, created_at')
    .eq('email', email)
    .maybeSingle();

  if (profileError || !profile) {
    return safeErrorResponse(profileError, 'No se pudo cargar la cuenta.');
  }

  const response = NextResponse.json({ user: profile });
  cookiesToSet.forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie.options as any);
  });
  return response;
}
