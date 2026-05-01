type GeoPoint = {
  lat: number;
  lng: number;
};

export type PhotoNavigationReport = GeoPoint & {
  id: string;
  created_at: string;
  photo_url: string | null;
};

const EARTH_RADIUS_METERS = 6371000;

export function hasRenderablePhoto(url: string | null | undefined) {
  if (!url) return false;
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (!clean) return false;
  return !clean.endsWith('.heic') && !clean.endsWith('.heif');
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const aLat = toRadians(a.lat);
  const bLat = toRadians(b.lat);
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_METERS * c;
}

function tieBreak(a: PhotoNavigationReport, b: PhotoNavigationReport) {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function nearestToPoint<T extends PhotoNavigationReport>(
  source: GeoPoint,
  candidates: T[],
) {
  let winner: T | null = null;
  let winnerDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const currentDistance = distanceMeters(source, candidate);
    if (currentDistance < winnerDistance) {
      winner = candidate;
      winnerDistance = currentDistance;
      continue;
    }
    if (
      currentDistance === winnerDistance &&
      winner &&
      tieBreak(candidate, winner) < 0
    ) {
      winner = candidate;
      winnerDistance = currentDistance;
    }
  }
  return winner;
}

export function photoCandidates<T extends PhotoNavigationReport>(reports: T[]) {
  return reports.filter((report) => hasRenderablePhoto(report.photo_url));
}

export function resolveStartReport<T extends PhotoNavigationReport>(
  clickedReport: T,
  candidates: T[],
) {
  if (!candidates.length) return null;
  if (hasRenderablePhoto(clickedReport.photo_url)) {
    const exact = candidates.find((candidate) => candidate.id === clickedReport.id);
    if (exact) return exact;
  }
  return nearestToPoint(clickedReport, candidates);
}

export function buildNearestPath<T extends PhotoNavigationReport>(
  start: T,
  candidates: T[],
) {
  if (!candidates.length) return [];
  const startCandidate =
    candidates.find((candidate) => candidate.id === start.id) ?? null;
  if (!startCandidate) return [];

  const remaining = new Map<string, T>();
  for (const candidate of candidates) {
    if (candidate.id === startCandidate.id) continue;
    remaining.set(candidate.id, candidate);
  }

  const ordered: T[] = [startCandidate];
  let cursor = startCandidate;

  while (remaining.size > 0) {
    const next = nearestToPoint(cursor, Array.from(remaining.values()));
    if (!next) break;
    ordered.push(next);
    remaining.delete(next.id);
    cursor = next;
  }

  return ordered;
}
