import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto';
import { getRequestInfo } from './security';
import { createSupabaseServerAuthClient } from './supabase/auth';
import { supabaseServer } from './supabase/server';

const SESSION_COOKIE_NAME = '__Host-bachejoa_session';
const LEGACY_SESSION_COOKIE_NAME = 'bachejoa_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const SCRYPT_OPTIONS = {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
};
const DUMMY_HASH =
  process.env.AUTH_DUMMY_HASH ??
  'bb091d79506b5f7f1036865051eac0ab:fc20f0063e46d8b05a36d5ace0a01ee15ae53e052d9630283d61f1c33419fd0aa2f5d0db7f50a238f1653f44f8d49a3327f6655106eba2bc34adf3bbd6479cab';

function scrypt(
  password: string,
  salt: string,
  keyLength: number,
  options?: typeof SCRYPT_OPTIONS,
) {
  return new Promise<Buffer>((resolve, reject) => {
    const callback = (error: Error | null, derivedKey: Buffer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    };
    if (options) {
      scryptCallback(password, salt, keyLength, options, callback);
      return;
    }
    scryptCallback(password, salt, keyLength, callback);
  });
}

function parseCookies(cookieHeader: string | null) {
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

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64, SCRYPT_OPTIONS)) as Buffer;
  return `scrypt:N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p}:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const parts = passwordHash.split(':');
  const isVersioned = parts[0] === 'scrypt';
  const salt = isVersioned ? parts[2] : parts[0];
  const storedHash = isVersioned ? parts[3] : parts[1];
  if (!salt || !storedHash) return false;
  const key = (await scrypt(
    password,
    salt,
    64,
    isVersioned ? SCRYPT_OPTIONS : undefined,
  )) as Buffer;
  const expected = Buffer.from(storedHash, 'hex');
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

export async function burnPasswordTiming(password: string) {
  await verifyPassword(password, DUMMY_HASH);
}

export async function createSession(userId: string, request?: Request) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const requestInfo = request ? getRequestInfo(request) : null;

  let { error } = await supabaseServer.from('user_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: requestInfo?.ip ?? null,
    user_agent: requestInfo?.userAgent ?? null,
    last_used_at: new Date().toISOString(),
  });

  if (error?.code === '42703') {
    const fallback = await supabaseServer.from('user_sessions').insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    error = fallback.error;
  }

  if (error) {
    console.error('[auth] session insert failed', error);
    throw new Error('SESSION_CREATE_FAILED');
  }

  return {
    token,
    expiresAt,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function revokeSession(token: string) {
  const tokenHash = hashSessionToken(token);
  await supabaseServer.from('user_sessions').delete().eq('token_hash', tokenHash);
}

export async function getSessionUser(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const token =
      cookies.get(SESSION_COOKIE_NAME) ?? cookies.get(LEGACY_SESSION_COOKIE_NAME);
    if (!token) {
      return getSupabaseSessionUser(request);
    }

    const tokenHash = hashSessionToken(token);

    const { data: session, error: sessionError } = await supabaseServer
      .from('user_sessions')
      .select('id, user_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (sessionError || !session) return null;

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await supabaseServer.from('user_sessions').delete().eq('id', session.id);
      return null;
    }
    await supabaseServer
      .from('user_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', session.id);

    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('id, username, email, role, avatar_key, created_at')
      .eq('id', session.user_id)
      .maybeSingle();

    if (userError || !user) return null;

    return user;
  } catch {
    return null;
  }
}

async function getSupabaseSessionUser(request: Request) {
  const supabaseAuth = createSupabaseServerAuthClient(request);
  if (!supabaseAuth) return null;

  const { data, error } = await supabaseAuth.auth.getUser();
  const authUser = data.user;
  if (error || !authUser?.id || !authUser.email) return null;

  const byId = await supabaseServer
    .from('users')
    .select('id, username, email, role, avatar_key, created_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (byId.error) return null;
  if (byId.data) return byId.data;

  const byEmail = await supabaseServer
    .from('users')
    .select('id, username, email, role, avatar_key, created_at')
    .eq('email', authUser.email.toLowerCase())
    .maybeSingle();

  if (byEmail.error || !byEmail.data) return null;
  return byEmail.data;
}

export function isPlatformAdmin(user: {
  username?: string | null;
  role?: string | null;
} | null) {
  if (!user) return false;
  return user.role === 'admin';
}

export function readSessionToken(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  return (
    cookies.get(SESSION_COOKIE_NAME) ??
    cookies.get(LEGACY_SESSION_COOKIE_NAME) ??
    null
  );
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getLegacySessionCookieName() {
  return LEGACY_SESSION_COOKIE_NAME;
}

export function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}
