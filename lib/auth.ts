import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import { supabaseServer } from './supabase/server';

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = 'bachejoa_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

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
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(storedHash, 'hex');
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error } = await supabaseServer.from('user_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
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
    const token = cookies.get(SESSION_COOKIE_NAME);
    if (!token) return null;

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
  return cookies.get(SESSION_COOKIE_NAME) ?? null;
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}
