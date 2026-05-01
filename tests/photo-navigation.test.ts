import { describe, expect, it } from 'vitest';
import {
  buildNearestPath,
  distanceMeters,
  hasRenderablePhoto,
  photoCandidates,
  resolveStartReport,
  type PhotoNavigationReport,
} from '../lib/photo-navigation';

function report(partial: Partial<PhotoNavigationReport>): PhotoNavigationReport {
  return {
    id: partial.id ?? crypto.randomUUID(),
    lat: partial.lat ?? 27.07,
    lng: partial.lng ?? -109.44,
    created_at: partial.created_at ?? '2026-04-01T00:00:00.000Z',
    photo_url:
      partial.photo_url === undefined
        ? 'https://example.com/photo.jpg'
        : partial.photo_url,
  };
}

describe('photo navigation helpers', () => {
  it('filters only reports with renderable photos', () => {
    const reports = [
      report({ id: 'a', photo_url: 'https://cdn/p1.jpg' }),
      report({ id: 'b', photo_url: null }),
      report({ id: 'c', photo_url: 'https://cdn/p2.heic' }),
      report({ id: 'd', photo_url: 'https://cdn/p3.webp' }),
    ];

    expect(photoCandidates(reports).map((item) => item.id)).toEqual(['a', 'd']);
  });

  it('resolves start report by nearest photo when clicked report has no photo', () => {
    const clicked = report({
      id: 'clicked',
      lat: 27.0800,
      lng: -109.4400,
      photo_url: null,
    });
    const candidates = [
      report({ id: 'near', lat: 27.0804, lng: -109.4403 }),
      report({ id: 'far', lat: 27.1100, lng: -109.4700 }),
    ];

    const start = resolveStartReport(clicked, candidates);
    expect(start?.id).toBe('near');
  });

  it('builds a deterministic nearest path without duplicates', () => {
    const start = report({
      id: 'a',
      lat: 27.0800,
      lng: -109.4400,
      created_at: '2026-04-01T00:00:00.000Z',
    });
    const b = report({
      id: 'b',
      lat: 27.0805,
      lng: -109.4405,
      created_at: '2026-04-02T00:00:00.000Z',
    });
    const c = report({
      id: 'c',
      lat: 27.0900,
      lng: -109.4500,
      created_at: '2026-04-03T00:00:00.000Z',
    });
    const d = report({
      id: 'd',
      lat: 27.1000,
      lng: -109.4600,
      created_at: '2026-04-04T00:00:00.000Z',
    });

    const path = buildNearestPath(start, [start, b, c, d]);

    expect(path.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(new Set(path.map((item) => item.id)).size).toBe(4);
  });

  it('uses tie-break by created_at then id when distances are equal', () => {
    const source = report({
      id: 'source',
      lat: 0,
      lng: 0,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const c1 = report({
      id: 'z',
      lat: 0.01,
      lng: 0,
      created_at: '2026-01-03T00:00:00.000Z',
    });
    const c2 = report({
      id: 'a',
      lat: -0.01,
      lng: 0,
      created_at: '2026-01-02T00:00:00.000Z',
    });

    // Distances from source are effectively equal, so created_at wins.
    expect(distanceMeters(source, c1)).toBeCloseTo(distanceMeters(source, c2), 6);
    const path = buildNearestPath(source, [source, c1, c2]);

    expect(path.map((item) => item.id)).toEqual(['source', 'a', 'z']);
  });

  it('detects unrenderable heic/heif URLs', () => {
    expect(hasRenderablePhoto('https://cdn/test.jpg')).toBe(true);
    expect(hasRenderablePhoto('https://cdn/test.heic')).toBe(false);
    expect(hasRenderablePhoto('https://cdn/test.heif?token=1')).toBe(false);
  });
});
