import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import convert from 'heic-convert';

function loadEnvLocal(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function isHeicUrl(url) {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.heic') || clean.endsWith('.heif');
}

function extractStoragePath(publicUrl, bucket) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

async function main() {
  loadEnvLocal('.env.local');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'bachejoa-reports';

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, photo_url')
    .not('photo_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const targets = (reports || []).filter((r) => isHeicUrl(r.photo_url));
  console.log(`Encontrados ${targets.length} reportes con HEIC/HEIF`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const report of targets) {
    const photoUrl = report.photo_url;
    if (!photoUrl) {
      skipped += 1;
      continue;
    }

    try {
      const storagePath = extractStoragePath(photoUrl, bucket);
      if (!storagePath) {
        console.log(`SKIP ${report.id} (url fuera de bucket)`);
        skipped += 1;
        continue;
      }

      const response = await fetch(photoUrl);
      if (!response.ok) {
        console.log(`FAIL ${report.id} (descarga ${response.status})`);
        failed += 1;
        continue;
      }

      const inputBuffer = Buffer.from(await response.arrayBuffer());
      const outputBuffer = await convert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 0.88,
      });

      const jpgPath = storagePath.replace(/\.(heic|heif)$/i, '.jpg');
      const uniquePath = jpgPath === storagePath ? `${storagePath}.jpg` : jpgPath;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(uniquePath, outputBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.log(`FAIL ${report.id} (upload: ${uploadError.message})`);
        failed += 1;
        continue;
      }

      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uniquePath);
      const nextUrl = publicData?.publicUrl;

      if (!nextUrl) {
        console.log(`FAIL ${report.id} (sin public url)`);
        failed += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('reports')
        .update({ photo_url: nextUrl })
        .eq('id', report.id);

      if (updateError) {
        console.log(`FAIL ${report.id} (update: ${updateError.message})`);
        failed += 1;
        continue;
      }

      console.log(`OK   ${report.id}`);
      converted += 1;
    } catch (err) {
      console.log(`FAIL ${report.id} (${err instanceof Error ? err.message : 'error'})`);
      failed += 1;
    }
  }

  console.log('--- RESUMEN ---');
  console.log(`Convertidos: ${converted}`);
  console.log(`Saltados:    ${skipped}`);
  console.log(`Fallidos:    ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
