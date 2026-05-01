import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth';
import { safeErrorResponse, tooManyRequests } from '../../../lib/api';
import { writeAuditLog } from '../../../lib/audit';
import { checkCSRF, csrfErrorResponse } from '../../../lib/csrf';
import {
  normalizeReportInput,
  REPORT_SELECT,
} from '../../../lib/reporting';
import { CursorSchema, ReportCreateSchema } from '../../../lib/schemas';
import { getClientFingerprint, rateLimit } from '../../../lib/security';
import { uploadProcessedReportPhoto } from '../../../lib/storage';
import { supabaseServer } from '../../../lib/supabase/server';
import { resolveZoneByCoordinates } from '../../../lib/zones';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedCursor = CursorSchema.safeParse({
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
    cursor_id: searchParams.get('cursor_id') ?? undefined,
  });
  if (!parsedCursor.success) {
    return NextResponse.json({ error: 'Cursor inválido.' }, { status: 400 });
  }
  const { limit, cursor, cursor_id: cursorId } = parsedCursor.data;
  if ((cursor && !cursorId) || (!cursor && cursorId)) {
    return NextResponse.json({ error: 'Cursor inválido.' }, { status: 400 });
  }

  let query = supabaseServer
    .from('reports')
    .select(REPORT_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (cursor && cursorId) {
    query = query.or(
      `created_at.lt.${cursor},and(created_at.eq.${cursor},id.lt.${cursorId})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return safeErrorResponse(error, 'No se pudieron cargar los reportes.');
  }

  const nextCursor =
    data && data.length === limit ? data[data.length - 1] : null;

  return NextResponse.json({
    data: data ?? [],
    nextCursor: nextCursor
      ? { cursor: nextCursor.created_at, cursor_id: nextCursor.id }
      : null,
  });
}

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  try {
    const rate = await rateLimit(request, 'reports:create', 12, 60);
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds);
    }

    const formData = await request.formData();
    const parsed = ReportCreateSchema.safeParse({
      lat: formData.get('lat'),
      lng: formData.get('lng'),
      type: formData.get('type') ?? '',
      category: formData.get('category') ?? '',
      subcategory: formData.get('subcategory') ?? '',
      status: formData.get('status') ?? 'Visible',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Reporte inválido.' }, { status: 400 });
    }
    const { lat, lng, type, category, subcategory, status } = parsed.data;
    const normalized = normalizeReportInput({
      category,
      subcategory,
      type,
      status,
    });
    if (!normalized) {
      return NextResponse.json(
        { error: 'Categoría o subtipo inválido.' },
        { status: 400 },
      );
    }
    const zone = resolveZoneByCoordinates(lat, lng);
    if (zone.id === 'fuera') {
      return NextResponse.json(
        { error: 'El reporte está fuera de la zona de cobertura.' },
        { status: 400 },
      );
    }

    const { fingerprint } = getClientFingerprint(request);
    const user = await getSessionUser(request);
    if (!user) {
      const { count, error: countError } = await supabaseServer
        .from('reports')
        .select('id', { head: true, count: 'exact' })
        .eq('reporter_fingerprint', fingerprint);

      if (countError) {
        return safeErrorResponse(countError, 'No se pudo validar el límite.');
      }
      if ((count ?? 0) >= 5) {
        return NextResponse.json(
          {
            error: 'Para seguir participando, crea una cuenta',
            code: 'ANON_LIMIT_REACHED',
          },
          { status: 403 },
        );
      }
    }

    let photoUrl: string | null = null;
    const photo = formData.get('photo');
    if (photo instanceof File && photo.size > 0) {
      const upload = await uploadProcessedReportPhoto(photo);
      if (upload.error || !upload.publicUrl) {
        return NextResponse.json(
          { error: upload.error ?? 'No se pudo procesar la foto.' },
          { status: 400 },
        );
      }
      photoUrl = upload.publicUrl;
    }

    const { data, error } = await supabaseServer
      .from('reports')
      .insert({
        lat,
        lng,
        type: normalized.type,
        category: normalized.category,
        subcategory: normalized.subcategory,
        status: normalized.status,
        photo_url: photoUrl,
        angry_count: 0,
        repaired: normalized.status === 'Reparado',
        repaired_at:
          normalized.status === 'Reparado' ? new Date().toISOString() : null,
        user_id: user?.id ?? null,
        reporter_fingerprint: user ? null : fingerprint,
      })
      .select(REPORT_SELECT)
      .single();

    if (error) {
      return safeErrorResponse(error, 'No se pudo crear el reporte.');
    }

    await writeAuditLog(
      request,
      user ? { type: 'user', id: user.id } : { type: 'system' },
      'report.create',
      'report',
      data.id,
      { category: data.category, subcategory: data.subcategory, zone: zone.id },
    );

    return NextResponse.json(data);
  } catch (error) {
    return safeErrorResponse(error, 'No se pudo crear el reporte.');
  }
}
