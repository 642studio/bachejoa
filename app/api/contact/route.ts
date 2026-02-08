import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase/server';
import { rateLimit } from '../../../lib/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rate = await rateLimit(request, 'contact:create', 6, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    name?: string;
    contact?: string;
    topic?: string;
    message?: string;
  };

  const name = String(payload.name ?? '').trim();
  const contact = String(payload.contact ?? '').trim();
  const topic = String(payload.topic ?? '').trim();
  const message = String(payload.message ?? '').trim();

  if (!name || !contact || !message) {
    return NextResponse.json(
      { error: 'Missing required fields.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer
    .from('contact_requests')
    .insert({ name, contact, topic, message })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}
