import type { NextConfig } from 'next';

function normalizeDevOriginHost(origin: string) {
  return origin.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? '';
}

const envAllowedDevOrigins = (process.env.NEXT_PUBLIC_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => normalizeDevOriginHost(origin.trim()))
  .filter(Boolean);

const allowedDevOrigins = Array.from(
  new Set(['127.0.0.1', ...envAllowedDevOrigins]),
);

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com https://api.mapbox.com",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' blob:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.mapbox.com https://*.supabase.co https://vitals.vercel-insights.com",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const config: NextConfig = {
  allowedDevOrigins,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default config;
