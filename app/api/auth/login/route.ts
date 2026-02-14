import { NextResponse } from 'next/server';
import {
  createSession,
  getSessionCookieName,
  verifyPassword,
} from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/security';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type LoginPayload = {
  identifier?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const rate = await rateLimit(request, 'auth:login', 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const identifier = String(payload.identifier ?? payload.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(payload.password ?? '').trim();

  if (!identifier || !password) {
    return NextResponse.json(
      { error: 'Correo/usuario y contraseña son obligatorios.' },
      { status: 400 },
    );
  }

  const selectColumns =
    'id, username, email, role, avatar_key, created_at, password_hash';
  const byEmail = await supabaseServer
    .from('users')
    .select(selectColumns)
    .eq('email', identifier)
    .maybeSingle();
  let user = byEmail.data;
  let error = byEmail.error;

  if (!user) {
    const byUsername = await supabaseServer
      .from('users')
      .select(selectColumns)
      .ilike('username', identifier)
      .maybeSingle();
    user = byUsername.data;
    error = byUsername.error;
  }

  if (error || !user) {
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const session = await createSession(user.id);
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
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAge,
  });

  return response;
}
