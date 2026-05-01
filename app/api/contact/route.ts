import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase/server';
import { rateLimit } from '../../../lib/security';
import { safeErrorResponse, tooManyRequests } from '../../../lib/api';
import { checkCSRF, csrfErrorResponse } from '../../../lib/csrf';
import { ContactSchema } from '../../../lib/schemas';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'contact:create', 6, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const parsed = ContactSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.' },
      { status: 400 },
    );
  }
  const { name, contact, topic, message } = parsed.data;

  const { data, error } = await supabaseServer
    .from('contact_requests')
    .insert({ name, contact, topic, message })
    .select('id')
    .single();

  if (error) {
    return safeErrorResponse(error, 'No se pudo guardar el contacto.');
  }

  return NextResponse.json({ id: data?.id });
}
