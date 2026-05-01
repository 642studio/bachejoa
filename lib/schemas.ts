import { z } from 'zod';
import {
  REPORT_CATEGORIES,
  REPORT_STATUS_STAGES,
  isValidReportCategory,
  isValidReportStatus,
  isValidSubcategory,
} from './reporting';
import { CITY_ZONES } from './zones';

const uuidSchema = z.string().uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(254).optional(),
  email: z.string().trim().min(1).max(254).optional(),
  password: z.string().min(1).max(512),
}).refine((value) => value.identifier || value.email, {
  message: 'Correo/usuario y contraseña son obligatorios.',
});

export const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .transform((value) => value.toLowerCase()),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(512),
});

export const ContactSchema = z.object({
  name: text(2, 120),
  contact: text(3, 120),
  topic: z.string().trim().max(120).optional().default(''),
  message: text(10, 4000),
});

export const ReportCreateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  category: z.string().trim().min(1).max(80),
  subcategory: z.string().trim().min(1).max(80),
  type: z.string().trim().max(80).optional().default(''),
  status: z.string().trim().max(40).optional().default('Visible'),
}).superRefine((value, ctx) => {
  if (!isValidReportCategory(value.category)) {
    ctx.addIssue({ code: 'custom', path: ['category'], message: 'Categoría inválida.' });
    return;
  }
  if (!isValidSubcategory(value.category, value.subcategory)) {
    ctx.addIssue({ code: 'custom', path: ['subcategory'], message: 'Subtipo inválido.' });
  }
  if (value.status && !isValidReportStatus(value.status)) {
    ctx.addIssue({ code: 'custom', path: ['status'], message: 'Estatus inválido.' });
  }
});

export const CursorSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().datetime().optional(),
  cursor_id: uuidSchema.optional(),
});

export const StatusSchema = z.object({
  status: z.enum(REPORT_STATUS_STAGES),
});

export const ReportTypeSchema = z.object({
  category: z.string().trim(),
  subcategory: z.string().trim(),
}).superRefine((value, ctx) => {
  if (!isValidReportCategory(value.category) || !isValidSubcategory(value.category, value.subcategory)) {
    ctx.addIssue({ code: 'custom', message: 'Categoría o tipo inválido.' });
  }
});

const validCategoryNames = new Set<string>(
  REPORT_CATEGORIES.map((item) => item.name),
);
const validZoneIds = new Set<string>(CITY_ZONES.map((item) => item.id));

export const OfficialAccountSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(512),
  full_name: text(3, 120),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  area: z.string().trim().max(120).optional().default(''),
  categories: z
    .array(z.string().trim().refine((value) => validCategoryNames.has(value)))
    .min(1)
    .max(REPORT_CATEGORIES.length),
  zones: z
    .array(z.string().trim().refine((value) => validZoneIds.has(value)))
    .max(CITY_ZONES.length)
    .optional()
    .default([]),
});

export const RatingSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
});
