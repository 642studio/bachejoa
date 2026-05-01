import { describe, expect, it, beforeEach, vi } from 'vitest';
import { checkCSRF } from '../lib/csrf';
import {
  ContactSchema,
  CursorSchema,
  OfficialAccountSchema,
  ReportCreateSchema,
} from '../lib/schemas';
import {
  isAllowedStoragePublicUrl,
  storagePathFromPublicUrl,
} from '../lib/storage';
import { getClientFingerprint } from '../lib/security';

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'test-service-role-key-for-unit-tests-only';
  process.env.SUPABASE_STORAGE_BUCKET = 'bachejoa-reports';
});

describe('CSRF validation', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bachejoa.com');
  });

  it('allows same-origin requests', () => {
    const request = new Request('https://bachejoa.com/api/reports', {
      method: 'POST',
      headers: { origin: 'https://bachejoa.com' },
    });
    expect(checkCSRF(request)).toBe(true);
  });

  it('rejects cross-origin requests', () => {
    const request = new Request('https://bachejoa.com/api/reports', {
      method: 'POST',
      headers: { origin: 'https://attacker.test' },
    });
    expect(checkCSRF(request)).toBe(false);
  });
});

describe('storage URL validation', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_STORAGE_BUCKET = 'bachejoa-reports';
  });

  it('accepts report photos from the configured Supabase bucket', () => {
    const url =
      'https://project.supabase.co/storage/v1/object/public/bachejoa-reports/reports/photo.jpg';
    expect(isAllowedStoragePublicUrl(url)).toBe(true);
    expect(storagePathFromPublicUrl(url)).toBe('reports/photo.jpg');
  });

  it('rejects external photo URLs', () => {
    expect(isAllowedStoragePublicUrl('https://example.com/photo.jpg')).toBe(false);
    expect(storagePathFromPublicUrl('https://example.com/photo.jpg')).toBeNull();
  });
});

describe('schemas', () => {
  it('validates report bounds and category pairs', () => {
    expect(
      ReportCreateSchema.safeParse({
        lat: 27.08,
        lng: -109.44,
        category: 'Baches',
        subcategory: 'Bache',
        status: 'Visible',
      }).success,
    ).toBe(true);

    expect(
      ReportCreateSchema.safeParse({
        lat: 127,
        lng: -109.44,
        category: 'Baches',
        subcategory: 'Bache',
      }).success,
    ).toBe(false);

    expect(
      ReportCreateSchema.safeParse({
        lat: 27.08,
        lng: -109.44,
        category: 'Agua',
        subcategory: 'Bache',
      }).success,
    ).toBe(false);
  });

  it('validates bounded contact payloads', () => {
    expect(
      ContactSchema.safeParse({
        name: 'Vecino',
        contact: 'vecino@example.com',
        message: 'Necesito seguimiento del reporte.',
      }).success,
    ).toBe(true);
    expect(
      ContactSchema.safeParse({
        name: 'V',
        contact: 'x',
        message: 'corto',
      }).success,
    ).toBe(false);
  });

  it('validates cursors and official account assignments', () => {
    expect(
      CursorSchema.safeParse({
        limit: '20',
        cursor: '2026-04-29T00:00:00.000Z',
        cursor_id: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);

    expect(
      OfficialAccountSchema.safeParse({
        username: 'Obras01',
        password: 'password-seguro',
        full_name: 'Obras Publicas',
        email: 'obras@example.com',
        categories: ['Baches'],
        zones: ['centro'],
      }).data?.username,
    ).toBe('obras01');
  });
});

describe('fingerprint hardening', () => {
  it('uses the configured pepper', () => {
    const request = new Request('https://bachejoa.com/api/reports', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
    });

    process.env.RATE_LIMIT_PEPPER = 'one';
    const one = getClientFingerprint(request).fingerprint;
    process.env.RATE_LIMIT_PEPPER = 'two';
    const two = getClientFingerprint(request).fingerprint;

    expect(one).not.toBe(two);
  });
});
