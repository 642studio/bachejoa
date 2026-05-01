import { describe, expect, it } from 'vitest';
import { buildReportStaticMapUrl } from '../lib/mapbox-static';

describe('buildReportStaticMapUrl', () => {
  it('builds a static map URL with coordinates and token', () => {
    const url = buildReportStaticMapUrl({
      lat: 27.08123,
      lng: -109.44231,
      token: 'pk.test-token',
      width: 220,
      height: 140,
      zoom: 15,
    });

    expect(url).toContain('styles/v1/mapbox/streets-v11/static/');
    expect(url).toContain('pin-s+0ea5e9(-109.442310,27.081230)');
    expect(url).toContain('/-109.442310,27.081230,15,0/');
    expect(url).toContain('220x140@2x');
    expect(url).toContain('access_token=pk.test-token');
  });

  it('returns null when token is missing', () => {
    expect(
      buildReportStaticMapUrl({
        lat: 27.08,
        lng: -109.44,
        token: '',
      }),
    ).toBeNull();
  });

  it('returns null when coordinates are invalid', () => {
    expect(
      buildReportStaticMapUrl({
        lat: 127.08,
        lng: -109.44,
        token: 'pk.ok',
      }),
    ).toBeNull();

    expect(
      buildReportStaticMapUrl({
        lat: 27.08,
        lng: -209.44,
        token: 'pk.ok',
      }),
    ).toBeNull();
  });
});

