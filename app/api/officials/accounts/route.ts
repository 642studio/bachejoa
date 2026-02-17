import { NextResponse } from 'next/server';
import { getSessionUser, hashPassword, isPlatformAdmin } from '../../../../lib/auth';
import { REPORT_CATEGORIES } from '../../../../lib/reporting';
import { supabaseServer } from '../../../../lib/supabase/server';
import { rateLimit } from '../../../../lib/security';

export const runtime = 'nodejs';

type CreateOfficialPayload = {
  username?: string;
  password?: string;
  full_name?: string;
  email?: string;
  area?: string;
  categories?: string[];
};

const VALID_CATEGORIES = new Set<string>(
  REPORT_CATEGORIES.map((item) => item.name),
);

export async function POST(request: Request) {
  const rate = await rateLimit(request, 'officials:accounts:create', 15, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as CreateOfficialPayload;
  const username = String(payload.username ?? '').trim();
  const password = String(payload.password ?? '');
  const fullName = String(payload.full_name ?? '').trim();
  const emailRaw = String(payload.email ?? '').trim();
  const area = String(payload.area ?? '').trim();
  const categories = Array.isArray(payload.categories)
    ? payload.categories
        .map((value) => String(value).trim())
        .filter((value) => VALID_CATEGORIES.has(value))
    : [];

  if (!username || username.length < 3 || username.length > 30) {
    return NextResponse.json({ error: 'Username invalido.' }, { status: 400 });
  }
  if (!fullName || fullName.length < 3) {
    return NextResponse.json({ error: 'Nombre completo invalido.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Contrasena minima de 8 caracteres.' },
      { status: 400 },
    );
  }
  if (categories.length === 0) {
    return NextResponse.json(
      { error: 'Selecciona al menos una categoria.' },
      { status: 400 },
    );
  }

  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && !email.includes('@')) {
    return NextResponse.json({ error: 'Correo invalido.' }, { status: 400 });
  }

  const { data: existingUser } = await supabaseServer
    .from('official_accounts')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingUser) {
    return NextResponse.json({ error: 'Ese usuario ya existe.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const { data, error } = await supabaseServer
    .from('official_accounts')
    .insert({
      username,
      password_hash: passwordHash,
      full_name: fullName,
      email,
      area: area || null,
      categories,
      active: true,
    })
    .select(
      'id, username, full_name, email, area, categories, active, created_at, last_login_at',
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo crear la credencial.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ official: data });
}
