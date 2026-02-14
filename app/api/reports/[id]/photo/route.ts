import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../../lib/auth';
import { REPORT_SELECT } from '../../../../../lib/reporting';
import { rateLimit } from '../../../../../lib/security';
import { supabaseServer } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type PhotoPayload = {
  photo_url?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:photo', 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Necesitas una cuenta para agregar foto.' },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as PhotoPayload;
  const photoUrl = String(payload.photo_url ?? '').trim();

  if (!photoUrl || !/^https?:\/\//i.test(photoUrl)) {
    return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('reports')
    .update({ photo_url: photoUrl })
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
