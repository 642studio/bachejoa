'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AudioControls from '../components/AudioControls';

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
  angry_count: number | null;
  repaired?: boolean | null;
  repaired_at?: string | null;
  repair_rating_avg?: number | null;
  repair_rating_count?: number | null;
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

function createRepairedIcon() {
  return {
    url: '/reparado.svg',
    scaledSize: new google.maps.Size(52, 52),
    anchor: new google.maps.Point(26, 52),
  };
}

function createDotIcon(color: string) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight: 2,
    scale: 6,
  };
}

function resolveTypeColor(typeName: string) {
  switch (typeName) {
    case 'Pequeña grieta':
      return '#38bdf8';
    case 'Bache':
      return '#f97316';
    case 'Bachesón':
      return '#ef4444';
    case 'Reparación inconclusa':
      return '#eab308';
    default:
      return '#64748b';
  }
}

function createGlowIcon(type: { name: string; icon: string }) {
  return {
    url: type.icon,
    scaledSize: new google.maps.Size(60, 60),
    anchor: new google.maps.Point(30, 60),
  };
}

export default function MapClient() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const tempGlowRef = useRef<any>(null);
  const savedMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const focusedRef = useRef(false);
  const [newPin, setNewPin] = useState<LatLngLiteral | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(bacheTypes[0].name);
  const [mapReady, setMapReady] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [reportList, setReportList] = useState<ReportRecord[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [shareReport, setShareReport] = useState<ReportRecord | null>(null);
  const [shareMode, setShareMode] = useState<'new' | 'existing'>('new');
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [showDetailedPins, setShowDetailedPins] = useState(false);

  const mapSummary = useMemo(() => {
    const counts = new Map<string, number>();
    bacheTypes.forEach((type) => counts.set(type.name, 0));
    let withPhoto = 0;
    let repaired = 0;
    reportList.forEach((report) => {
      counts.set(report.type, (counts.get(report.type) ?? 0) + 1);
      if (report.photo_url) withPhoto += 1;
      if (report.repaired) repaired += 1;
    });
    return { counts, withPhoto, repaired };
  }, [reportList]);

  const guideSteps = [
    '👋 ¡Bienvenido! Soy El Presi. Aquí te voy a enseñar cómo reportar baches y ayudar a mejorar Navojoa… paso a paso y sin rodeos.',
    '🗺️ Muévete por el mapa con tu dedo o mouse hasta encontrar el bache que te hizo sufrir.',
    '📍 Toca exactamente donde está el bache. Entre más preciso seas, más fácil será atenderlo.',
    '🛠️ Elige el tipo de bache que encontraste: grieta, bache, bachesón… o peor.',
    '📸 Si puedes, sube una foto. No es obligatorio, pero ayuda mucho a comprobar el reporte.',
    '✅ Presiona REPORTAR y listo. Ya hiciste más que muchos 😏',
  ];

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
        setShowDetailedPins(map.getZoom() >= 14);

        map.addListener('click', (event: any) => {
          if (!event.latLng) return;
          const pos = event.latLng.toJSON();
          setNewPin(pos);
          setIsDialogOpen(true);
        });

        map.addListener('zoom_changed', () => {
          const zoom = map.getZoom() ?? 0;
          const detailed = zoom >= 14;
          setShowDetailedPins(detailed);
          savedMarkersRef.current.forEach((marker) => {
            const report: ReportRecord | undefined = marker.reportData;
            if (!report) return;
            if (report.repaired) {
              marker.setIcon(
                detailed ? createRepairedIcon() : createDotIcon('#22c55e'),
              );
              return;
            }
            if (detailed) {
              const type = resolveTypeIcon(report.type);
              marker.setIcon(createMarkerIcon(type));
            } else {
              marker.setIcon(createDotIcon(resolveTypeColor(report.type)));
            }
          });
        });
      })
      .catch(() => {
        setMapReady(false);
      });
  }, []);

  useEffect(() => {
    const seen = window.localStorage.getItem('bachejoa_guide_seen');
    if (!seen) {
      setShowGuide(true);
      setGuideStep(0);
    }
    const last = window.localStorage.getItem('bachejoa_last_report');
    if (last) {
      setLastCreatedId(last);
    }
  }, []);

  function isLastCreated(reportId: string) {
    if (reportId === lastCreatedId) return true;
    try {
      return window.localStorage.getItem('bachejoa_last_report') === reportId;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    let isActive = true;
    const fetchAllReports = async () => {
      let all: ReportRecord[] = [];
      let cursor: { cursor: string; cursor_id: string } | null = null;
      while (true) {
        const params = new URLSearchParams();
        params.set('limit', '200');
        if (cursor) {
          params.set('cursor', cursor.cursor);
          params.set('cursor_id', cursor.cursor_id);
        }
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) break;
        const payload = (await res.json()) as {
          data: ReportRecord[];
          nextCursor: { cursor: string; cursor_id: string } | null;
        };
        const chunk = payload.data ?? [];
        all = all.concat(chunk);
        if (!payload.nextCursor) break;
        cursor = payload.nextCursor;
      }
      return all;
    };

    fetchAllReports()
      .then((reports) => {
        if (!isActive) return;
        setReportList(reports);
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
    if (!mapReady || !mapInstanceRef.current || focusedRef.current) return;
    const focusId = searchParams.get('focus');
    if (!focusId) return;
    const report = reportList.find((item) => item.id === focusId);
    if (!report) return;
    focusedRef.current = true;
    mapInstanceRef.current.panTo({ lat: report.lat, lng: report.lng });
    mapInstanceRef.current.setZoom(16);
    const marker = savedMarkersRef.current.find(
      (item) => item.reportId === report.id,
    );
    if (marker) {
      google.maps.event.trigger(marker, 'click');
    }
  }, [mapReady, reportList, searchParams]);

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

  function hasVoted(reportId: string) {
    try {
      return window.localStorage.getItem(`bachejoa_angry_${reportId}`) === '1';
    } catch {
      return false;
    }
  }

  function markVoted(reportId: string) {
    try {
      window.localStorage.setItem(`bachejoa_angry_${reportId}`, '1');
    } catch {
      // ignore
    }
  }

  async function incrementAngryCount(
    reportId: string,
    countEl: HTMLSpanElement,
    buttonEl: HTMLButtonElement,
  ) {
    if (hasVoted(reportId)) return;
    try {
      const res = await fetch(`/api/reports/${reportId}/angry`, {
        method: 'POST',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { angry_count: number };
      countEl.textContent = String(data.angry_count ?? 0);
      markVoted(reportId);
      buttonEl.disabled = true;
      buttonEl.style.opacity = '0.6';
      buttonEl.style.cursor = 'default';
    } catch {
      // ignore
    }
  }

  function buildInfoContent(report: ReportRecord, marker: any) {
    const {
      id: reportId,
      type,
      photo_url: photoUrl,
      angry_count: angryCount,
      repaired,
      repair_rating_avg: ratingAvg,
      repair_rating_count: ratingCount,
    } = report;
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '240px';
    wrapper.style.fontFamily = 'inherit';
    wrapper.style.display = 'grid';
    wrapper.style.gap = '8px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.flexDirection = 'column';
    header.style.gap = '4px';

    const title = document.createElement('div');
    title.textContent = type;
    title.style.fontWeight = '700';
    title.style.fontSize = '16px';
    title.style.color = '#0f172a';

    const dateEl = document.createElement('div');
    dateEl.textContent = new Date(report.created_at).toLocaleDateString(
      'es-MX',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      },
    );
    dateEl.style.fontSize = '12px';
    dateEl.style.color = '#64748b';

    header.appendChild(title);
    header.appendChild(dateEl);
    wrapper.appendChild(header);

    if (!repaired) {
      const reaction = document.createElement('button');
      reaction.type = 'button';
      reaction.style.display = 'flex';
      reaction.style.alignItems = 'center';
      reaction.style.justifyContent = 'space-between';
      reaction.style.gap = '10px';
      reaction.style.width = '100%';
      reaction.style.padding = '8px 12px';
      reaction.style.borderRadius = '16px';
      reaction.style.border = '2px solid #bae6fd';
      reaction.style.background = '#e0f2fe';
      reaction.style.cursor = 'pointer';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';

      const emoji = document.createElement('img');
      emoji.src = '/angryface.png';
      emoji.alt = 'Me enojas';
      emoji.style.width = '20px';
      emoji.style.height = '20px';

      const label = document.createElement('span');
      label.textContent = 'Me enojas';
      label.style.fontSize = '12px';
      label.style.color = '#0f172a';
      label.style.fontWeight = '600';

      left.appendChild(emoji);
      left.appendChild(label);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '6px';

      const count = document.createElement('span');
      count.textContent = `${angryCount ?? 0}`;
      count.style.fontSize = '12px';
      count.style.color = '#0f172a';
      count.style.fontWeight = '700';

      const plus = document.createElement('span');
      plus.textContent = '+';
      plus.style.display = 'inline-flex';
      plus.style.alignItems = 'center';
      plus.style.justifyContent = 'center';
      plus.style.width = '20px';
      plus.style.height = '20px';
      plus.style.borderRadius = '999px';
      plus.style.background = '#38bdf8';
      plus.style.color = '#ffffff';
      plus.style.fontSize = '12px';
      plus.style.fontWeight = '700';

      right.appendChild(count);
      right.appendChild(plus);

      reaction.appendChild(left);
      reaction.appendChild(right);
      reaction.addEventListener('click', () =>
        incrementAngryCount(reportId, count, reaction),
      );
      if (hasVoted(reportId)) {
        reaction.disabled = true;
        reaction.style.opacity = '0.6';
        reaction.style.cursor = 'default';
      }

      wrapper.appendChild(reaction);

      const repairButton = document.createElement('button');
      repairButton.type = 'button';
      repairButton.textContent = 'Reportar reparación';
      repairButton.style.width = '100%';
      repairButton.style.padding = '8px 12px';
      repairButton.style.borderRadius = '14px';
      repairButton.style.border = '2px solid #0f172a';
      repairButton.style.background = '#0f172a';
      repairButton.style.color = '#ffffff';
      repairButton.style.fontSize = '12px';
      repairButton.style.fontWeight = '600';
      repairButton.style.cursor = 'pointer';
      repairButton.addEventListener('click', async () => {
        try {
          repairButton.disabled = true;
          const res = await fetch(`/api/reports/${reportId}/repair`, {
            method: 'POST',
          });
          if (!res.ok) return;
          const updated = (await res.json()) as ReportRecord;
          marker.setIcon(createRepairedIcon());
          setReportList((prev) =>
            prev.map((item) => (item.id === reportId ? updated : item)),
          );
          const refreshed = buildInfoContent(updated, marker);
          infoWindowRef.current?.setContent(refreshed);
        } finally {
          repairButton.disabled = false;
        }
      });
      wrapper.appendChild(repairButton);
    } else {
      const ratingWrap = document.createElement('div');
      ratingWrap.style.display = 'grid';
      ratingWrap.style.gap = '8px';
      ratingWrap.style.padding = '12px 14px';
      ratingWrap.style.borderRadius = '16px';
      ratingWrap.style.border = '2px solid #fde68a';
      ratingWrap.style.background = '#fef3c7';

      const ratingLabel = document.createElement('div');
      ratingLabel.textContent = 'Califica la reparación';
      ratingLabel.style.fontSize = '12px';
      ratingLabel.style.fontWeight = '600';
      ratingLabel.style.color = '#92400e';
      ratingLabel.style.marginBottom = '2px';

      const starsRow = document.createElement('div');
      starsRow.style.display = 'flex';
      starsRow.style.gap = '6px';
      starsRow.style.flexWrap = 'wrap';

      const summary = document.createElement('div');
      summary.style.fontSize = '11px';
      summary.style.color = '#92400e';
      summary.style.marginTop = '2px';
      summary.textContent = `Promedio: ${(
        Number(ratingAvg ?? 0) || 0
      ).toFixed(1)} (${ratingCount ?? 0} votos)`;

      const submitRating = async (rating: number) => {
        const res = await fetch(`/api/reports/${reportId}/rating`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          repair_rating_avg: number;
          repair_rating_count: number;
        };
        summary.textContent = `Promedio: ${(
          Number(data.repair_rating_avg ?? 0) || 0
        ).toFixed(1)} (${data.repair_rating_count ?? 0} votos)`;
        setReportList((prev) =>
          prev.map((item) =>
            item.id === reportId
              ? {
                  ...item,
                  repair_rating_avg: data.repair_rating_avg,
                  repair_rating_count: data.repair_rating_count,
                }
              : item,
          ),
        );
      };

      for (let i = 1; i <= 5; i += 1) {
        const star = document.createElement('button');
        star.type = 'button';
        star.textContent = '★';
        star.style.fontSize = '16px';
        star.style.lineHeight = '1';
        star.style.padding = '4px 6px';
        star.style.borderRadius = '10px';
        star.style.border = '1px solid #f59e0b';
        star.style.background = '#fff7ed';
        star.style.cursor = 'pointer';
        star.addEventListener('click', () => submitRating(i));
        starsRow.appendChild(star);
      }

      const undoButton = document.createElement('button');
      undoButton.type = 'button';
      undoButton.textContent = 'No está reparado';
      undoButton.style.width = '100%';
      undoButton.style.padding = '6px 10px';
      undoButton.style.borderRadius = '12px';
      undoButton.style.border = '1px solid #f59e0b';
      undoButton.style.background = '#fff7ed';
      undoButton.style.color = '#9a3412';
      undoButton.style.fontSize = '11px';
      undoButton.style.fontWeight = '600';
      undoButton.style.cursor = 'pointer';
      undoButton.addEventListener('click', async () => {
        try {
          undoButton.disabled = true;
          const res = await fetch(`/api/reports/${reportId}/repair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repaired: false }),
          });
          if (!res.ok) return;
          const updated = (await res.json()) as ReportRecord;
          marker.setIcon(createMarkerIcon(resolveTypeIcon(updated.type)));
          setReportList((prev) =>
            prev.map((item) => (item.id === reportId ? updated : item)),
          );
          const refreshed = buildInfoContent(updated, marker);
          infoWindowRef.current?.setContent(refreshed);
        } finally {
          undoButton.disabled = false;
        }
      });

      ratingWrap.appendChild(ratingLabel);
      ratingWrap.appendChild(starsRow);
      ratingWrap.appendChild(summary);
      ratingWrap.appendChild(undoButton);
      wrapper.appendChild(ratingWrap);
    }

    if (isLastCreated(reportId)) {
      const deleteWrap = document.createElement('div');
      deleteWrap.style.display = 'flex';
      deleteWrap.style.justifyContent = 'flex-end';
      deleteWrap.style.marginTop = '4px';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.style.width = '36px';
      deleteButton.style.height = '36px';
      deleteButton.style.borderRadius = '999px';
      deleteButton.style.border = '1px solid #fecaca';
      deleteButton.style.background = '#fff1f2';
      deleteButton.style.display = 'inline-flex';
      deleteButton.style.alignItems = 'center';
      deleteButton.style.justifyContent = 'center';
      deleteButton.style.cursor = 'pointer';
      deleteButton.title = 'Eliminar este reporte';

      const deleteIcon = document.createElement('img');
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      deleteIcon.src = `${origin}/trash.svg`;
      deleteIcon.alt = 'Eliminar';
      deleteIcon.style.width = '18px';
      deleteIcon.style.height = '18px';
      deleteIcon.style.display = 'block';

      deleteButton.appendChild(deleteIcon);
      deleteButton.addEventListener('click', () => deleteReport(reportId));
      deleteWrap.appendChild(deleteButton);
      wrapper.appendChild(deleteWrap);
    }

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.textContent = 'Compartir';
    shareButton.style.width = '100%';
    shareButton.style.padding = '8px 12px';
    shareButton.style.borderRadius = '14px';
    shareButton.style.border = '1px solid #0f172a';
    shareButton.style.background = '#ffffff';
    shareButton.style.color = '#0f172a';
    shareButton.style.fontSize = '12px';
    shareButton.style.fontWeight = '600';
    shareButton.style.cursor = 'pointer';
    shareButton.addEventListener('click', () => {
      openShare(report, 'existing');
    });
    wrapper.appendChild(shareButton);

    if (photoUrl) {
      const img = document.createElement('img');
      img.src = photoUrl;
      img.alt = `Reporte ${type}`;
      img.style.width = '100%';
      img.style.borderRadius = '12px';
      img.style.objectFit = 'cover';
      img.style.maxHeight = '140px';
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
      icon: report.repaired
        ? showDetailedPins
          ? createRepairedIcon()
          : createDotIcon('#22c55e')
        : showDetailedPins
          ? createMarkerIcon(type)
          : createDotIcon(resolveTypeColor(report.type)),
      zIndex: 2,
    });
    marker.reportId = report.id;
    marker.reportData = report;

    marker.addListener('click', () => {
      if (!infoWindowRef.current) return;
      const content = buildInfoContent(report, marker);
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({
        map: mapInstanceRef.current,
        anchor: marker,
      });
    });

    savedMarkersRef.current.push(marker);
  }

  async function deleteReport(reportId: string) {
    const confirmDelete = window.confirm(
      '¿Eliminar el reporte que acabas de crear?',
    );
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        alert('No se pudo eliminar el reporte.');
        return;
      }
      const markerIndex = savedMarkersRef.current.findIndex(
        (marker) => marker.reportId === reportId,
      );
      if (markerIndex !== -1) {
        savedMarkersRef.current[markerIndex].setMap(null);
        savedMarkersRef.current.splice(markerIndex, 1);
      }
      setReportList((prev) => prev.filter((report) => report.id !== reportId));
      if (lastCreatedId === reportId) {
        setLastCreatedId(null);
      }
      window.localStorage.removeItem('bachejoa_last_report');
      infoWindowRef.current?.close();
    } catch {
      alert('No se pudo eliminar el reporte.');
    }
  }

  function openShare(report: ReportRecord, mode: 'new' | 'existing') {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/map?focus=${report.id}`;
    const daysAgo = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(report.created_at).getTime()) / 86400000,
      ),
    );
    if (mode === 'new') {
      setShareTitle('¿Quieres compartir tu aporte?');
      setShareText(
        `Acabo de reportar un bache en Bachejoa Map.\nEntre más lo veamos, más difícil es ignorarlo.\n👉 ${origin}`,
      );
    } else {
      setShareTitle('Este bache sigue aquí');
      setShareText(
        `Este bache ya fue reportado en Bachejoa Map.\nTiene ${
          report.angry_count ?? 0
        } me enoja y sigue sin atención.\nReportado hace ${daysAgo} días.\n\nMíralo aquí 👉 ${link}`,
      );
    }
    setShareReport(report);
    setShareMode(mode);
    setShareOpen(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AudioControls
        src="/audio/songintrofull.mp3"
        loop
        autoPlay
        className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full border-2 border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm sm:top-6 sm:left-6"
      />
      <div className="relative h-screen w-screen">
        <div className="absolute inset-0 overflow-hidden bg-white shadow-[0_30px_70px_rgba(15,23,42,0.25)]">
          <div className="absolute left-6 top-6 z-10">
            <p className="text-sm font-semibold text-slate-700">
              Navojoa, Sonora
            </p>
          </div>
          <a
            className="absolute left-4 top-24 z-10 w-20 rounded-3xl bg-white/90 px-3 py-3 shadow-[0_18px_34px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:left-6 sm:top-16 sm:w-24"
            href="/stats"
          >
            <div className="grid gap-2 text-slate-700">
              {bacheTypes.map((type) => (
                <div key={type.name} className="flex items-center gap-2">
                  <img alt={type.name} className="h-4 w-4" src={type.icon} />
                  <span className="text-[10px] font-semibold">
                    {mapSummary.counts.get(type.name) ?? 0}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <img alt="Con foto" className="h-4 w-4" src="/camera.svg" />
                <span className="text-[10px] font-semibold">
                  {mapSummary.withPhoto}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <img alt="Reparados" className="h-4 w-4" src="/reparado.svg" />
                <span className="text-[10px] font-semibold">
                  {mapSummary.repaired}
                </span>
              </div>
            </div>
          </a>
          <button
            className="absolute right-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_12px_22px_rgba(15,23,42,0.3)]"
            onClick={() => setShowAlert(true)}
            type="button"
          >
            <img alt="Avisos" className="h-7 w-7" src="/alert.png" />
            <img
              alt="Notificación"
              className="absolute -right-1 -top-1 h-5 w-5"
              src="/notif.png"
            />
          </button>

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

          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4">
            <div className="relative h-44 w-44 translate-y-3">
              <button
                className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-yellow-400 text-3xl font-semibold text-slate-900 shadow-[0_18px_30px_rgba(15,23,42,0.35)]"
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

              <button
                className="absolute left-1/2 top-0 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-[0_12px_22px_rgba(15,23,42,0.3)]"
                onClick={() => {
                  setGuideStep(0);
                  setShowGuide(true);
                }}
                type="button"
              >
                <img
                  alt="Avisos del presidente"
                  className="h-7 w-7 rounded-full"
                  src="/personajes/presi-icon.png"
                />
                <img
                  alt="Notificación"
                  className="absolute -right-1 -top-1 h-5 w-5"
                  src="/notif.png"
                />
              </button>

              <a
                className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-[0_12px_22px_rgba(15,23,42,0.3)]"
                href="/personajes"
              >
                <img
                  alt="Personajes"
                  className="h-6 w-6 object-contain"
                  src="/personajes/personajes.svg?v=2"
                />
              </a>

              <a
                className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-[0_12px_22px_rgba(15,23,42,0.3)]"
                href="/stats"
              >
                <img alt="Estadísticas" className="h-6 w-6" src="/stats.svg" />
              </a>

            </div>
          </div>
        </div>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 px-4 pb-6 sm:pb-10">
          <div className="relative w-full max-w-2xl rounded-[32px] bg-sky-200 px-6 py-5 shadow-[0_24px_50px_rgba(15,23,42,0.35)] sm:px-8 sm:py-6">
            <h2 className="text-xl font-semibold text-slate-900">El Presi</h2>
            <p className="mt-2 max-w-lg pr-32 text-sm text-slate-700 sm:mt-3 sm:pr-44">
              {guideSteps[guideStep]}
            </p>

            <div className="mt-4 flex items-center justify-between pr-32 sm:mt-6 sm:pr-36">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white disabled:opacity-40"
                disabled={guideStep === 0}
                onClick={() => setGuideStep((step) => Math.max(0, step - 1))}
                type="button"
              >
                ‹
              </button>
              <div className="flex items-center gap-2">
                {guideSteps.map((_, index) => (
                  <span
                    key={index}
                    className={`h-2 w-2 rounded-full ${
                      index === guideStep ? 'bg-slate-900' : 'bg-white/70'
                    }`}
                  />
                ))}
              </div>
              {guideStep < guideSteps.length - 1 ? (
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white"
                  onClick={() =>
                    setGuideStep((step) =>
                      Math.min(guideSteps.length - 1, step + 1),
                    )
                  }
                  type="button"
                >
                  ›
                </button>
              ) : (
                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  onClick={() => {
                    window.localStorage.setItem('bachejoa_guide_seen', 'true');
                    setShowGuide(false);
                  }}
                  type="button"
                >
                  Listo
                </button>
              )}
            </div>

            <img
              alt="El Presi"
              className="pointer-events-none absolute bottom-0 right-4 h-36 w-auto sm:right-6 sm:h-48"
              src="/personajes/presi-mid.png"
            />

            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700"
              onClick={() => {
                window.localStorage.setItem('bachejoa_guide_seen', 'true');
                setShowGuide(false);
              }}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="relative w-full max-w-md rounded-[28px] bg-white px-6 py-5 shadow-[0_24px_50px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-900">🚧 Aviso</h2>
            <p className="mt-3 text-sm text-slate-600">
              Bachejoa Map está en fase de desarrollo. Pronto habrá nuevas
              funciones y tipos de reporte.
            </p>
            <p className="mt-2 text-sm text-slate-600">Esto apenas comienza.</p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Quieres que te contactemos?
              </h3>
              <form
                className="mt-3 grid gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  const payload = {
                    name: String(formData.get('name') ?? ''),
                    contact: String(formData.get('contact') ?? ''),
                    topic: String(formData.get('topic') ?? ''),
                    message: String(formData.get('message') ?? ''),
                  };
                  try {
                    const res = await fetch('/api/contact', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    if (res.ok) {
                      form.reset();
                      alert('Gracias, te contactaremos pronto.');
                    } else {
                      alert('No se pudo enviar. Intenta de nuevo.');
                    }
                  } catch {
                    alert('No se pudo enviar. Intenta de nuevo.');
                  }
                }}
              >
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Nombre
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    placeholder="Tu nombre"
                    type="text"
                    name="name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Correo o teléfono
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    placeholder="correo@ejemplo.com / 644 000 0000"
                    type="text"
                    name="contact"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Tema
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    placeholder="Colaboración, idea, reporte..."
                    type="text"
                    name="topic"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Mensaje
                  </label>
                  <textarea
                    className="mt-1 min-h-[90px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    placeholder="Cuéntanos en qué te gustaría que te contactemos."
                    name="message"
                  />
                </div>
                <button
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  type="submit"
                >
                  Enviar
                </button>
              </form>
            </div>
            <button
              className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setShowAlert(false)}
              type="button"
            >
              Entendido
            </button>
            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              onClick={() => setShowAlert(false)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
                        const uploadRes = await fetch('/api/uploads', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            filename: photoFile.name,
                            contentType: photoFile.type,
                            size: photoFile.size,
                          }),
                        });
                        if (uploadRes.ok) {
                          const uploadData = (await uploadRes.json()) as {
                            bucket: string;
                            path: string;
                            signedUrl: string;
                            publicUrl: string | null;
                          };
                          const uploadResponse = await fetch(
                            uploadData.signedUrl,
                            {
                              method: 'PUT',
                              headers: {
                                'Content-Type':
                                  photoFile.type || 'application/octet-stream',
                              },
                              body: photoFile,
                            },
                          );
                          if (!uploadResponse.ok) {
                            alert('No se pudo subir la foto.');
                            setIsSaving(false);
                            return;
                          }
                          if (uploadData.publicUrl) {
                            formData.append('photo_url', uploadData.publicUrl);
                          }
                        } else {
                          alert('No se pudo subir la foto.');
                          setIsSaving(false);
                          return;
                        }
                      }

                      const res = await fetch('/api/reports', {
                        method: 'POST',
                        body: formData,
                      });
                      if (res.ok) {
                        const report = (await res.json()) as ReportRecord;
                        addReportMarker(report);
                        openShare(report, 'new');
                        setLastCreatedId(report.id);
                        window.localStorage.setItem(
                          'bachejoa_last_report',
                          report.id,
                        );
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

      {shareOpen && shareReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="relative w-full max-w-lg rounded-[28px] bg-white px-6 py-5 shadow-[0_24px_50px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-900">
              {shareTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {shareMode === 'new'
                ? 'Tu reporte ya está en el mapa. Si quieres, compártelo y ayuda a que más gente lo vea.'
                : 'Compártelo para que más gente lo vea y no se ignore.'}
            </p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <label className="text-xs font-semibold text-slate-600">
                Texto para compartir
              </label>
              <textarea
                className="mt-2 min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                value={shareText}
                onChange={(event) => setShareText(event.target.value)}
              />
            </div>

            {shareMode === 'existing' && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Vista previa
                </p>
                <div className="mt-3 grid gap-3">
                  {shareReport.photo_url ? (
                    <img
                      alt="Foto del bache"
                      className="h-40 w-full rounded-2xl object-cover"
                      src={shareReport.photo_url}
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-500">
                      Sin foto
                    </div>
                  )}
                  <div className="grid gap-1 text-sm text-slate-700">
                    <span>
                      📍 {shareReport.lat.toFixed(4)}, {shareReport.lng.toFixed(4)}
                    </span>
                    <span>😡 {shareReport.angry_count ?? 0} me enoja</span>
                    <span>
                      🔗{' '}
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/map?focus=${shareReport.id}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-500">
              No se comparte información personal ni datos del usuario.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {shareMode === 'new' && (
                <>
                  <button
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                    onClick={() => {
                      const origin =
                        typeof window !== 'undefined'
                          ? window.location.origin
                          : '';
                      const url = encodeURIComponent(origin);
                      window.open(
                        `https://www.facebook.com/sharer/sharer.php?u=${url}`,
                        '_blank',
                      );
                    }}
                    type="button"
                  >
                    Compartir en Facebook
                  </button>
                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                    onClick={() => {
                      const origin =
                        typeof window !== 'undefined'
                          ? window.location.origin
                          : '';
                      const text = encodeURIComponent(shareText);
                      const url = encodeURIComponent(origin);
                      window.open(
                        `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
                        '_blank',
                      );
                    }}
                    type="button"
                  >
                    Compartir en X
                  </button>
                </>
              )}
              {shareMode === 'existing' && (
                <>
                  <button
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                    onClick={() => {
                      const origin =
                        typeof window !== 'undefined'
                          ? window.location.origin
                          : '';
                      const link = `${origin}/map?focus=${shareReport.id}`;
                      const text = encodeURIComponent(shareText);
                      const url = encodeURIComponent(link);
                      window.open(
                        `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
                        '_blank',
                      );
                    }}
                    type="button"
                  >
                    Compartir
                  </button>
                </>
              )}
              <button
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                onClick={() => {
                  const origin =
                    typeof window !== 'undefined'
                      ? window.location.origin
                      : '';
                  const link =
                    shareMode === 'existing'
                      ? `${origin}/map?focus=${shareReport.id}`
                      : origin;
                  navigator.clipboard.writeText(link).catch(() => {});
                }}
                type="button"
              >
                Copiar enlace
              </button>
              {shareMode === 'existing' && (
                <button
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => {
                    const origin =
                      typeof window !== 'undefined'
                        ? window.location.origin
                        : '';
                    window.location.href = `${origin}/map?focus=${shareReport.id}`;
                  }}
                  type="button"
                >
                  Ver en el mapa
                </button>
              )}
              <button
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                onClick={() => setShareOpen(false)}
                type="button"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
