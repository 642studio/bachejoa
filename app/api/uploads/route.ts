import { NextResponse } from 'next/server';
import { supabaseBucket, supabaseServer } from '../../../lib/supabase/server';
import { rateLimit } from '../../../lib/security';

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: Request) {
  const rate = await rateLimit(request, 'uploads:create', 10, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
    size?: number;
  };

  const size = Number(payload.size ?? 0);
  const contentType = String(payload.contentType ?? '');
  const filename = sanitizeFilename(String(payload.filename ?? 'foto'));

  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Invalid size.' }, { status: 400 });
  }
  if (size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'Photo too large.' }, { status: 400 });
  }
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
  }

  const path = `reports/${crypto.randomUUID()}-${filename}`;

  const { data, error } = await supabaseServer.storage
    .from(supabaseBucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Upload error' }, { status: 500 });
  }

  const { data: publicUrl } = supabaseServer.storage
    .from(supabaseBucket)
    .getPublicUrl(path);

  return NextResponse.json({
    bucket: supabaseBucket,
    path,
    signedUrl: data.signedUrl,
    publicUrl: publicUrl?.publicUrl ?? null,
  });
}
