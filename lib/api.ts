import { NextResponse } from 'next/server';

export function tooManyRequests(retryAfterSeconds?: number) {
  const response = NextResponse.json(
    { error: 'Too many requests.' },
    { status: 429 },
  );
  if (retryAfterSeconds) {
    response.headers.set('Retry-After', String(retryAfterSeconds));
  }
  return response;
}

export function safeErrorResponse(
  error: unknown,
  fallback: string,
  status = 500,
) {
  console.error('[api]', fallback, error);
  return NextResponse.json({ error: fallback }, { status });
}

export function validationErrorResponse(message = 'Datos inválidos.') {
  return NextResponse.json({ error: message }, { status: 400 });
}
