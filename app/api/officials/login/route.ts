import { NextResponse } from 'next/server';
import {
  createOfficialSession,
  getOfficialSessionCookieName,
} from '../../../../lib/officials';
import { verifyPassword } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase/server';
import { rateLimit } from '../../../../lib/security';

export const runtime = 'nodejs';

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const rate = await rateLimit(request, 'officials:login', 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
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
    .select(
      'id, username, full_name, email, area, categories, active, password_hash, created_at, last_login_at',
    )
    .eq('username', username)
    .maybeSingle();

  if (error || !official || !official.active) {
    return NextResponse.json({ error: 'Credenciales invalidas.' }, { status: 401 });
  }

  const ok = await verifyPassword(password, official.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Credenciales invalidas.' }, { status: 401 });
  }

  const session = await createOfficialSession(official.id);
  await supabaseServer
    .from('official_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', official.id);

  const response = NextResponse.json({
    official: {
      id: official.id,
      username: official.username,
      full_name: official.full_name,
      email: official.email,
      area: official.area,
      categories: official.categories ?? [],
      active: official.active,
      created_at: official.created_at,
    },
  });

  response.cookies.set(getOfficialSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAge,
  });

  return response;
}
