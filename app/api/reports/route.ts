import { NextResponse } from 'next/server';
import { supabaseBucket, supabaseServer } from '../../../lib/supabase/server';
import { getClientFingerprint, rateLimit } from '../../../lib/security';

export const runtime = 'nodejs';

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function GET() {
  const { data, error } = await supabaseServer
    .from('reports')
    .select(
      'id, lat, lng, type, photo_url, created_at, angry_count, repaired, repaired_at, repair_rating_avg, repair_rating_count',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const rate = await rateLimit(request, 'reports:create', 12, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const lat = Number(formData.get('lat'));
    const lng = Number(formData.get('lng'));
    const type = String(formData.get('type') ?? '');
    const photo = formData.get('photo') as File | null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !type) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    let photoUrl: string | null = null;

    if (photo && photo.size > 0) {
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json(
          { error: 'Photo too large.' },
          { status: 400 },
        );
      }
      if (!photo.type || !photo.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Invalid photo type.' },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await photo.arrayBuffer());
      const filename = sanitizeFilename(photo.name || 'foto');
      const path = `reports/${crypto.randomUUID()}-${filename}`;

      const { error: uploadError } = await supabaseServer.storage
        .from(supabaseBucket)
        .upload(path, buffer, {
          contentType: photo.type || 'image/png',
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 },
        );
      }

      const { data: publicUrl } = supabaseServer.storage
        .from(supabaseBucket)
        .getPublicUrl(path);

      photoUrl = publicUrl?.publicUrl ?? null;
    }

    const { data, error } = await supabaseServer
      .from('reports')
      .insert({ lat, lng, type, photo_url: photoUrl, angry_count: 0 })
      .select(
        'id, lat, lng, type, photo_url, created_at, angry_count, repaired, repaired_at, repair_rating_avg, repair_rating_count',
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
