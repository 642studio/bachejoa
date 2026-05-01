import { createHash } from 'crypto';
import { supabaseServer } from './supabase/server';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  currentCount?: number;
};

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export function getRequestInfo(request: Request) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export function getClientFingerprint(request: Request) {
  const { ip, userAgent: ua } = getRequestInfo(request);
  const pepper = process.env.RATE_LIMIT_PEPPER ?? '';
  const fingerprint = createHash('sha256')
    .update(`${pepper}|${ip}|${ua}`)
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
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStartMs + windowSeconds * 1000 - now) / 1000),
  );
  const key = createHash('sha256')
    .update(`${fingerprint}|${routeKey}|${windowStart}|${process.env.RATE_LIMIT_PEPPER ?? ''}`)
    .digest('hex');

  const { data, error } = await supabaseServer.rpc('rate_limit_hit', {
    p_key: key,
    p_route: routeKey,
    p_fingerprint: fingerprint,
    p_window_start: windowStart,
    p_limit: limit,
  });

  if (error) {
    console.error('[rateLimit] RPC error', error);
    return { allowed: false, retryAfterSeconds };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = Boolean(row?.allowed);
  const currentCount = Number(row?.current_count ?? 0);

  return {
    allowed,
    currentCount,
    retryAfterSeconds: allowed ? undefined : retryAfterSeconds,
  };
}
