'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AudioControls from '../components/AudioControls';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  REPORT_CATEGORIES,
  REPORT_STATUS_STAGES,
  type ReportStatus,
} from '../../lib/reporting';

declare global {
  interface Window {
    google: any;
  }
}

declare const google: any;

const issueTypes = REPORT_CATEGORIES.map((category) => ({
  category: category.name,
  options: category.subcategories.map((subcategory) => ({
    name: subcategory,
    icon:
      category.name === 'Baches'
        ? subcategory === 'Grieta'
          ? '/pinesmap/pingrieta.png'
          : subcategory === 'Bache'
            ? '/pinesmap/pinbache.png'
            : subcategory === 'Bacheson'
              ? '/pinesmap/pinbache2.png'
              : '/pinesmap/pinreparacion.png'
        : category.name === 'Luminarias'
          ? subcategory === 'Fallando'
            ? '/pinesmap/luz_falla.svg'
            : '/pinesmap/luz_no.svg'
          : category.name === 'Agua'
            ? subcategory === 'Fuga de agua'
              ? '/pinesmap/agua_fuga.svg'
              : '/pinesmap/agua_no.svg'
            : category.name === 'Basura'
              ? subcategory === 'Acumulacion de basura'
                ? '/pinesmap/basura_acumulacion.svg'
                : '/pinesmap/basura_recoleccion.svg'
              : category.name === 'Drenaje'
                ? subcategory === 'Brote de aguas negras'
                  ? '/pinesmap/drenaje_brote.svg'
                  : '/pinesmap/drenaje_alcanarilla.svg'
                : null,
  })),
}));

const AVATAR_OPTIONS = ['bart.svg', 'homer.svg', 'lisa.svg', 'marge.svg'] as const;

type LatLngLiteral = { lat: number; lng: number };
type ReportRecord = {
  id: string;
  lat: number;
  lng: number;
  type: string;
  category?: string | null;
  subcategory?: string | null;
  status?: ReportStatus | null;
  photo_url: string | null;
  created_at: string;
  angry_count: number | null;
  repaired?: boolean | null;
  repaired_at?: string | null;
  repair_rating_avg?: number | null;
  repair_rating_count?: number | null;
};

type AccountReport = {
  id: string;
  created_at: string;
  lat: number;
  lng: number;
  category: string | null;
  subcategory: string | null;
  status: string | null;
  photo_url: string | null;
  angry_count: number | null;
  repaired: boolean | null;
  repaired_at: string | null;
};

type GamificationMetrics = {
  totalReports: number;
  validReports: number;
  withPhoto: number;
  verifiedByStatus: number;
  changedStatusCount: number;
  repairedFromUser: number;
  distinctZones: number;
  bachesonCount: number;
  strongEvidenceCount: number;
  earlyActionCount: number;
};

const GAMIFICATION_LEVELS = [
  { name: 'Nivel 1 · Observador', min: 0 },
  { name: 'Nivel 2 · Vecino Activo', min: 60 },
  { name: 'Nivel 3 · Reportero Urbano', min: 150 },
  { name: 'Nivel 4 · Auditor Ciudadano', min: 280 },
  { name: 'Nivel 5 · Agente Cívico', min: 430 },
  { name: 'Nivel 6 · Leyenda Bachejoa', min: 650 },
];

const GAMIFICATION_MEDALS = [
  {
    id: 'first-report',
    title: '🧱 Primer Reporte',
    points: 10,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.validReports,
  },
  {
    id: 'vecino-atento',
    title: '🧱 Vecino Atento',
    points: 20,
    threshold: 5,
    metric: (m: GamificationMetrics) => m.validReports,
  },
  {
    id: 'testigo-visual',
    title: '📸 Testigo Visual',
    points: 15,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.withPhoto,
  },
  {
    id: 'detectado',
    title: '🔎 Detectado',
    points: 20,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.changedStatusCount,
  },
  {
    id: 'ya-quedo',
    title: '🔎 Ya Quedó',
    points: 30,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.repairedFromUser,
  },
  {
    id: 'recorredor-colonias',
    title: '🗺️ Recorredor de Colonias',
    points: 25,
    threshold: 3,
    metric: (m: GamificationMetrics) => m.distinctZones,
  },
  {
    id: 'esquivador',
    title: '😏 Esquivador Profesional',
    points: 25,
    threshold: 10,
    metric: (m: GamificationMetrics) => m.totalReports,
  },
  {
    id: 'era-crater',
    title: '😏 Esto Ya Era Cráter',
    points: 25,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.bachesonCount,
  },
  {
    id: 'no-era-charco',
    title: '😏 No Era Charco',
    points: 30,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.strongEvidenceCount,
  },
  {
    id: 'lo-vi-lo-marque',
    title: '😏 Lo Vi, Lo Marqué',
    points: 20,
    threshold: 1,
    metric: (m: GamificationMetrics) => m.earlyActionCount,
  },
];

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

function getCategoryColor(category: string | null | undefined) {
  switch (category) {
    case 'Baches':
      return '#f97316';
    case 'Luminarias':
      return '#facc15';
    case 'Agua':
      return '#06b6d4';
    case 'Basura':
      return '#22c55e';
    case 'Drenaje':
      return '#6366f1';
    default:
      return '#64748b';
  }
}

function getCategoryEmoji(category: string) {
  switch (category) {
    case 'Baches':
      return '🕳️';
    case 'Luminarias':
      return '💡';
    case 'Agua':
      return '🚰';
    case 'Basura':
      return '🗑️';
    case 'Drenaje':
      return '🤮';
    default:
      return '📍';
  }
}

function createRepairedIcon() {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="22" fill="#dcfce7" stroke="#16a34a" stroke-width="3" />
      <text x="26" y="32" text-anchor="middle" font-size="22">🔧</text>
    </svg>`,
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
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

function resolveTypeColor(typeName: string, category?: string | null) {
  if (category && category !== 'Baches') {
    return getCategoryColor(category);
  }
  switch (typeName) {
    case 'Grieta':
      return '#38bdf8';
    case 'Bache':
      return '#f97316';
    case 'Bacheson':
      return '#ef4444';
    case 'Reparacion inconclusa':
      return '#eab308';
    default:
      return '#64748b';
  }
}

type PinStageFilter =
  | 'all'
  | 'Reportado'
  | 'Verificado (con foto)'
  | 'Reparado';

function createGlowIcon(
  type: { name: string; icon: string | null },
  color: string,
) {
  if (!type.icon) {
    return createDotIcon(color);
  }
  return {
    url: type.icon,
    scaledSize: new google.maps.Size(60, 60),
    anchor: new google.maps.Point(30, 60),
  };
}

function normalizeFilterValue(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function zoneKey(lat: number, lng: number) {
  return `${lat.toFixed(2)}|${lng.toFixed(2)}`;
}

function buildGamificationMetrics(
  reports: AccountReport[],
  createdAt?: string,
): GamificationMetrics {
  const totalReports = reports.length;
  const validReports = reports.filter((r) => r.status !== 'Archivado').length;
  const withPhoto = reports.filter((r) => Boolean(r.photo_url)).length;
  const verifiedByStatus = reports.filter((r) => r.status === 'Verificado').length;
  const changedStatusCount = reports.filter(
    (r) => r.status && !['Creado', 'Visible'].includes(r.status),
  ).length;
  const repairedFromUser = reports.filter(
    (r) => r.status === 'Reparado' || r.repaired,
  ).length;
  const distinctZones = new Set(reports.map((r) => zoneKey(r.lat, r.lng))).size;
  const bachesonCount = reports.filter(
    (r) => (r.subcategory ?? '').toLowerCase() === 'bacheson',
  ).length;
  const strongEvidenceCount = reports.filter(
    (r) => Boolean(r.photo_url) && (r.angry_count ?? 0) >= 3,
  ).length;
  const createdMs = new Date(createdAt ?? 0).getTime();
  const earlyActionCount = reports.filter((r) => {
    if (!createdMs) return false;
    return new Date(r.created_at).getTime() <= createdMs + 24 * 60 * 60 * 1000;
  }).length;

  return {
    totalReports,
    validReports,
    withPhoto,
    verifiedByStatus,
    changedStatusCount,
    repairedFromUser,
    distinctZones,
    bachesonCount,
    strongEvidenceCount,
    earlyActionCount,
  };
}

async function ensureWebCompatiblePhoto(file: File) {
  const lowerName = file.name.toLowerCase();
  const isHeicLike =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif');

  if (!isHeicLike) return file;

  const heic2anyModule = await import('heic2any');
  const converter = heic2anyModule.default as (input: {
    blob: Blob;
    toType: string;
    quality: number;
  }) => Promise<Blob | Blob[]>;

  const converted = await converter({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.88,
  });
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
  const jpegName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([jpegBlob], jpegName, {
    type: 'image/jpeg',
  });
}

export default function MapClient() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const tempGlowRef = useRef<any>(null);
  const savedMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const focusedRef = useRef(false);
  const [newPin, setNewPin] = useState<LatLngLiteral | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    issueTypes[0]?.category ?? 'Baches',
  );
  const [selectedType, setSelectedType] = useState<string>(
    issueTypes[0]?.options[0]?.name ?? 'Bache',
  );
  const [selectedStageFilter, setSelectedStageFilter] =
    useState<PinStageFilter>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    'all' | string
  >('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | string>(
    'all',
  );
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
  const [showFollow, setShowFollow] = useState(false);
  const [dontShowFollow, setDontShowFollow] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [accountPromptOpen, setAccountPromptOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    email: string;
    role?: 'citizen' | 'admin';
    avatar_key?: string;
    created_at?: string;
  } | null>(null);
  const [currentStats, setCurrentStats] = useState<{
    reports_total: number;
    reports_verified: number;
  } | null>(null);
  const [progressNotice, setProgressNotice] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const currentUserRef = useRef<{
    id: string;
    username: string;
    email: string;
    role?: 'citizen' | 'admin';
    avatar_key?: string;
    created_at?: string;
  } | null>(null);
  const canModerateRef = useRef(false);
  const progressNoticeTimerRef = useRef<number | null>(null);
  const searchParams = useSearchParams();
  const [showDetailedPins, setShowDetailedPins] = useState(false);
  const canModerateReports = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin';
  }, [currentUser]);

  function pushProgressNotice(title: string, detail: string) {
    setProgressNotice({ title, detail });
    if (progressNoticeTimerRef.current) {
      window.clearTimeout(progressNoticeTimerRef.current);
    }
    progressNoticeTimerRef.current = window.setTimeout(() => {
      setProgressNotice(null);
      progressNoticeTimerRef.current = null;
    }, 5200);
  }

  async function evaluateProgressNotice() {
    if (!currentUserRef.current) return;
    try {
      const res = await fetch('/api/account');
      if (!res.ok) return;
      const payload = (await res.json()) as {
        user?: {
          id: string;
          created_at?: string;
        };
        reports?: AccountReport[];
      };
      if (!payload.user?.id || !payload.reports) return;

      const metrics = buildGamificationMetrics(
        payload.reports,
        payload.user.created_at,
      );
      const earned = GAMIFICATION_MEDALS.filter(
        (medal) => medal.metric(metrics) >= medal.threshold,
      );
      const score = earned.reduce((sum, medal) => sum + medal.points, 0);
      const level =
        [...GAMIFICATION_LEVELS].reverse().find((item) => score >= item.min) ??
        GAMIFICATION_LEVELS[0];

      const key = `bachejoa_progress_${payload.user.id}`;
      const rawPrev = window.localStorage.getItem(key);
      const prev = rawPrev
        ? (JSON.parse(rawPrev) as {
            earnedIds: string[];
            levelName: string;
          })
        : null;

      const currentState = {
        earnedIds: earned.map((item) => item.id),
        levelName: level.name,
      };
      window.localStorage.setItem(key, JSON.stringify(currentState));

      if (!prev) return;

      const newEarned = earned.filter((item) => !prev.earnedIds.includes(item.id));
      const leveledUp = prev.levelName !== level.name;

      if (newEarned.length > 0) {
        pushProgressNotice(
          'Nuevo premio desbloqueado',
          `${newEarned[0].title} (+${newEarned[0].points} pts)`,
        );
        return;
      }

      if (leveledUp) {
        pushProgressNotice('Subiste de nivel', level.name);
      }
    } catch {
      // ignore
    }
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const payload = (await res.json()) as {
        user: {
          id: string;
          username: string;
          email: string;
          role?: 'citizen' | 'admin';
          avatar_key?: string;
          created_at?: string;
        } | null;
        stats: { reports_total: number; reports_verified: number } | null;
      };
      setCurrentUser(payload.user ?? null);
      setCurrentStats(payload.stats ?? null);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    currentUserRef.current = currentUser;
    canModerateRef.current = canModerateReports;
  }, [currentUser, canModerateReports]);

  useEffect(() => {
    if (!currentUser?.id) return;
    evaluateProgressNotice();
  }, [currentUser?.id]);

  useEffect(() => {
    return () => {
      if (progressNoticeTimerRef.current) {
        window.clearTimeout(progressNoticeTimerRef.current);
      }
    };
  }, []);

  const mapSummary = useMemo(() => {
    const counts = new Map<string, number>();
    REPORT_CATEGORIES.forEach((type) => counts.set(type.name, 0));
    let withPhoto = 0;
    let repaired = 0;
    reportList.forEach((report) => {
      const key = report.category ?? 'Baches';
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (report.photo_url) withPhoto += 1;
      if (report.status === 'Reparado' || report.repaired) repaired += 1;
    });
    return { counts, withPhoto, repaired };
  }, [reportList]);

  const guideSteps = [
    '👋 Bienvenido. Aquí te enseño cómo reportar incidencias urbanas y ayudar a mejorar Navojoa.',
    '🗺️ Muévete por el mapa hasta encontrar la incidencia que quieres reportar.',
    '📍 Toca exactamente donde está el problema. Entre más preciso, mejor atención.',
    '🛠️ Elige categoría y subtipo: baches, luminarias, agua, basura o drenaje.',
    '📸 Si puedes, sube una foto. No es obligatorio, pero ayuda a verificar el reporte.',
    '✅ Presiona REPORTAR y listo. Ya hiciste más que muchos 😏',
  ];

  const activeType = useMemo(
    () =>
      issueTypes
        .find((category) => category.category === selectedCategory)
        ?.options.find((type) => type.name === selectedType),
    [selectedCategory, selectedType],
  );
  const subcategoryOptions = useMemo(
    () =>
      issueTypes.find((category) => category.category === selectedCategory)
        ?.options ?? [],
    [selectedCategory],
  );

  const filteredReports = useMemo(() => {
    function matchesStage(report: ReportRecord) {
      const isRepaired = report.status === 'Reparado' || report.repaired;
      if (selectedStageFilter === 'all') return true;
      if (selectedStageFilter === 'Reparado') return Boolean(isRepaired);
      if (selectedStageFilter === 'Reportado') return !isRepaired;
      if (selectedStageFilter === 'Verificado (con foto)') {
        return Boolean(report.photo_url) && !isRepaired;
      }
      return true;
    }

    return reportList.filter((report) => {
      const category = report.category ?? 'Baches';
      const type = report.subcategory ?? report.type;
      if (
        selectedCategoryFilter !== 'all' &&
        normalizeFilterValue(category) !== normalizeFilterValue(selectedCategoryFilter)
      ) {
        return false;
      }
      if (
        selectedTypeFilter !== 'all' &&
        normalizeFilterValue(type) !== normalizeFilterValue(selectedTypeFilter)
      ) {
        return false;
      }
      if (!matchesStage(report)) {
        return false;
      }
      return true;
    });
  }, [reportList, selectedCategoryFilter, selectedStageFilter, selectedTypeFilter]);

  const filterTypeOptions = useMemo<string[]>(() => {
    if (selectedCategoryFilter === 'all') {
      return Array.from(
        new Set(issueTypes.flatMap((group) => group.options.map((item) => item.name))),
      );
    }
    return (
      issueTypes.find((group) => group.category === selectedCategoryFilter)?.options.map(
        (item) => item.name,
      ) ?? []
    );
  }, [selectedCategoryFilter]);

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
        clustererRef.current = new MarkerClusterer({
          map,
          markers: [],
        });
        setMapReady(true);
        setShowDetailedPins(map.getZoom() >= 16);

        map.addListener('click', (event: any) => {
          if (!event.latLng) return;
          const pos = event.latLng.toJSON();
          setNewPin(pos);
          setIsDialogOpen(true);
        });

        map.addListener('zoom_changed', () => {
          const zoom = map.getZoom() ?? 0;
          const detailed = zoom >= 16;
          setShowDetailedPins(detailed);
          savedMarkersRef.current.forEach((marker) => {
            const report: ReportRecord | undefined = marker.reportData;
            if (!report) return;
            if (report.status === 'Reparado' || report.repaired) {
              marker.setIcon(
                detailed ? createRepairedIcon() : createDotIcon('#22c55e'),
              );
              return;
            }
            if (detailed) {
              const type = resolveTypeIcon(report.type);
              marker.setIcon(
                type.icon
                  ? createMarkerIcon({ name: type.name, icon: type.icon })
                  : createDotIcon(resolveTypeColor(report.type, report.category)),
              );
            } else {
              marker.setIcon(
                createDotIcon(resolveTypeColor(report.type, report.category)),
              );
            }
          });
          clustererRef.current?.render();
        });
      })
      .catch(() => {
        setMapReady(false);
      });
  }, []);

  useEffect(() => {
    if (subcategoryOptions.some((option) => option.name === selectedType)) return;
    if (subcategoryOptions[0]) {
      setSelectedType(subcategoryOptions[0].name);
    }
  }, [selectedType, subcategoryOptions]);

  useEffect(() => {
    if (selectedTypeFilter === 'all') return;
    if (filterTypeOptions.includes(selectedTypeFilter)) return;
    setSelectedTypeFilter('all');
  }, [filterTypeOptions, selectedTypeFilter]);

  useEffect(() => {
    setSelectedTypeFilter('all');
  }, [selectedCategoryFilter]);

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
    const hideFollow = window.localStorage.getItem('bachejoa_follow_hide');
    if (!hideFollow) {
      setTimeout(() => setShowFollow(true), 800);
    }

    fetchCurrentUser();
  }, []);

  function isLastCreated(reportId: string) {
    if (reportId === lastCreatedId) return true;
    try {
      return window.localStorage.getItem('bachejoa_last_report') === reportId;
    } catch {
      return false;
    }
  }

  function normalizeReport(record: ReportRecord) {
    const category = record.category ?? 'Baches';
    const rawType = (record.subcategory ?? record.type ?? '').trim();
    const canonicalMap: Record<string, string> = {
      'Pequeña grieta': 'Grieta',
      Bachesón: 'Bacheson',
      'Reparación inconclusa': 'Reparacion inconclusa',
      Falla: 'Fallando',
      'Falta de agua': 'No hay agua',
      'Aguas negras': 'Brote de aguas negras',
      'Drenaje colapsado': 'Brote de aguas negras',
      'Alcantarilla abierta': 'Alcantarilla destapada',
      'Acumulación de basura': 'Acumulacion de basura',
      'No ha pasado recolección': 'No paso recoleccion',
    };
    const subcategory = canonicalMap[rawType] ?? rawType;
    const status = (record.status ??
      (record.repaired ? 'Reparado' : 'Visible')) as ReportStatus;
    return {
      ...record,
      type: subcategory,
      category,
      subcategory,
      status,
      repaired: status === 'Reparado',
    };
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
        const chunk = (payload.data ?? []).map((item) => normalizeReport(item));
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
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    savedMarkersRef.current.forEach((marker) => marker.setMap(null));
    savedMarkersRef.current = [];
    clustererRef.current?.clearMarkers();
    filteredReports.forEach((report) => addReportMarker(report));
  }, [filteredReports, mapReady, showDetailedPins]);

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
        icon: createGlowIcon(activeType, getCategoryColor(selectedCategory)),
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

    tempMarkerRef.current.setIcon(
      createGlowIcon(activeType, getCategoryColor(selectedCategory)),
    );
    tempMarkerRef.current.setPosition(newPin);
    if (tempGlowRef.current) {
      tempGlowRef.current.setPosition(newPin);
    }
  }, [newPin, activeType, selectedCategory]);

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
    const loggedInUser = currentUserRef.current;
    const canModerate = canModerateRef.current;
    const normalizedReport = normalizeReport(report);
    const {
      id: reportId,
      type,
      category,
      status,
      photo_url: photoUrl,
      angry_count: angryCount,
      repaired,
      repair_rating_avg: ratingAvg,
      repair_rating_count: ratingCount,
    } = normalizedReport;
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
    title.textContent = `${category} · ${type}`;
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

    const statusPill = document.createElement('span');
    statusPill.textContent = status;
    statusPill.style.width = 'fit-content';
    statusPill.style.padding = '2px 8px';
    statusPill.style.borderRadius = '999px';
    statusPill.style.background = '#e2e8f0';
    statusPill.style.fontSize = '11px';
    statusPill.style.color = '#334155';

    header.appendChild(title);
    header.appendChild(dateEl);
    header.appendChild(statusPill);
    wrapper.appendChild(header);

    if (canModerate) {
      const statusRow = document.createElement('div');
      statusRow.style.display = 'grid';
      statusRow.style.gap = '6px';

      const statusLabel = document.createElement('label');
      statusLabel.textContent = 'Etapa del reporte';
      statusLabel.style.fontSize = '11px';
      statusLabel.style.color = '#64748b';

      const statusSelect = document.createElement('select');
      statusSelect.style.width = '100%';
      statusSelect.style.padding = '6px 10px';
      statusSelect.style.borderRadius = '10px';
      statusSelect.style.border = '1px solid #cbd5e1';
      statusSelect.style.fontSize = '12px';
      statusSelect.style.background = '#ffffff';
      REPORT_STATUS_STAGES.forEach((stage) => {
        const option = document.createElement('option');
        option.value = stage;
        option.textContent = stage;
        option.selected = stage === status;
        statusSelect.appendChild(option);
      });
      statusSelect.addEventListener('change', async () => {
        try {
          statusSelect.disabled = true;
          const res = await fetch(`/api/reports/${reportId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: statusSelect.value }),
          });
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            alert(payload.error ?? 'No se pudo cambiar la etapa.');
            return;
          }
          const updatedRaw = (await res.json()) as ReportRecord;
          const updated = normalizeReport(updatedRaw);
          setReportList((prev) =>
            prev.map((item) => (item.id === reportId ? updated : item)),
          );
          const refreshed = buildInfoContent(updated, marker);
          infoWindowRef.current?.setContent(refreshed);
        } finally {
          statusSelect.disabled = false;
        }
      });
      statusRow.appendChild(statusLabel);
      statusRow.appendChild(statusSelect);
      wrapper.appendChild(statusRow);

      const typeRow = document.createElement('div');
      typeRow.style.display = 'grid';
      typeRow.style.gap = '6px';

      const typeLabel = document.createElement('label');
      typeLabel.textContent = 'Categoría y tipo';
      typeLabel.style.fontSize = '11px';
      typeLabel.style.color = '#64748b';

      const categorySelect = document.createElement('select');
      categorySelect.style.width = '100%';
      categorySelect.style.padding = '6px 10px';
      categorySelect.style.borderRadius = '10px';
      categorySelect.style.border = '1px solid #cbd5e1';
      categorySelect.style.fontSize = '12px';
      categorySelect.style.background = '#ffffff';

      const subcategorySelect = document.createElement('select');
      subcategorySelect.style.width = '100%';
      subcategorySelect.style.padding = '6px 10px';
      subcategorySelect.style.borderRadius = '10px';
      subcategorySelect.style.border = '1px solid #cbd5e1';
      subcategorySelect.style.fontSize = '12px';
      subcategorySelect.style.background = '#ffffff';

      REPORT_CATEGORIES.forEach((categoryOption) => {
        const option = document.createElement('option');
        option.value = categoryOption.name;
        option.textContent = categoryOption.name;
        option.selected = categoryOption.name === category;
        categorySelect.appendChild(option);
      });

      const renderSubcategories = (categoryName: string, selectedType: string) => {
        subcategorySelect.innerHTML = '';
        const group = REPORT_CATEGORIES.find((item) => item.name === categoryName);
        (group?.subcategories ?? []).forEach((subtype) => {
          const option = document.createElement('option');
          option.value = subtype;
          option.textContent = subtype;
          option.selected = subtype === selectedType;
          subcategorySelect.appendChild(option);
        });
      };

      renderSubcategories(category ?? 'Baches', type);
      categorySelect.addEventListener('change', () => {
        const fallbackGroup = REPORT_CATEGORIES.find(
          (item) => item.name === categorySelect.value,
        );
        renderSubcategories(
          categorySelect.value,
          fallbackGroup?.subcategories[0] ?? '',
        );
      });

      const saveTypeButton = document.createElement('button');
      saveTypeButton.type = 'button';
      saveTypeButton.textContent = 'Guardar tipo';
      saveTypeButton.style.width = '100%';
      saveTypeButton.style.padding = '7px 10px';
      saveTypeButton.style.borderRadius = '12px';
      saveTypeButton.style.border = '1px solid #0f172a';
      saveTypeButton.style.background = '#ffffff';
      saveTypeButton.style.color = '#0f172a';
      saveTypeButton.style.fontSize = '11px';
      saveTypeButton.style.fontWeight = '700';
      saveTypeButton.style.cursor = 'pointer';
      saveTypeButton.addEventListener('click', async () => {
        try {
          saveTypeButton.disabled = true;
          const res = await fetch(`/api/reports/${reportId}/type`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: categorySelect.value,
              subcategory: subcategorySelect.value,
            }),
          });
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            alert(payload.error ?? 'No se pudo cambiar el tipo.');
            return;
          }
          const updated = normalizeReport((await res.json()) as ReportRecord);
          marker.reportData = updated;
          const iconType = resolveTypeIcon(updated.type);
          const isRepaired = updated.status === 'Reparado' || updated.repaired;
          if (isRepaired) {
            marker.setIcon(showDetailedPins ? createRepairedIcon() : createDotIcon('#22c55e'));
          } else if (showDetailedPins && iconType.icon) {
            marker.setIcon(createMarkerIcon({ name: iconType.name, icon: iconType.icon }));
          } else {
            marker.setIcon(
              createDotIcon(resolveTypeColor(updated.type, updated.category)),
            );
          }
          setReportList((prev) =>
            prev.map((item) => (item.id === reportId ? updated : item)),
          );
          const refreshed = buildInfoContent(updated, marker);
          infoWindowRef.current?.setContent(refreshed);
        } finally {
          saveTypeButton.disabled = false;
        }
      });

      typeRow.appendChild(typeLabel);
      typeRow.appendChild(categorySelect);
      typeRow.appendChild(subcategorySelect);
      typeRow.appendChild(saveTypeButton);
      wrapper.appendChild(typeRow);
    }

    if (!repaired && status !== 'Archivado') {
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

      if (canModerate) {
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
            if (!res.ok) {
              const payload = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              alert(payload.error ?? 'No se pudo actualizar el reporte.');
              return;
            }
            const updated = normalizeReport((await res.json()) as ReportRecord);
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
      }
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
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            alert(payload.error ?? 'No se pudo actualizar el reporte.');
            return;
          }
          const updated = normalizeReport((await res.json()) as ReportRecord);
          const iconType = resolveTypeIcon(updated.type);
          marker.setIcon(
            iconType.icon
              ? createMarkerIcon({ name: iconType.name, icon: iconType.icon })
              : createDotIcon(resolveTypeColor(updated.type, updated.category)),
          );
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
      if (canModerate) {
        ratingWrap.appendChild(undoButton);
      }
      wrapper.appendChild(ratingWrap);
    }

    if (canModerate || isLastCreated(reportId)) {
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
      openShare(normalizedReport, 'existing');
    });
    wrapper.appendChild(shareButton);

    if (loggedInUser) {
      const photoAction = document.createElement('div');
      photoAction.style.display = 'flex';
      photoAction.style.justifyContent = 'flex-end';

      const addPhotoButton = document.createElement('button');
      addPhotoButton.type = 'button';
      addPhotoButton.textContent = '+';
      addPhotoButton.title = 'Agregar foto';
      addPhotoButton.style.width = '34px';
      addPhotoButton.style.height = '34px';
      addPhotoButton.style.borderRadius = '10px';
      addPhotoButton.style.border = '1px solid #0f172a';
      addPhotoButton.style.background = '#ffffff';
      addPhotoButton.style.color = '#0f172a';
      addPhotoButton.style.fontSize = '22px';
      addPhotoButton.style.lineHeight = '1';
      addPhotoButton.style.fontWeight = '700';
      addPhotoButton.style.cursor = 'pointer';

      addPhotoButton.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            addPhotoButton.disabled = true;
            addPhotoButton.textContent = '...';
            let uploadFile = file;
            try {
              uploadFile = await ensureWebCompatiblePhoto(file);
            } catch {
              alert('No se pudo convertir la foto HEIC.');
              return;
            }

            const uploadRes = await fetch('/api/uploads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: uploadFile.name,
                contentType: uploadFile.type,
                size: uploadFile.size,
              }),
            });
            if (!uploadRes.ok) {
              const payload = (await uploadRes.json().catch(() => ({}))) as {
                error?: string;
              };
              alert(payload.error ?? 'No se pudo subir la foto.');
              return;
            }
            const uploadData = (await uploadRes.json()) as {
              signedUrl: string;
              publicUrl: string | null;
            };
            const putRes = await fetch(uploadData.signedUrl, {
              method: 'PUT',
              headers: {
                'Content-Type':
                  uploadFile.type || 'application/octet-stream',
              },
              body: uploadFile,
            });
            if (!putRes.ok || !uploadData.publicUrl) {
              alert('No se pudo subir la foto.');
              return;
            }

            const saveRes = await fetch(`/api/reports/${reportId}/photo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ photo_url: uploadData.publicUrl }),
            });
            if (!saveRes.ok) {
              const payload = (await saveRes.json().catch(() => ({}))) as {
                error?: string;
              };
              alert(payload.error ?? 'No se pudo guardar la foto.');
              return;
            }
            const updated = normalizeReport((await saveRes.json()) as ReportRecord);
            marker.reportData = updated;
            setReportList((prev) =>
              prev.map((item) => (item.id === reportId ? updated : item)),
            );
            const refreshed = buildInfoContent(updated, marker);
            infoWindowRef.current?.setContent(refreshed);
            void evaluateProgressNotice();
          } finally {
            addPhotoButton.disabled = false;
            addPhotoButton.textContent = '+';
          }
        };
        input.click();
      });

      photoAction.appendChild(addPhotoButton);
      wrapper.appendChild(photoAction);
    }

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
    for (const group of issueTypes) {
      const found = group.options.find((type) => type.name === typeName);
      if (found) {
        return found;
      }
    }
    return issueTypes[0]?.options[0] ?? { name: 'Bache', icon: null };
  }

  function addReportMarker(report: ReportRecord) {
    if (!mapInstanceRef.current) return;
    const normalized = normalizeReport(report);
    const type = resolveTypeIcon(normalized.type);
    const isRepaired = normalized.status === 'Reparado' || normalized.repaired;
    const color = resolveTypeColor(normalized.type, normalized.category);
    const marker = new google.maps.Marker({
      position: { lat: normalized.lat, lng: normalized.lng },
      draggable: false,
      icon: isRepaired
        ? showDetailedPins
          ? createRepairedIcon()
          : createDotIcon('#22c55e')
        : showDetailedPins
          ? type.icon
            ? createMarkerIcon({ name: type.name, icon: type.icon })
            : createDotIcon(color)
          : createDotIcon(color),
      zIndex: 2,
    });
    marker.reportId = normalized.id;
    marker.reportData = normalized;

    marker.addListener('click', () => {
      if (!infoWindowRef.current) return;
      const content = buildInfoContent(normalized, marker);
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({
        map: mapInstanceRef.current,
        anchor: marker,
      });
    });

    savedMarkersRef.current.push(marker);
    clustererRef.current?.addMarker(marker, true);
  }

  async function deleteReport(reportId: string) {
    const confirmDelete = window.confirm('¿Eliminar este reporte?');
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
    const normalized = normalizeReport(report);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/map?focus=${normalized.id}`;
    const daysAgo = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(report.created_at).getTime()) / 86400000,
      ),
    );
    if (mode === 'new') {
      setShareTitle('¿Quieres compartir tu aporte?');
      setShareText(
        `Acabo de reportar ${normalized.subcategory?.toLowerCase()} en Bachejoa.\nEntre más lo veamos, más difícil es ignorarlo.\n👉 ${origin}`,
      );
    } else {
      setShareTitle('Este reporte sigue sin resolverse');
      setShareText(
        `Este problema urbano ya fue reportado en Bachejoa.\nTiene ${
          normalized.angry_count ?? 0
        } me enoja y sigue sin atención.\nReportado hace ${daysAgo} días.\n\nMíralo aquí 👉 ${link}`,
      );
    }
    setShareReport(normalized);
    setShareMode(mode);
    setShareOpen(true);
  }

  async function submitAuth() {
    setAuthLoading(true);
    setAuthError('');
    setAuthNotice('');
    try {
      const endpoint =
        authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        authMode === 'register'
          ? {
              username: authUsername,
              email: authEmail,
              password: authPassword,
            }
          : {
              identifier: authEmail,
              password: authPassword,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: {
          id: string;
          username: string;
          email: string;
          role?: 'citizen' | 'admin';
          avatar_key?: string;
          created_at?: string;
        };
      };
      if (!res.ok || !data.user) {
        setAuthError(data.error ?? 'No se pudo procesar la cuenta.');
        return;
      }
      setCurrentUser(data.user);
      await fetchCurrentUser();
      setAuthPassword('');
      setAuthError('');
      setAuthNotice('Cuenta lista. Ya puedes seguir reportando.');
    } catch {
      setAuthError('No se pudo procesar la cuenta.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function updateAvatar(avatarKey: string) {
    if (!currentUser) return;
    setIsUpdatingAvatar(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_key: avatarKey }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: {
          id: string;
          username: string;
          email: string;
          role?: 'citizen' | 'admin';
          avatar_key?: string;
          created_at?: string;
        };
      };
      if (!res.ok || !payload.user) {
        setAuthError(payload.error ?? 'No se pudo actualizar el avatar.');
        return;
      }
      setCurrentUser(payload.user);
      setAuthNotice('Avatar actualizado.');
    } finally {
      setIsUpdatingAvatar(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AudioControls
        src="/audio/songintrofull.mp3"
        loop
        autoPlay
        className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full border-2 border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm sm:top-6 sm:left-6"
      />
      {progressNotice && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-30 w-[92vw] max-w-sm -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-slate-800 shadow-[0_16px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Progreso ciudadano
          </p>
          <p className="mt-1 text-sm font-semibold">{progressNotice.title}</p>
          <p className="text-sm text-slate-700">{progressNotice.detail}</p>
        </div>
      )}
      <div className="relative h-screen w-screen">
        <div className="absolute inset-0 overflow-hidden bg-white shadow-[0_30px_70px_rgba(15,23,42,0.25)]">
          <div className="absolute left-6 top-6 z-10">
            <p className="text-sm font-semibold text-slate-700">
              Navojoa, Sonora
            </p>
            <p className="text-xs text-slate-500">
              Plataforma ciudadana de reportes urbanos
            </p>
          </div>
          <a
            className="absolute left-4 top-24 z-10 w-20 rounded-3xl bg-white/90 px-2 py-2 shadow-[0_18px_34px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:left-6 sm:top-20 sm:w-24"
            href="/stats"
          >
            <div className="grid gap-2 text-slate-700">
              {REPORT_CATEGORIES.map((type) => (
                <div key={type.name} className="flex items-center gap-2">
                  <span className="text-xs leading-none">
                    {getCategoryEmoji(type.name)}
                  </span>
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
                <span className="text-xs leading-none">🔧</span>
                <span className="text-[10px] font-semibold">
                  {mapSummary.repaired}
                </span>
              </div>
            </div>
          </a>
          <button
            className="absolute left-4 top-[262px] z-10 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-[0_18px_34px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:left-6 sm:top-[292px]"
            onClick={() => setIsFilterOpen((open) => !open)}
            type="button"
          >
            {isFilterOpen ? 'Cerrar filtros' : 'Filtrar'}
          </button>
          {isFilterOpen && (
            <div className="absolute left-4 top-[304px] z-10 w-48 rounded-2xl bg-white/90 px-3 py-3 shadow-[0_18px_34px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:left-6 sm:top-[336px] sm:w-56">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Filtros de pines
              </p>
              <div className="mt-2 grid gap-2">
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  value={selectedCategoryFilter}
                  onChange={(event) => setSelectedCategoryFilter(event.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  {REPORT_CATEGORIES.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  value={selectedTypeFilter}
                  onChange={(event) => setSelectedTypeFilter(event.target.value)}
                >
                  <option value="all">Todos los tipos</option>
                  {filterTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  value={selectedStageFilter}
                  onChange={(event) =>
                    setSelectedStageFilter(event.target.value as PinStageFilter)
                  }
                >
                  <option value="all">Todas las etapas</option>
                  <option value="Reportado">Reportado</option>
                  <option value="Verificado (con foto)">Verificado (con foto)</option>
                  <option value="Reparado">Reparado</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Mostrando {filteredReports.length} de {reportList.length}
                </p>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => {
                    setSelectedCategoryFilter('all');
                    setSelectedTypeFilter('all');
                    setSelectedStageFilter('all');
                  }}
                  type="button"
                >
                  Resetear filtros
                </button>
              </div>
            </div>
          )}
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
          <button
            className="absolute right-20 top-6 z-10 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-[0_12px_22px_rgba(15,23,42,0.3)]"
            onClick={() => setAccountPromptOpen(true)}
            type="button"
          >
            {currentUser ? `@${currentUser.username}` : 'Crear cuenta'}
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
                  Tipo de reporte urbano
                </p>
                <p className="text-xs text-slate-600">
                  Arrastra el pin y selecciona categoría y subtipo.
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
                      formData.append('category', selectedCategory);
                      formData.append('subcategory', selectedType);
                      formData.append('type', activeType.name);

                      if (photoFile) {
                        let uploadFile = photoFile;
                        try {
                          uploadFile = await ensureWebCompatiblePhoto(photoFile);
                        } catch {
                          alert('No se pudo convertir la foto HEIC.');
                          setIsSaving(false);
                          return;
                        }

                        const uploadRes = await fetch('/api/uploads', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            filename: uploadFile.name,
                            contentType: uploadFile.type,
                            size: uploadFile.size,
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
                                  uploadFile.type || 'application/octet-stream',
                              },
                              body: uploadFile,
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
                        const report = normalizeReport(
                          (await res.json()) as ReportRecord,
                        );
                        setReportList((prev) => [report, ...prev]);
                        openShare(report, 'new');
                        setLastCreatedId(report.id);
                        window.localStorage.setItem(
                          'bachejoa_last_report',
                          report.id,
                        );
                        void evaluateProgressNotice();
                      } else {
                        const payload = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          code?: string;
                        };
                        if (payload.code === 'ANON_LIMIT_REACHED') {
                          setAuthError(
                            payload.error ??
                              'Para seguir participando, crea una cuenta',
                          );
                          setAccountPromptOpen(true);
                        } else {
                          alert(payload.error ?? 'No se pudo crear el reporte.');
                        }
                        return;
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
              <label className="block text-xs font-semibold text-slate-600">
                Categoría
              </label>
              <select
                className="mt-1 w-full bg-transparent text-sm text-slate-900 outline-none"
                onChange={(event) => setSelectedCategory(event.target.value)}
                value={selectedCategory}
              >
                {REPORT_CATEGORIES.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-2xl border-2 border-sky-400 bg-sky-100 px-3 py-2">
              <label className="block text-xs font-semibold text-slate-600">
                Subtipo
              </label>
              <select
                className="mt-1 w-full bg-transparent text-sm text-slate-900 outline-none"
                onChange={(event) => setSelectedType(event.target.value)}
                value={selectedType}
              >
                {subcategoryOptions.map((type) => (
                  <option key={type.name} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-2xl border-2 border-sky-200 bg-white/80 px-3 py-2">
              <label className="block text-xs font-semibold text-slate-600">
                Foto del reporte
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
                      alt="Foto del reporte"
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

      {accountPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="relative w-full max-w-md rounded-[28px] bg-white px-6 py-5 shadow-[0_24px_50px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-900">
              {currentUser ? 'Tu cuenta' : 'Para seguir participando, crea una cuenta'}
            </h2>
            {!currentUser && (
              <p className="mt-2 text-sm text-slate-600">
                Tus primeros 5 reportes son sin cuenta. Después, necesitas cuenta para continuar.
              </p>
            )}

            {currentUser ? (
              <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700">
                <div className="flex items-start gap-4">
                  <img
                    alt="Avatar"
                    className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                    src={`/avatares/${currentUser.avatar_key ?? 'bart.svg'}`}
                  />
                  <div className="grid gap-1">
                    <p>
                      Usuario: <strong>{currentUser.username}</strong>
                    </p>
                    <p>Correo: {currentUser.email}</p>
                    <p>
                      Nivel:{' '}
                      <strong>
                        {currentUser.role === 'admin' ? 'Admin' : 'Ciudadano'}
                      </strong>
                    </p>
                    <p>
                      Miembro desde:{' '}
                      <strong>
                        {new Date(currentUser.created_at ?? '').toLocaleDateString(
                          'es-MX',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          },
                        )}
                      </strong>
                    </p>
                    <p>
                      # de reportes:{' '}
                      <strong>{currentStats?.reports_total ?? 0}</strong>
                    </p>
                    <p>
                      # reportes verificados:{' '}
                      <strong>{currentStats?.reports_verified ?? 0}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Elegir avatar
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AVATAR_OPTIONS.map((avatar) => {
                      const active = (currentUser.avatar_key ?? 'bart.svg') === avatar;
                      return (
                        <button
                          key={avatar}
                          className={`rounded-full border p-0.5 ${
                            active ? 'border-slate-900' : 'border-slate-300'
                          }`}
                          disabled={isUpdatingAvatar}
                          onClick={() => updateAvatar(avatar)}
                          type="button"
                        >
                          <img
                            alt={avatar}
                            className="h-10 w-10 rounded-full object-cover"
                            src={`/avatares/${avatar}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => {
                    window.location.href = '/cuenta';
                  }}
                  type="button"
                >
                  Abrir panel de cuenta
                </button>

                <button
                  className="mt-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    setCurrentUser(null);
                    setCurrentStats(null);
                  }}
                  type="button"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <form
                className="mt-4 grid gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await submitAuth();
                }}
              >
                <div className="flex gap-2">
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      authMode === 'register'
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 text-slate-700'
                    }`}
                    onClick={() => setAuthMode('register')}
                    type="button"
                  >
                    Crear cuenta
                  </button>
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      authMode === 'login'
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 text-slate-700'
                    }`}
                    onClick={() => setAuthMode('login')}
                    type="button"
                  >
                    Iniciar sesión
                  </button>
                </div>

                {authMode === 'register' && (
                  <input
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    onChange={(event) => setAuthUsername(event.target.value)}
                    placeholder="username"
                    type="text"
                    value={authUsername}
                  />
                )}
                <input
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder={
                    authMode === 'login'
                      ? 'correo o username'
                      : 'correo@ejemplo.com'
                  }
                  type={authMode === 'login' ? 'text' : 'email'}
                  value={authEmail}
                />
                <input
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="contraseña"
                  type="password"
                  value={authPassword}
                />
                {authError && <p className="text-xs text-rose-600">{authError}</p>}
                {authNotice && (
                  <p className="text-xs text-emerald-600">{authNotice}</p>
                )}
                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  disabled={authLoading}
                  type="submit"
                >
                  {authLoading ? 'Procesando...' : authMode === 'register' ? 'Crear cuenta' : 'Entrar'}
                </button>
              </form>
            )}

            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              onClick={() => setAccountPromptOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showFollow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="relative w-full max-w-md rounded-[28px] bg-white px-6 py-5 shadow-[0_24px_50px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-900">
              Síguenos en redes 👀
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Estamos compartiendo actualizaciones, nuevos reportes y avances del
              mapa. Forma parte de la conversación.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Facebook: bachejoa.com · Instagram: @bachejoa
            </p>

            <button
              className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                window.open(
                  'https://www.facebook.com/profile.php?id=61587512867475',
                  '_blank',
                );
              }}
              type="button"
            >
              Seguir Bachejoa
            </button>

            <label className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <input
                checked={dontShowFollow}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
                onChange={(event) => setDontShowFollow(event.target.checked)}
                type="checkbox"
              />
              No volver a mostrar
            </label>

            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              onClick={() => {
                if (dontShowFollow) {
                  window.localStorage.setItem('bachejoa_follow_hide', 'true');
                }
                setShowFollow(false);
              }}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
