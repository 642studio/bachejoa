import { NextResponse } from 'next/server';
import {
  getSessionCookieName,
  readSessionToken,
  revokeSession,
} from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token) {
    await revokeSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
