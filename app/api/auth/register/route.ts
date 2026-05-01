import { NextResponse } from 'next/server';
import { csrfErrorResponse, checkCSRF } from '../../../../lib/csrf';
import { safeErrorResponse, tooManyRequests } from '../../../../lib/api';
import { RegisterSchema } from '../../../../lib/schemas';
import { rateLimit } from '../../../../lib/security';
import { createSupabaseAuthClient } from '../../../../lib/supabase/auth';
import { supabaseServer } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'auth:register', 10, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const parsed = RegisterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de registro inválidos.' }, { status: 400 });
  }
  const { username, email, password } = parsed.data;

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

  const supabaseAuth = createSupabaseAuthClient();
  if (!supabaseAuth) {
    return safeErrorResponse(null, 'Auth no configurado.');
  }

  const requestOrigin = new URL(request.url).origin;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || requestOrigin;
  const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${siteUrl.replace(/\/$/, '')}/map`,
    },
  });

  if (signUpError || !signUpData.user) {
    return NextResponse.json(
      { error: 'No se pudo crear la cuenta.' },
      { status: signUpError?.status ?? 500 },
    );
  }

  const { data: created, error } = await supabaseServer
    .from('users')
    .insert({
      id: signUpData.user.id,
      username,
      email,
      role: 'citizen',
      password_hash: null,
      email_verified_at: signUpData.user.email_confirmed_at ?? null,
      auth_provider: 'supabase',
    })
    .select('id, username, email, role, avatar_key, created_at')
    .single();

  if (error || !created) {
    return safeErrorResponse(error, 'No se pudo crear el perfil.');
  }

  return NextResponse.json({
    user: null,
    needs_email_verification: true,
    email: created.email,
  });
}
