export const REPORT_STATUS_STAGES = [
  'Creado',
  'Visible',
  'Verificado',
  'En revisión',
  'Reparado',
  'Archivado',
] as const;

export type ReportStatus = (typeof REPORT_STATUS_STAGES)[number];

export const REPORT_CATEGORIES = [
  {
    name: 'Baches',
    subcategories: ['Grieta', 'Bache', 'Bacheson', 'Reparacion inconclusa'],
  },
  {
    name: 'Luminarias',
    subcategories: ['Fallando', 'Descompuesta'],
  },
  {
    name: 'Agua',
    subcategories: ['Fuga de agua', 'No hay agua'],
  },
  {
    name: 'Basura',
    subcategories: ['Acumulacion de basura', 'No paso recoleccion'],
  },
  {
    name: 'Drenaje',
    subcategories: ['Brote de aguas negras', 'Alcantarilla destapada'],
  },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['name'];

export const REPORT_SELECT =
  'id, lat, lng, type, category, subcategory, status, photo_url, created_at, angry_count, repaired, repaired_at, repair_rating_avg, repair_rating_count';

export function isValidReportStatus(value: string): value is ReportStatus {
  return REPORT_STATUS_STAGES.includes(value as ReportStatus);
}

export function isValidReportCategory(value: string): value is ReportCategory {
  return REPORT_CATEGORIES.some((category) => category.name === value);
}

export function isValidSubcategory(categoryName: string, subcategory: string) {
  const category = REPORT_CATEGORIES.find((item) => item.name === categoryName);
  if (!category) return false;
  return (category.subcategories as readonly string[]).includes(subcategory);
}

export function resolveLegacyCategory(type: string): {
  category: ReportCategory;
  subcategory: string;
} {
  const normalizedType = type.trim().toLowerCase();
  const legacyMap: Record<string, { category: ReportCategory; subcategory: string }> = {
    'pequeña grieta': { category: 'Baches', subcategory: 'Grieta' },
    'grieta': { category: 'Baches', subcategory: 'Grieta' },
    'bache': { category: 'Baches', subcategory: 'Bache' },
    'bachesón': { category: 'Baches', subcategory: 'Bacheson' },
    'bacheson': { category: 'Baches', subcategory: 'Bacheson' },
    'reparación inconclusa': {
      category: 'Baches',
      subcategory: 'Reparacion inconclusa',
    },
    'reparacion inconclusa': {
      category: 'Baches',
      subcategory: 'Reparacion inconclusa',
    },
    'falla': { category: 'Luminarias', subcategory: 'Fallando' },
    'fallando': { category: 'Luminarias', subcategory: 'Fallando' },
    'descompuesta': { category: 'Luminarias', subcategory: 'Descompuesta' },
    'fuga de agua': { category: 'Agua', subcategory: 'Fuga de agua' },
    'falta de agua': { category: 'Agua', subcategory: 'No hay agua' },
    'no hay agua': { category: 'Agua', subcategory: 'No hay agua' },
    'aguas negras': { category: 'Drenaje', subcategory: 'Brote de aguas negras' },
    'drenaje colapsado': {
      category: 'Drenaje',
      subcategory: 'Brote de aguas negras',
    },
    'brote de aguas negras': {
      category: 'Drenaje',
      subcategory: 'Brote de aguas negras',
    },
    'alcantarilla abierta': {
      category: 'Drenaje',
      subcategory: 'Alcantarilla destapada',
    },
    'alcantarilla destapada': {
      category: 'Drenaje',
      subcategory: 'Alcantarilla destapada',
    },
    'acumulación de basura': {
      category: 'Basura',
      subcategory: 'Acumulacion de basura',
    },
    'acumulacion de basura': {
      category: 'Basura',
      subcategory: 'Acumulacion de basura',
    },
    'no ha pasado recolección': {
      category: 'Basura',
      subcategory: 'No paso recoleccion',
    },
    'no ha pasado recoleccion': {
      category: 'Basura',
      subcategory: 'No paso recoleccion',
    },
    'no paso recoleccion': {
      category: 'Basura',
      subcategory: 'No paso recoleccion',
    },
  };
  if (legacyMap[normalizedType]) {
    return legacyMap[normalizedType];
  }

  const baches = REPORT_CATEGORIES[0];
  if (
    baches.subcategories.includes(
      type as (typeof baches.subcategories)[number],
    )
  ) {
    return { category: 'Baches', subcategory: type };
  }
  return { category: 'Baches', subcategory: 'Grieta' };
}

export function normalizeReportInput(input: {
  category?: string;
  subcategory?: string;
  type?: string;
  status?: string;
}) {
  const incomingType = (input.type ?? '').trim();
  const incomingCategory = (input.category ?? '').trim();
  const incomingSubcategory = (input.subcategory ?? '').trim();
  const incomingStatus = (input.status ?? '').trim();

  let category = incomingCategory;
  let subcategory = incomingSubcategory;

  if (!category || !subcategory) {
    const resolved = resolveLegacyCategory(incomingType);
    category = category || resolved.category;
    subcategory = subcategory || resolved.subcategory;
  }

  const status = isValidReportStatus(incomingStatus) ? incomingStatus : 'Visible';

  if (!isValidReportCategory(category) || !isValidSubcategory(category, subcategory)) {
    return null;
  }

  return {
    category,
    subcategory,
    status,
    type: subcategory,
  };
}
