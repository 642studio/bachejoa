type StaticMapOptions = {
  lat: number;
  lng: number;
  token?: string | null;
  width?: number;
  height?: number;
  zoom?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

export function buildReportStaticMapUrl(options: StaticMapOptions) {
  const token = (options.token ?? '').trim();
  if (!token) return null;

  const { lat, lng } = options;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  const width = clamp(Math.round(options.width ?? 224), 120, 1280);
  const height = clamp(Math.round(options.height ?? 148), 120, 1280);
  const zoom = clamp(options.zoom ?? 15, 0, 22);

  const lngText = lng.toFixed(6);
  const latText = lat.toFixed(6);
  const stylePath = 'mapbox/streets-v11';
  const marker = `pin-s+0ea5e9(${lngText},${latText})`;
  const center = `${lngText},${latText},${zoom},0`;
  const size = `${width}x${height}@2x`;

  return `https://api.mapbox.com/styles/v1/${stylePath}/static/${marker}/${center}/${size}?access_token=${encodeURIComponent(
    token,
  )}`;
}

