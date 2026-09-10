import { z } from 'zod';

// ============================================================================
// Core Primitive Schemas
// ============================================================================

export const emailSchema = z
  .string({ message: 'Elektron pochta manzilingizni kiriting' })
  .trim()
  .toLowerCase()
  .min(5, 'Email kamida 5 ta belgidan iborat bo‘lishi kerak')
  .max(255, 'Email 255 ta belgidan oshmasligi kerak')
  .email('Elektron pochta manzili noto‘g‘ri formatda (masalan: user@example.com)');

export const usernameSchema = z
  .string({ message: 'Login (foydalanuvchi nomi)ni kiriting' })
  .trim()
  .toLowerCase()
  .min(3, 'Login kamida 3 ta belgidan iborat bo‘lishi kerak')
  .max(30, 'Login 30 ta belgidan oshmasligi kerak')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Loginda faqat lotin harflari, sonlar va (. _ -) belgilari ruxsat etiladi');

export const passwordSchema = z
  .string({ message: 'Parolni kiriting' })
  .min(8, 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak')
  .max(100, 'Parol 100 ta belgidan oshmasligi kerak')
  .regex(/^(?=.*[A-Z])(?=.*[0-9])/, 'Parolda kamida 1 ta katta harf (A-Z) va kamida 1 ta raqam (0-9) bo‘lishi shart');

export const fullNameSchema = z
  .string()
  .trim()
  .max(60, 'To‘liq ism 60 ta belgidan oshmasligi kerak')
  .optional()
  .transform(val => val || '');

// ============================================================================
// Auth Form Schemas
// ============================================================================

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z
    .string({ message: 'Login yoki emailni kiriting' })
    .trim()
    .min(3, 'Login yoki email kamida 3 ta belgidan iborat bo‘lishi kerak')
    .max(255, 'Login/email 255 ta belgidan oshmasligi kerak'),
  password: z
    .string({ message: 'Parolni kiriting' })
    .min(1, 'Parolni kiriting')
    .max(100, 'Parol 100 ta belgidan oshmasligi kerak'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// Profile Editing Schema
// ============================================================================

export const profileUpdateSchema = z.object({
  name: z
    .string({ message: 'Ismingizni kiriting' })
    .trim()
    .min(1, 'Ismingizni kiriting')
    .max(60, 'Ism 60 ta belgidan oshmasligi kerak'),
  handle: z
    .string({ message: 'Taxallusni kiriting' })
    .trim()
    .min(2, 'Taxallus kamida 2 ta belgidan iborat bo‘lishi kerak')
    .max(35, 'Taxallus 35 ta belgidan oshmasligi kerak')
    .regex(/^@?[a-zA-Z0-9_.-]+$/, 'Taxallusda faqat harf, son va (. _ -) belgilari ruxsat etiladi'),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ============================================================================
// Custom Scene Creation Schema
// ============================================================================

export const customDialogueSchema = z.object({
  character: z
    .string({ message: 'Qahramon ismini kiriting' })
    .trim()
    .min(1, 'Qahramon ismini kiriting')
    .max(50, 'Qahramon ismi 50 ta belgidan oshmasligi kerak'),
  textEn: z
    .string({ message: 'Inglizcha jumlani kiriting' })
    .trim()
    .min(2, 'Inglizcha jumla kamida 2 ta belgidan iborat bo‘lishi kerak')
    .max(500, 'Inglizcha jumla 500 ta belgidan oshmasligi kerak'),
  textUz: z
    .string({ message: 'O‘zbekcha tarjimani kiriting' })
    .trim()
    .min(2, 'O‘zbekcha tarjima kamida 2 ta belgidan iborat bo‘lishi kerak')
    .max(500, 'O‘zbekcha tarjima 500 ta belgidan oshmasligi kerak'),
});

const ALLOWED_CATEGORIES = ['Cartoon', 'Cinema', 'Daily Life', 'Series', 'Anime'] as const;

export const customSceneSchema = z.object({
  movieName: z
    .string({ message: 'Kino yoki multfilm nomini kiriting' })
    .trim()
    .min(2, 'Kino nomi kamida 2 ta belgidan iborat bo‘lishi kerak')
    .max(100, 'Kino nomi 100 ta belgidan oshmasligi kerak'),
  category: z.enum(ALLOWED_CATEGORIES, { message: 'Yaroqli kategoriya tanlang' }),
  videoUrl: z
    .string()
    .trim()
    .max(1000, 'Video havolasi juda uzun')
    .refine(
      url => !url || /^https?:\/\/.+/i.test(url) || /^blob:/i.test(url),
      'Video havolasi xavfsiz URL bo‘lishi kerak (https://...)'
    )
    .optional(),
  dialogues: z
    .array(customDialogueSchema)
    .min(1, 'Kamida bitta replika kiritilishi shart')
    .max(50, 'Bitta sahnaga ko‘pi bilan 50 ta replika qo‘shish mumkin'),
});

export type CustomSceneInput = z.infer<typeof customSceneSchema>;

// ============================================================================
// YouTube URL Validation Schema
// ============================================================================

export const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;

export const youtubeUrlSchema = z
  .string({ message: 'YouTube havolasini kiriting' })
  .trim()
  .min(11, 'YouTube havolasi juda qisqa')
  .max(500, 'Havola 500 ta belgidan oshmasligi kerak')
  .refine(
    url => {
      if (/^[\w-]{11}$/.test(url)) return true;
      const match = url.match(YOUTUBE_REGEX);
      return Boolean(match && match[1] && match[1].length === 11);
    },
    'Yaroqli YouTube havolasini kiriting (masalan: https://www.youtube.com/watch?v=... yoki https://youtu.be/...)'
  );

// ============================================================================
// Search Query Schema (ReDoS / Injection prevention)
// ============================================================================

export const searchQuerySchema = z
  .string()
  .max(100, 'Qidiruv so‘rovi 100 ta belgidan oshmasligi kerak')
  .transform(val => val.trim());

// ============================================================================
// Generic Safe Validation Helpers
// ============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function safeValidate<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: any } },
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstIssue = (result.error as any)?.issues?.[0];
  const errorMessage = firstIssue ? firstIssue.message : 'Kiritilgan ma‘lumotlar yaroqsiz';
  return { success: false, error: errorMessage };
}
