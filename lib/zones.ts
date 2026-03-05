export type ZoneDefinition = {
  id: string;
  name: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

// Zonas base de trabajo para Navojoa. Ajustables conforme se refine cartografia.
export const CITY_ZONES: ZoneDefinition[] = [
  {
    id: 'centro',
    name: 'Centro',
    latMin: 27.0705,
    latMax: 27.091,
    lngMin: -109.457,
    lngMax: -109.421,
  },
  {
    id: 'norte',
    name: 'Norte',
    latMin: 27.091,
    latMax: 27.125,
    lngMin: -109.472,
    lngMax: -109.404,
  },
  {
    id: 'sur',
    name: 'Sur',
    latMin: 27.035,
    latMax: 27.0705,
    lngMin: -109.474,
    lngMax: -109.404,
  },
  {
    id: 'poniente',
    name: 'Poniente',
    latMin: 27.058,
    latMax: 27.105,
    lngMin: -109.52,
    lngMax: -109.457,
  },
  {
    id: 'oriente',
    name: 'Oriente',
    latMin: 27.058,
    latMax: 27.105,
    lngMin: -109.421,
    lngMax: -109.36,
  },
];

export function resolveZoneByCoordinates(lat: number, lng: number) {
  const zone = CITY_ZONES.find(
    (item) =>
      lat >= item.latMin &&
      lat <= item.latMax &&
      lng >= item.lngMin &&
      lng <= item.lngMax,
  );
  if (!zone) {
    return { id: 'fuera', name: 'Fuera de zona' };
  }
  return { id: zone.id, name: zone.name };
}

export function zoneNameById(zoneId: string) {
  return CITY_ZONES.find((item) => item.id === zoneId)?.name ?? 'Fuera de zona';
}
