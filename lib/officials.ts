import { createHash, randomBytes } from 'crypto';
import { getRequestInfo } from './security';
import { supabaseServer } from './supabase/server';

const OFFICIAL_SESSION_COOKIE = '__Host-bachejoa_official_session';
const LEGACY_OFFICIAL_SESSION_COOKIE = 'bachejoa_official_session';
const OFFICIAL_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const OFFICIAL_SESSION_TTL_MS = OFFICIAL_SESSION_TTL_SECONDS * 1000;

type CookieMap = Map<string, string>;

function parseCookies(cookieHeader: string | null): CookieMap {
  const jar = new Map<string, string>();
  if (!cookieHeader) return jar;
  cookieHeader.split(';').forEach((chunk) => {
    const [rawKey, ...rest] = chunk.trim().split('=');
    if (!rawKey || rest.length === 0) return;
    jar.set(rawKey, decodeURIComponent(rest.join('=')));
  });
  return jar;
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getOfficialSessionCookieName() {
  return OFFICIAL_SESSION_COOKIE;
}

export function getLegacyOfficialSessionCookieName() {
  return LEGACY_OFFICIAL_SESSION_COOKIE;
}

export function readOfficialSessionToken(request: Request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  return (
    cookies.get(OFFICIAL_SESSION_COOKIE) ??
    cookies.get(LEGACY_OFFICIAL_SESSION_COOKIE) ??
    null
  );
}

export function getOfficialSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

export async function createOfficialSession(
  officialId: string,
  request?: Request,
) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + OFFICIAL_SESSION_TTL_MS).toISOString();
  const requestInfo = request ? getRequestInfo(request) : null;

  let { error } = await supabaseServer.from('official_sessions').insert({
    official_id: officialId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: requestInfo?.ip ?? null,
    user_agent: requestInfo?.userAgent ?? null,
    last_used_at: new Date().toISOString(),
  });

  if (error?.code === '42703') {
    const fallback = await supabaseServer.from('official_sessions').insert({
      official_id: officialId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    error = fallback.error;
  }

  if (error) {
    console.error('[officials] session insert failed', error);
    throw new Error('SESSION_CREATE_FAILED');
  }

  return {
    token,
    expiresAt,
    maxAge: OFFICIAL_SESSION_TTL_SECONDS,
  };
}

export async function revokeOfficialSession(token: string) {
  const tokenHash = hashSessionToken(token);
  await supabaseServer
    .from('official_sessions')
    .delete()
    .eq('token_hash', tokenHash);
}

export async function getOfficialSessionAccount(request: Request) {
  const token = readOfficialSessionToken(request);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);

  const { data: session, error: sessionError } = await supabaseServer
    .from('official_sessions')
    .select('id, official_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (sessionError || !session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabaseServer.from('official_sessions').delete().eq('id', session.id);
    return null;
  }
  await supabaseServer
    .from('official_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id);

  const { data: official, error: officialError } = await supabaseServer
    .from('official_accounts')
    .select('*')
    .eq('id', session.official_id)
    .maybeSingle();

  if (officialError || !official || !official.active) return null;
  return official;
}
