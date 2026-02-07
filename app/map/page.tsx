'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

declare const google: any;

const bacheTypes = [
  {
    name: 'Pequeña grieta',
    icon: '/pinesmap/pingrieta.png',
  },
  {
    name: 'Bache',
    icon: '/pinesmap/pinbache.png',
  },
  {
    name: 'Bachesón',
    icon: '/pinesmap/pinbache2.png',
  },
  {
    name: 'Reparación inconclusa',
    icon: '/pinesmap/pinreparacion.png',
  },
];

type LatLngLiteral = { lat: number; lng: number };
type ReportRecord = {
  id: string;
  lat: number;
  lng: number;
  type: string;
  photo_url: string | null;
  created_at: string;
};

const defaultCenter: LatLngLiteral = { lat: 27.0706, lng: -109.4437 };
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
}

function createMarkerIcon(type: { name: string; icon: string }) {
  return {
    url: type.icon,
    scaledSize: new google.maps.Size(52, 52),
    anchor: new google.maps.Point(26, 52),
  };
}

function createGlowIcon(type: { name: string; icon: string }) {
  return {
    url: type.icon,
    scaledSize: new google.maps.Size(60, 60),
    anchor: new google.maps.Point(30, 60),
  };
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const tempGlowRef = useRef<any>(null);
  const savedMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [newPin, setNewPin] = useState<LatLngLiteral | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(bacheTypes[0].name);
  const [mapReady, setMapReady] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeType = useMemo(
    () => bacheTypes.find((type) => type.name === selectedType),
    [selectedType],
  );

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !mapRef.current) return;

    loadGoogleMaps()
      .then(async () => {
        const map = new google.maps.Map(mapRef.current as HTMLDivElement, {
          center: defaultCenter,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapReady(true);

        map.addListener('click', (event: any) => {
          if (!event.latLng) return;
          const pos = event.latLng.toJSON();
          setNewPin(pos);
          setIsDialogOpen(true);
        });
      })
      .catch(() => {
        setMapReady(false);
      });
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    let isActive = true;
    fetch('/api/reports')
      .then(async (res) => {
        if (!res.ok) return [];
        return (await res.json()) as ReportRecord[];
      })
      .then((reports) => {
        if (!isActive) return;
        savedMarkersRef.current.forEach((marker) => marker.setMap(null));
        savedMarkersRef.current = [];
        reports.forEach((report) => addReportMarker(report));
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapInstanceRef.current || !newPin || !activeType) return;

    if (!tempMarkerRef.current) {
      const marker = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: newPin,
        draggable: true,
        icon: createGlowIcon(activeType),
        zIndex: 2,
      });

      marker.addListener('dragend', (event: any) => {
        if (!event.latLng) return;
        setNewPin(event.latLng.toJSON());
      });

      tempMarkerRef.current = marker;
    }

    if (!tempGlowRef.current) {
      const glow = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: newPin,
        clickable: false,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#ef4444',
          fillOpacity: 0.25,
          strokeColor: '#ef4444',
          strokeOpacity: 0.6,
          strokeWeight: 2,
          scale: 20,
        },
        zIndex: 1,
      });
      tempGlowRef.current = glow;
    }

    tempMarkerRef.current.setIcon(createGlowIcon(activeType));
    tempMarkerRef.current.setPosition(newPin);
    if (tempGlowRef.current) {
      tempGlowRef.current.setPosition(newPin);
    }
  }, [newPin, activeType]);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoName(null);
      return;
    }
    setPhotoName(file.name);
    setPhotoFile(file);
  }

  function buildInfoContent(
    type: string,
    photoUrl: string | null,
    date: string,
  ) {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '220px';
    wrapper.style.fontFamily = 'inherit';

    const title = document.createElement('div');
    title.textContent = type;
    title.style.fontWeight = '600';
    title.style.marginBottom = '6px';

    const dateEl = document.createElement('div');
    dateEl.textContent = date;
    dateEl.style.fontSize = '12px';
    dateEl.style.color = '#64748b';
    dateEl.style.marginBottom = '8px';

    wrapper.appendChild(title);
    wrapper.appendChild(dateEl);

    if (photoUrl) {
      const img = document.createElement('img');
      img.src = photoUrl;
      img.alt = `Reporte ${type}`;
      img.style.width = '100%';
      img.style.borderRadius = '10px';
      img.style.objectFit = 'cover';
      wrapper.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.textContent = 'Sin foto';
      empty.style.fontSize = '12px';
      empty.style.color = '#94a3b8';
      wrapper.appendChild(empty);
    }

    return wrapper;
  }

  function resolveTypeIcon(typeName: string) {
    return (
      bacheTypes.find((type) => type.name === typeName) ?? bacheTypes[0]
    );
  }

  function addReportMarker(report: ReportRecord) {
    if (!mapInstanceRef.current) return;
    const type = resolveTypeIcon(report.type);
    const marker = new google.maps.Marker({
      map: mapInstanceRef.current,
      position: { lat: report.lat, lng: report.lng },
      draggable: false,
      icon: createMarkerIcon(type),
      zIndex: 2,
    });

    marker.addListener('click', () => {
      if (!infoWindowRef.current) return;
      const reportDate = new Date(report.created_at).toLocaleDateString(
        'es-MX',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      );
      const content = buildInfoContent(
        report.type,
        report.photo_url,
        reportDate,
      );
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({
        map: mapInstanceRef.current,
        anchor: marker,
      });
    });

    savedMarkersRef.current.push(marker);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="relative h-screen w-screen">
        <div className="absolute inset-0 overflow-hidden bg-white shadow-[0_30px_70px_rgba(15,23,42,0.25)]">
          <div className="absolute left-6 top-6 z-10">
            <p className="text-sm font-semibold text-slate-700">
              Navojoa, Sonora
            </p>
          </div>

          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-10">
            <img
              alt="Bachejoa Map"
              className="w-40 max-w-[60vw] object-contain sm:w-48 lg:w-56"
              src="/logo.png"
            />
          </div>

          <div className="absolute inset-0">
            <div className="absolute inset-0" ref={mapRef} />
            {!GOOGLE_MAPS_API_KEY && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 text-sm text-slate-600">
                Agrega `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para cargar el mapa.
              </div>
            )}
          </div>

          <button
            className="absolute bottom-6 right-6 z-10 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400 text-3xl font-semibold text-slate-900 shadow-[0_18px_30px_rgba(15,23,42,0.35)]"
            onClick={() => {
              if (!mapInstanceRef.current) return;
              const center = mapInstanceRef.current.getCenter();
              if (!center) return;
              setNewPin(center.toJSON());
              setIsDialogOpen(true);
            }}
            type="button"
          >
            +
          </button>
        </div>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
          <div className="w-full max-w-xl rounded-[28px] bg-sky-200/90 px-6 py-4 shadow-[0_20px_40px_rgba(15,23,42,0.35)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Tipo de bache
                </p>
                <p className="text-xs text-slate-600">
                  Arrastra el pin y selecciona el tipo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => setIsDialogOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  disabled={isSaving}
                  onClick={async () => {
                    if (!mapInstanceRef.current || !newPin || !activeType) return;
                    setIsSaving(true);
                    try {
                      const formData = new FormData();
                      formData.append('lat', String(newPin.lat));
                      formData.append('lng', String(newPin.lng));
                      formData.append('type', activeType.name);
                      if (photoFile) {
                        formData.append('photo', photoFile, photoFile.name);
                      }
                      const res = await fetch('/api/reports', {
                        method: 'POST',
                        body: formData,
                      });
                      if (res.ok) {
                        const report = (await res.json()) as ReportRecord;
                        addReportMarker(report);
                      }
                    } finally {
                      setIsSaving(false);
                    }

                    if (tempMarkerRef.current) {
                      tempMarkerRef.current.setMap(null);
                      tempMarkerRef.current = null;
                    }
                    if (tempGlowRef.current) {
                      tempGlowRef.current.setMap(null);
                      tempGlowRef.current = null;
                    }
                    setPhotoFile(null);
                    setPhotoName(null);
                    setNewPin(null);
                    setIsDialogOpen(false);
                  }}
                  type="button"
                >
                  {isSaving ? 'Guardando…' : 'REPORTAR'}
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border-2 border-sky-400 bg-sky-100 px-3 py-2">
              <select
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
                onChange={(event) => setSelectedType(event.target.value)}
                value={selectedType}
              >
                {bacheTypes.map((type) => (
                  <option key={type.name} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-2xl border-2 border-sky-200 bg-white/80 px-3 py-2">
              <label className="block text-xs font-semibold text-slate-600">
                Foto del bache
              </label>
              <div className="mt-2 flex items-center justify-between gap-3">
                <input
                  accept="image/*"
                  className="w-full text-xs text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  onChange={handlePhotoChange}
                  type="file"
                />
                {photoName && (
                  <span className="text-[10px] text-slate-500">{photoName}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
