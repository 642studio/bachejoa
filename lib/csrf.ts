import { NextResponse } from 'next/server';

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(request: Request) {
  const requestOrigin = normalizeOrigin(request.url);
  const configured = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    requestOrigin ?? undefined,
  ];
  return new Set(configured.map(normalizeOrigin).filter(Boolean) as string[]);
}

export function checkCSRF(request: Request) {
  const origin = normalizeOrigin(request.headers.get('origin'));
  const referer = normalizeOrigin(request.headers.get('referer'));
  const allowedOrigins = getAllowedOrigins(request);

  if (origin && allowedOrigins.has(origin)) return true;
  if (referer && allowedOrigins.has(referer)) return true;

  return process.env.NODE_ENV !== 'production' && !origin && !referer;
}

export function csrfErrorResponse() {
  return NextResponse.json({ error: 'Solicitud no permitida.' }, { status: 403 });
}
