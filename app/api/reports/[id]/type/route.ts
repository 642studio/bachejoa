import { NextResponse } from 'next/server';
import { getSessionUser, isPlatformAdmin } from '../../../../../lib/auth';
import {
  isValidReportCategory,
  isValidSubcategory,
  REPORT_SELECT,
} from '../../../../../lib/reporting';
import { rateLimit } from '../../../../../lib/security';
import { supabaseServer } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type TypePayload = {
  category?: string;
  subcategory?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const rate = await rateLimit(request, 'reports:type', 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const user = await getSessionUser(request);
  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo el admin puede cambiar el tipo de reporte.' },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as TypePayload;
  const category = String(payload.category ?? '').trim();
  const subcategory = String(payload.subcategory ?? '').trim();

  if (!isValidReportCategory(category) || !isValidSubcategory(category, subcategory)) {
    return NextResponse.json(
      { error: 'Categoría o tipo inválido.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer
    .from('reports')
    .update({
      category,
      subcategory,
      type: subcategory,
    })
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
