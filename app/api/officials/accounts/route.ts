import { NextResponse } from 'next/server';
import { getSessionUser, hashPassword, isPlatformAdmin } from '../../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../../lib/api';
import { writeAuditLog } from '../../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../../lib/csrf';
import { OfficialAccountSchema } from '../../../../lib/schemas';
import { supabaseServer } from '../../../../lib/supabase/server';
import { rateLimit } from '../../../../lib/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'officials:accounts:create', 15, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const parsed = OfficialAccountSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const {
    username,
    password,
    full_name: fullName,
    area,
    categories,
    zones,
  } = parsed.data;
  const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;

  const { data: existingUser } = await supabaseServer
    .from('official_accounts')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingUser) {
    return NextResponse.json({ error: 'Ese usuario ya existe.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  let result = await supabaseServer
    .from('official_accounts')
    .insert({
      username,
      password_hash: passwordHash,
      full_name: fullName,
      email,
      area: area || null,
      categories,
      zones,
      active: true,
    })
    .select('*')
    .single();

  if (result.error?.code === '42703') {
    result = await supabaseServer
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
      .select('*')
      .single();
  }

  const { data, error } = result;

  if (error || !data) {
    return safeErrorResponse(error, 'No se pudo crear la credencial.');
  }

  await writeAuditLog(
    request,
    { type: 'user', id: user?.id },
    'official_account.create',
    'official_account',
    data.id,
    {
      username: data.username,
      categories: data.categories ?? [],
      zones: data.zones ?? [],
    },
  );

  return NextResponse.json({ official: data });
}
