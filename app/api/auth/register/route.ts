import { NextResponse } from 'next/server';
import {
  createSession,
  getSessionCookieName,
  hashPassword,
} from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/security';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type RegisterPayload = {
  username?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const rate = await rateLimit(request, 'auth:register', 10, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as RegisterPayload;
  const username = String(payload.username ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '').trim();

  if (!username || username.length < 3 || username.length > 30) {
    return NextResponse.json({ error: 'Username inválido.' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres.' },
      { status: 400 },
    );
  }

  const { data: existingEmail } = await supabaseServer
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  const { data: existingUsername } = await supabaseServer
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingEmail || existingUsername) {
    return NextResponse.json(
      { error: 'Ese usuario o correo ya existe.' },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const { data: created, error } = await supabaseServer
    .from('users')
    .insert({ username, email, role: 'citizen', password_hash: passwordHash })
    .select('id, username, email, role, avatar_key, created_at')
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo crear la cuenta.' },
      { status: 500 },
    );
  }

  const session = await createSession(created.id);
  const response = NextResponse.json({ user: created });
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAge,
  });

  return response;
}
