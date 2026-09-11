/**
 * storageKeys — localStorage / sessionStorage kalitlarining yagona manbai.
 *
 * Maqsad: `lingua_*`, `tinglov_*`, `movielisten_*` kabi sehrli string'larni
 * bitta joyda konstanta qilish va tarqoqlikni oldini olish.
 *
 * Migratsiya holati (to'liq):
 * - storageService, apiService, i18nService — shu konstantalarni import qiladi;
 * - utils/csrf, utils/rateLimiter — xuddi shu konstantalarga o'tkazilgan;
 * - UI komponentlar (AnimatedStage, OnboardingStepper, SettingsView,
 *   StatsHeader) — localStorage/theme/subtitle/onboarding kalitlari shu
 *   yerda centralizatsiya qilingan.
 * src/ bo'ylab `lingua_ / tinglov_ / movielisten_` sehrli string'lari
 * qolmadi (AdminView'dagi `tinglov_users_*.csv` — fayl nomi, kalit emas).
 */

// ---------------------------------------------------------------------------
// Asosiy foydalanuvchi ma'lumotlari (storageService)
// ---------------------------------------------------------------------------

/** Foydalanuvchi statistikasi (XP, streak, lug'at, pozitsiyalar). */
export const STATS_KEY = 'lingua_movie_user_stats';

/** Foydalanuvchi yaratgan maxsus darslar. */
export const CUSTOM_SCENES_KEY = 'lingua_movie_custom_scenes';

/** Sahna bo'yicha TOP rekordlar. */
export const HIGH_SCORES_KEY = 'lingua_movie_scene_highscores';

/** Offline rejimda navbatga qo'yilgan sinxronizatsiya. */
export const PENDING_SYNC_KEY = 'lingua_movie_pending_sync';

// ---------------------------------------------------------------------------
// Autentifikatsiya (apiService / rateLimiter)
// ---------------------------------------------------------------------------

/** Eski versiyalardan qolgan custom token (faqat tozalash uchun). */
export const AUTH_TOKEN_KEY = 'tinglov_auth_token';

/** Juda eski token kaliti (faqat tozalash uchun). */
export const LEGACY_TOKEN_KEY = 'tinglov_token';

/** Keshlangan foydalanuvchi sessiyasi (localStorage). */
export const USER_SESSION_KEY = 'tinglov_user_session';

/** Admin JWT (sessionStorage). */
export const ADMIN_JWT_KEY = 'tinglov_admin_jwt';

/** Noto'g'ri login urinishlar hisoblagichi (sessionStorage). */
export const AUTH_FAILURES_KEY = 'tinglov_auth_failures';

/** Eksponensial backoff cooldown muddati (sessionStorage). */
export const AUTH_COOLDOWN_KEY = 'tinglov_auth_cooldown_until';

// ---------------------------------------------------------------------------
// Xavfsizlik (csrf)
// ---------------------------------------------------------------------------

/** CSRF token (sessionStorage + XSRF-TOKEN cookie bilan sinxron). */
export const CSRF_STORAGE_KEY = 'tinglov_csrf_token';

// ---------------------------------------------------------------------------
// UI sozlamalari (i18nService / theme / onboarding / subtitles)
// ---------------------------------------------------------------------------

/** Interfeys tili. */
export const APP_LANGUAGE_KEY = 'movielisten_app_language';

/** Mavzu (light/dark/oled). */
export const APP_THEME_KEY = 'movielisten_theme';

/** Onboarding ko'rilganlik belgisi. */
export const ONBOARDED_KEY = 'movielisten_onboarded';

/** Subtitr rejimi (both/en/uz/off). */
export const SUBTITLE_MODE_KEY = 'lingua_subtitle_mode';

/** Barcha kalitlarning guruhlangan ko'rinishi (audit/debug uchun). */
export const STORAGE_KEYS = {
  stats: STATS_KEY,
  customScenes: CUSTOM_SCENES_KEY,
  highScores: HIGH_SCORES_KEY,
  pendingSync: PENDING_SYNC_KEY,
  authToken: AUTH_TOKEN_KEY,
  legacyToken: LEGACY_TOKEN_KEY,
  userSession: USER_SESSION_KEY,
  adminJwt: ADMIN_JWT_KEY,
  authFailures: AUTH_FAILURES_KEY,
  authCooldown: AUTH_COOLDOWN_KEY,
  csrf: CSRF_STORAGE_KEY,
  appLanguage: APP_LANGUAGE_KEY,
  appTheme: APP_THEME_KEY,
  onboarded: ONBOARDED_KEY,
  subtitleMode: SUBTITLE_MODE_KEY,
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;
