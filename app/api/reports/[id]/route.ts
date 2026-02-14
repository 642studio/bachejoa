import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase/server';
import { rateLimit } from '../../../../lib/security';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:delete', 6, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo el admin puede eliminar reportes.' },
      { status: 403 },
    );
  }

  const { error } = await supabaseServer
    .from('reports')
    .delete()
    .eq('id', reportId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
