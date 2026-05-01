import { NextResponse } from 'next/server';
import {
  getLegacySessionCookieName,
  getSessionCookieOptions,
  getSessionCookieName,
  readSessionToken,
  revokeSession,
} from '../../../../lib/auth';
import { checkCSRF, csrfErrorResponse } from '../../../../lib/csrf';
import { createSupabaseServerAuthClient } from '../../../../lib/supabase/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const token = readSessionToken(request);
  if (token) {
    await revokeSession(token);
  }

  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const supabaseAuth = createSupabaseServerAuthClient(request, (cookie) => {
    cookiesToSet.push(cookie);
  });
  await supabaseAuth?.auth.signOut();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), '', getSessionCookieOptions(0));
  response.cookies.set(getLegacySessionCookieName(), '', {
    path: '/',
    maxAge: 0,
  });
  cookiesToSet.forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie.options as any);
  });

  return response;
}
