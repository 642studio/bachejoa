import { NextResponse } from 'next/server';
import {
  getLegacyOfficialSessionCookieName,
  getOfficialSessionCookieOptions,
  getOfficialSessionCookieName,
  readOfficialSessionToken,
  revokeOfficialSession,
} from '../../../../lib/officials';
import { checkCSRF, csrfErrorResponse } from '../../../../lib/csrf';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!checkCSRF(request)) return csrfErrorResponse();

  const token = readOfficialSessionToken(request);
  if (token) {
    await revokeOfficialSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    getOfficialSessionCookieName(),
    '',
    getOfficialSessionCookieOptions(0),
  );
  response.cookies.set(getLegacyOfficialSessionCookieName(), '', {
    path: '/',
    maxAge: 0,
  });
  return response;
}
