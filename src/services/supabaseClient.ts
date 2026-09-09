import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://juzytimtoetduvkbigih.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_1jH-EkUd3QmczGBi_ImTGQ_zVSYtCJG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
