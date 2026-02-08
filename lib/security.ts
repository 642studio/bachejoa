import { createHash } from 'crypto';
import { supabaseServer } from './supabase/server';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export function getClientFingerprint(request: Request) {
  const ip = getClientIp(request);
  const ua = request.headers.get('user-agent') || 'unknown';
  const fingerprint = createHash('sha256')
    .update(`${ip}|${ua}`)
    .digest('hex');
  return { ip, ua, fingerprint };
}

export async function rateLimit(
  request: Request,
  routeKey: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { fingerprint } = getClientFingerprint(request);
  const now = Date.now();
  const windowStartMs =
    Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const key = createHash('sha256')
    .update(`${fingerprint}|${routeKey}|${windowStart}`)
    .digest('hex');

  const { data: existing, error } = await supabaseServer
    .from('rate_limits')
    .select('count')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    return { allowed: true };
  }

  if (!existing) {
    await supabaseServer.from('rate_limits').insert({
      key,
      fingerprint,
      route: routeKey,
      window_start: windowStart,
      count: 1,
    });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartMs + windowSeconds * 1000 - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  await supabaseServer
    .from('rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', key);

  return { allowed: true };
}
