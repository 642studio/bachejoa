import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth';
import { tooManyRequests } from '../../../lib/api';
import { checkCSRF, csrfErrorResponse } from '../../../lib/csrf';
import { rateLimit } from '../../../lib/security';
import { uploadProcessedReportPhoto } from '../../../lib/storage';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const rate = await rateLimit(request, 'uploads:create', 10, 60);
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds);
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const photo = formData?.get('photo');
  if (!(photo instanceof File) || photo.size <= 0) {
    return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 });
  }

  const upload = await uploadProcessedReportPhoto(photo);
  if (upload.error || !upload.publicUrl) {
    return NextResponse.json(
      { error: upload.error ?? 'No se pudo procesar la foto.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    path: upload.path,
    publicUrl: upload.publicUrl,
  });
}
