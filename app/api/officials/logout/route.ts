import { NextResponse } from 'next/server';
import {
  getOfficialSessionCookieName,
  readOfficialSessionToken,
  revokeOfficialSession,
} from '../../../../lib/officials';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = readOfficialSessionToken(request);
  if (token) {
    await revokeOfficialSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getOfficialSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
