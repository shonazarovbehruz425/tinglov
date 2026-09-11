import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing. Please set them in your .env or host dashboard. Falling back to placeholder values.');
}

/**
 * RLS (Row Level Security) checklist — quyidagi jadvallarda RLS yoqilgan va
 * siyosatlar auth.uid() bilan chegaralangan bo'lishi shart:
 *
 * - profiles:         SELECT/UPDATE faqat id = auth.uid() uchun (INSERT —
 *                     ro'yxatdan o'tishda id = auth.uid()). xp/streak/level
 *                     maydonlarini anon key orqali erkin o'zgartirish taqiqlangan.
 * - saved_words:      SELECT/INSERT/DELETE faqat user_id = auth.uid() uchun.
 * - completed_scenes: SELECT/INSERT faqat user_id = auth.uid() uchun.
 * - scenes:           ommaviy SELECT (published); yozish huquqi faqat
 *                     admin/service key'da.
 *
 * Brauzerga yetkaziladigan anon key faqat shu siyosatlar doirasida ishlaydi.
 */
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

