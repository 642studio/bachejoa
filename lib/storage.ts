import sharp from 'sharp';
import { supabaseBucket, supabaseServer } from './supabase/server';

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'foto';
}

export function validatePhotoFile(file: File) {
  if (file.size <= 0) return 'Foto inválida.';
  if (file.size > MAX_PHOTO_BYTES) return 'Foto demasiado grande.';
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Tipo de foto no permitido.';
  return null;
}

export function isAllowedStoragePublicUrl(photoUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(photoUrl);
  } catch {
    return false;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  let allowedHost = '';
  try {
    allowedHost = new URL(supabaseUrl).host;
  } catch {
    return false;
  }

  return (
    parsed.protocol === 'https:' &&
    parsed.host === allowedHost &&
    parsed.pathname.startsWith(`/storage/v1/object/public/${supabaseBucket}/reports/`)
  );
}

export function storagePathFromPublicUrl(photoUrl: string) {
  if (!isAllowedStoragePublicUrl(photoUrl)) return null;
  const parsed = new URL(photoUrl);
  const prefix = `/storage/v1/object/public/${supabaseBucket}/`;
  const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
  return path || null;
}

export async function removeReportPhoto(photoUrl: string | null | undefined) {
  if (!photoUrl) return;
  const path = storagePathFromPublicUrl(photoUrl);
  if (!path) return;
  await supabaseServer.storage.from(supabaseBucket).remove([path]);
}

export async function uploadProcessedReportPhoto(file: File) {
  const validationError = validatePhotoFile(file);
  if (validationError) {
    return { error: validationError };
  }

  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input, { failOn: 'warning' })
    .rotate()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const safeName = sanitizeFilename(file.name || 'foto');
  const path = `reports/${crypto.randomUUID()}-${safeName.replace(/\.[^.]+$/, '')}.jpg`;
  const { error } = await supabaseServer.storage
    .from(supabaseBucket)
    .upload(path, output, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    return { error: 'No se pudo subir la foto.' };
  }

  const { data } = supabaseServer.storage.from(supabaseBucket).getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? null;
  if (!publicUrl || !isAllowedStoragePublicUrl(publicUrl)) {
    await supabaseServer.storage.from(supabaseBucket).remove([path]);
    return { error: 'No se pudo publicar la foto.' };
  }

  return { publicUrl, path };
}
