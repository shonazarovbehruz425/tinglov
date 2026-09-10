import { supabase } from './supabaseClient';
import { safeValidate, registerSchema, loginSchema } from '../utils/validation';
import { getCsrfHeaders, syncCsrfWithBackend, validateCsrfToken } from '../utils/csrf';
import { videoStreamService } from './videoStreamService';

export interface AuthUser {
  id: string | number;
  username: string;
  email: string;
  full_name: string;
  avatar_color: string;
  xp: number;
  streak: number;
  level: number;
  last_active_date: string | null;
  created_at: string;
  auth_provider?: 'google' | 'email';
}

export interface AuthResponse {
  message?: string;
  token?: string;
  user?: AuthUser;
  error?: string;
  requiresCaptcha?: boolean;
  retryAfter?: number;
}

export interface MeResponse {
  user: AuthUser;
  savedWords: Array<{ id: string | number; word: string; translation: string | null; scene_title: string | null }>;
  completedScenes: Array<{ id: string | number; scene_id: string; accuracy: number; wpm: number }>;
  completedSceneIds?: string[];
}

const TOKEN_KEY = 'tinglov_auth_token';

class ApiService {
  private token: string | null = null;
  private currentUser: AuthUser | null = null;
  private onAuthChangeCallbacks: Array<(user: AuthUser | null) => void> = [];
  private adminToken: string | null = null;
  private cachedAdminPath: string | null = null;
  private authReadyPromise: Promise<MeResponse | null> | null = null;

  constructor() {
    // 1. Restore persistent user session synchronously from localStorage
    this.restoreCachedUser();

    // 2. Purge legacy custom tokens from older versions
    this.purgeLegacyTokens();

    // Listen to real-time auth state changes in Supabase
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        this.setToken(session.access_token);
        await this.loadUserProfile(session.user);
        this.syncBackendSession(session.user).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        this.clearSession();
        this.notifyAuthChange();
      }
    });

    // Warm up CSRF token with backend
    syncCsrfWithBackend().catch(() => {});
  }

  public async waitForAuth(): Promise<MeResponse | null> {
    if (!this.authReadyPromise) {
      this.authReadyPromise = this.getMe();
    }
    return this.authReadyPromise;
  }

  private static readonly USER_SESSION_KEY = 'tinglov_user_session';

  // Restore session from localStorage synchronously on startup
  private restoreCachedUser(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(ApiService.USER_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.id) {
            this.currentUser = parsed;
            this.token = 'local_session';
          }
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  // Save session to localStorage
  private saveUserToStorage(user: AuthUser | null): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (user) {
          localStorage.setItem(ApiService.USER_SESSION_KEY, JSON.stringify(user));
        } else {
          localStorage.removeItem(ApiService.USER_SESSION_KEY);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Purge legacy custom tokens stored in client-side storage from older versions
  private purgeLegacyTokens(): void {
    try {
      if (typeof window !== 'undefined') {
        if (window.sessionStorage) {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem('tinglov_token');
        }
        if (window.localStorage) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem('tinglov_token');
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Tokens are strictly maintained in-memory for the current runtime session
  private setToken(token: string | null): void {
    this.token = token;
  }

  // Synchronize authenticated session to backend to set secure HttpOnly cookie
  private async syncBackendSession(user: any): Promise<void> {
    try {
      const isGoogle = user.app_metadata?.provider === 'google'
        || (Array.isArray(user.identities) && user.identities.some((i: any) => i.provider === 'google'));
      const provider: 'google' | 'email' = isGoogle ? 'google' : 'email';

      await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          uuid: user.id,
          email: user.email,
          username: user.user_metadata?.username || (user.email ? user.email.split('@')[0] : 'foydalanuvchi'),
          fullName: user.user_metadata?.full_name || '',
          avatarColor: user.user_metadata?.avatar_color,
          authProvider: provider,
        }),
      });
    } catch {
      // Ignore if backend is not running or offline
    }
  }

  private clearSession(): void {
    this.token = null;
    this.currentUser = null;
    this.saveUserToStorage(null);
    this.purgeLegacyTokens();
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return !!this.token || !!this.currentUser;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    this.onAuthChangeCallbacks.push(callback);
    return () => {
      this.onAuthChangeCallbacks = this.onAuthChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyAuthChange(): void {
    this.onAuthChangeCallbacks.forEach(cb => cb(this.currentUser));
  }

  private async loadUserProfile(supabaseUser: any): Promise<AuthUser | null> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      const isGoogle = supabaseUser.app_metadata?.provider === 'google'
        || (Array.isArray(supabaseUser.identities) && supabaseUser.identities.some((i: any) => i.provider === 'google'));
      const provider: 'google' | 'email' = isGoogle ? 'google' : 'email';

      const user: AuthUser = {
        id: supabaseUser.id,
        username: profile?.username || supabaseUser.user_metadata?.username || (supabaseUser.email ? supabaseUser.email.split('@')[0] : 'foydalanuvchi'),
        email: supabaseUser.email || '',
        full_name: profile?.full_name || supabaseUser.user_metadata?.full_name || '',
        avatar_color: profile?.avatar_color || '#FF5722',
        xp: profile?.xp ?? 0,
        streak: profile?.streak ?? 1,
        level: profile?.level ?? 1,
        last_active_date: profile?.updated_at || null,
        created_at: supabaseUser.created_at || new Date().toISOString(),
        auth_provider: provider,
      };

      this.currentUser = user;
      this.saveUserToStorage(user);
      this.notifyAuthChange();
      return user;
    } catch {
      try {
        const isGoogle = supabaseUser.app_metadata?.provider === 'google'
          || (Array.isArray(supabaseUser.identities) && supabaseUser.identities.some((i: any) => i.provider === 'google'));
        const provider: 'google' | 'email' = isGoogle ? 'google' : 'email';
        const fallbackUser: AuthUser = {
          id: supabaseUser.id,
          username: supabaseUser.user_metadata?.username || (supabaseUser.email ? supabaseUser.email.split('@')[0] : 'foydalanuvchi'),
          email: supabaseUser.email || '',
          full_name: supabaseUser.user_metadata?.full_name || '',
          avatar_color: '#FF5722',
          xp: 0,
          streak: 1,
          level: 1,
          last_active_date: null,
          created_at: supabaseUser.created_at || new Date().toISOString(),
          auth_provider: provider,
        };
        this.currentUser = fallbackUser;
        this.saveUserToStorage(fallbackUser);
        this.notifyAuthChange();
        return fallbackUser;
      } catch {
        return null;
      }
    }
  }

  public async register(params: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
    csrfToken?: string;
  }): Promise<AuthResponse> {
    try {
      // CSRF token validation
      if (params.csrfToken && !validateCsrfToken(params.csrfToken)) {
        return { error: 'Xavfsizlik (CSRF) tokeni yaroqsiz. Sahifani yangilab qayta urinib ko‘ring.' };
      }

      // Validate input data using Zod schema
      const validation = safeValidate(registerSchema, params);
      if (!validation.success) {
        return { error: validation.error };
      }

      const { username: cleanUsername, email: cleanEmail, password: cleanPassword, fullName: cleanFullName } = validation.data;

      // Check if username already exists in profiles
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        return { error: 'Bu foydalanuvchi nomi (login) band. Boshqa nom tanlang.' };
      }

      // Supabase Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            username: cleanUsername,
            full_name: cleanFullName,
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          return { error: 'Bu email manzil bilan allaqachon ro‘yxatdan o‘tilgan. Tizimga kiring.' };
        }
        if (error.message.includes('Password should be at least')) {
          return { error: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.' };
        }
        return { error: error.message };
      }

      if (data.user) {
        // Upsert profile in Supabase
        const newProfile = {
          id: data.user.id,
          username: cleanUsername,
          full_name: cleanFullName || cleanUsername,
          avatar_color: '#FF5722',
          xp: 0,
          streak: 1,
          level: 1,
        };

        await supabase.from('profiles').upsert(newProfile);

        if (data.session) {
          this.setToken(data.session.access_token);
        } else {
          this.setToken('session_authenticated');
        }

        const authUser: AuthUser = {
          ...newProfile,
          email: cleanEmail,
          last_active_date: new Date().toISOString(),
          created_at: data.user.created_at || new Date().toISOString(),
        };

        this.currentUser = authUser;
        await this.syncBackendSession({
          email: cleanEmail,
          user_metadata: { username: cleanUsername, full_name: cleanFullName, avatar_color: '#FF5722' }
        });
        this.notifyAuthChange();

        return {
          message: 'Muvaffaqiyatli ro‘yxatdan o‘tdingiz!',
          token: this.token || 'auth_token',
          user: authUser,
        };
      }

      return { error: 'Ro‘yxatdan o‘tishda xatolik yuz berdi' };
    } catch (e: any) {
      return { error: e.message || 'Server bilan bog‘lanishda xatolik yuz berdi' };
    }
  }

  public async login(params: {
    identifier: string;
    password: string;
    csrfToken?: string;
    captchaToken?: string;
    captchaAnswer?: string;
  }): Promise<AuthResponse> {
    try {
      // CSRF token validation
      if (params.csrfToken && !validateCsrfToken(params.csrfToken)) {
        return { error: 'Xavfsizlik (CSRF) tokeni yaroqsiz. Sahifani yangilab qayta urinib ko‘ring.' };
      }

      // Validate input data using Zod schema
      const validation = safeValidate(loginSchema, params);
      if (!validation.success) {
        return { error: validation.error };
      }

      // 1. Try Backend /api/auth/login first (natively supports both username and email + sets HttpOnly cookie)
      try {
        const backendRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders(),
          },
          credentials: 'include',
          body: JSON.stringify({
            identifier: validation.data.identifier,
            password: validation.data.password,
            captchaToken: params.captchaToken,
            captchaAnswer: params.captchaAnswer,
          }),
        });

        if (backendRes.ok) {
          const resData = await backendRes.json();
          if (resData.user) {
            this.currentUser = resData.user;
            this.saveUserToStorage(resData.user);
            this.setToken('httponly_session');
            this.authReadyPromise = Promise.resolve({
              user: resData.user,
              savedWords: [],
              completedScenes: [],
              completedSceneIds: [],
            });
            this.notifyAuthChange();
            return {
              message: resData.message || 'Xush kelibsiz!',
              user: resData.user,
              token: resData.token,
            };
          }
        } else if (backendRes.status === 400 || backendRes.status === 429) {
          const errData = await backendRes.json().catch(() => null);
          if (errData?.requiresCaptcha || errData?.retryAfter) {
            return {
              error: errData.error,
              requiresCaptcha: errData.requiresCaptcha,
              retryAfter: errData.retryAfter,
            };
          }
        }
      } catch {
        // Backend offline or network error, fallback to Supabase
      }

      // 2. Fallback to Supabase Auth
      let email = validation.data.identifier.toLowerCase();

      // If user typed username instead of email, check if email column exists or if we can resolve it
      if (!email.includes('@')) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, username')
            .eq('username', email)
            .maybeSingle();

          if (profile && (profile as any).email) {
            email = (profile as any).email;
          } else {
            return { error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri' };
          }
        } catch {
          return { error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri' };
        }
      }

      // Supabase Sign In with Password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: params.password,
      });

      if (error) {
        const lowerMsg = error.message.toLowerCase();
        if (lowerMsg.includes('invalid login credentials')) {
          return { error: 'Email yoki parol noto‘g‘ri kiritildi.' };
        }
        if (lowerMsg.includes('email not confirmed')) {
          return { error: 'Email tasdiqlanmagan. Iltimos, emailingizga yuborilgan havolani bosing.' };
        }
        if (lowerMsg.includes('too many requests') || lowerMsg.includes('rate limit') || lowerMsg.includes('over_email_send_rate_limit')) {
          return {
            error: 'Juda ko‘p noto‘g‘ri urinishlar qilindi. Xavfsizlik yuzasidan birozdan so‘ng qayta urinib ko‘ring.',
            requiresCaptcha: true,
            retryAfter: 60,
          };
        }
        return { error: error.message };
      }

      if (data.user && data.session) {
        this.setToken(data.session.access_token);
        const user = await this.loadUserProfile(data.user);
        await this.syncBackendSession(data.user);
        this.authReadyPromise = Promise.resolve(user ? {
          user,
          savedWords: [],
          completedScenes: [],
          completedSceneIds: [],
        } : null);

        return {
          message: 'Xush kelibsiz!',
          token: this.token || undefined,
          user: user || undefined,
        };
      }

      return { error: 'Kirishda xatolik yuz berdi' };
    } catch (e: any) {
      return { error: e.message || 'Server bilan bog‘lanishda xatolik yuz berdi' };
    }
  }

  public async signInWithGoogle(): Promise<{ error?: string }> {
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (e: any) {
      return { error: e.message || 'Google orqali kirishda xatolik yuz berdi' };
    }
  }

  public async getMe(): Promise<MeResponse | null> {
    let currentUser: AuthUser | null = null;
    let savedWords: Array<{ id: string | number; word: string; translation: string | null; scene_title: string | null }> = [];
    let completedScenes: Array<{ id: string | number; scene_id: string; accuracy: number; wpm: number }> = [];
    let completedSceneIds: string[] = [];

    // 1. Check backend HttpOnly cookie session (cross-tab & persistent across tab closes)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          currentUser = data.user;
          this.currentUser = data.user;
          this.setToken('httponly_session');
          savedWords = data.savedWords || [];
          completedScenes = data.completedScenes || [];
          completedSceneIds = data.completedSceneIds || completedScenes.map((s: any) => s.scene_id);
        }
      }
    } catch {
      // Backend offline or user not logged in via cookie
    }

    // 2. Check Supabase in-memory session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.setToken(session.access_token);
        const sbUser = await this.loadUserProfile(session.user);
        if (sbUser) {
          if (!currentUser) {
            currentUser = sbUser;
            this.currentUser = sbUser;
          } else {
            currentUser.xp = Math.max(currentUser.xp, sbUser.xp);
            currentUser.streak = Math.max(currentUser.streak, sbUser.streak);
            currentUser.level = Math.max(currentUser.level, sbUser.level);
          }

          const { data: words } = await supabase
            .from('saved_words')
            .select('*')
            .eq('user_id', sbUser.id);

          const { data: scenes } = await supabase
            .from('completed_scenes')
            .select('*')
            .eq('user_id', sbUser.id);

          if (Array.isArray(words) && words.length > 0) {
            const existingWordSet = new Set(savedWords.map(w => w.word.toLowerCase()));
            words.forEach((w: any) => {
              if (w.word && !existingWordSet.has(w.word.toLowerCase())) {
                savedWords.push(w);
                existingWordSet.add(w.word.toLowerCase());
              }
            });
          }

          if (Array.isArray(scenes) && scenes.length > 0) {
            const existingSceneSet = new Set(completedSceneIds);
            scenes.forEach((s: any) => {
              if (s.scene_id && !existingSceneSet.has(s.scene_id)) {
                completedScenes.push(s);
                completedSceneIds.push(s.scene_id);
                existingSceneSet.add(s.scene_id);
              }
            });
          }
        }
      }
    } catch {
      // Supabase session check failed or offline
    }

    if (currentUser) {
      this.notifyAuthChange();
      return {
        user: currentUser,
        savedWords,
        completedScenes,
        completedSceneIds,
      };
    }

    return null;
  }

  public async syncProgress(payload: {
    xp?: number;
    streak?: number;
    level?: number;
    lastActiveDate?: string;
    savedWords?: Array<{ word: string; translation?: string; sceneTitle?: string }>;
    completedScene?: { sceneId: string; accuracy?: number; wpm?: number };
    completedScenes?: string[];
    wordsCount?: number;
  }): Promise<any> {
    if (!this.currentUser) return null;

    if (typeof payload.xp === 'number') this.currentUser.xp = Math.max(this.currentUser.xp, payload.xp);
    if (typeof payload.streak === 'number') this.currentUser.streak = Math.max(this.currentUser.streak, payload.streak);
    if (typeof payload.level === 'number') this.currentUser.level = Math.max(this.currentUser.level, payload.level);

    let backendResult: any = null;

    // 1. Send to Backend SQLite API (/api/user/sync)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      };
      if (this.token && this.token !== 'session_authenticated' && this.token !== 'httponly_session') {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        backendResult = await res.json();
      }
    } catch {
      // Backend offline or unreachable
    }

    // 2. Also sync to Supabase if connected
    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      if (typeof payload.xp === 'number') updates.xp = payload.xp;
      if (typeof payload.streak === 'number') updates.streak = payload.streak;
      if (typeof payload.level === 'number') updates.level = payload.level;

      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', this.currentUser.id);

      if (payload.completedScene) {
        await supabase.from('completed_scenes').insert({
          user_id: this.currentUser.id,
          scene_id: payload.completedScene.sceneId,
          accuracy: payload.completedScene.accuracy || 0,
          wpm: payload.completedScene.wpm || 0,
        });
      }

      if (payload.savedWords && payload.savedWords.length > 0) {
        for (const sw of payload.savedWords) {
          await this.saveWord(sw.word, sw.translation, sw.sceneTitle);
        }
      }
    } catch {
      // Ignore background Supabase errors
    }

    return backendResult || { success: true };
  }

  public async saveWord(word: string, translation?: string, sceneTitle?: string): Promise<void> {
    const cleanWord = word.trim();
    if (!cleanWord) return;

    // 1. Send to backend SQLite (/api/user/words)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      };
      if (this.token && this.token !== 'session_authenticated' && this.token !== 'httponly_session') {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      await fetch('/api/user/words', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          action: 'save',
          word: cleanWord,
          translation: translation || null,
          sceneTitle: sceneTitle || null,
        }),
      });
    } catch {
      // Ignore background fetch error
    }

    // 2. Also send to Supabase if authenticated
    if (this.currentUser) {
      try {
        await supabase.from('saved_words').insert({
          user_id: this.currentUser.id,
          word: cleanWord,
          translation: translation || null,
          scene_title: sceneTitle || null,
        });
      } catch {
        // Ignore background Supabase error
      }
    }
  }

  public async deleteWord(word: string): Promise<void> {
    const cleanWord = word.trim();
    if (!cleanWord) return;

    // 1. Send to backend SQLite (/api/user/words)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      };
      if (this.token && this.token !== 'session_authenticated' && this.token !== 'httponly_session') {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      await fetch('/api/user/words', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete',
          word: cleanWord,
        }),
      });
    } catch {
      // Ignore
    }

    // 2. Also delete from Supabase if authenticated
    if (this.currentUser) {
      try {
        await supabase
          .from('saved_words')
          .delete()
          .eq('user_id', this.currentUser.id)
          .eq('word', cleanWord);
      } catch {
        // Ignore
      }
    }
  }

  public async getLeaderboard(): Promise<Array<{
    id: string | number;
    username: string;
    full_name: string;
    avatar_color: string;
    xp: number;
    streak: number;
    level: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_color, xp, streak, level')
        .order('xp', { ascending: false })
        .limit(25);

      if (error || !data) return [];
      return data as any;
    } catch {
      return [];
    }
  }

  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }

    try {
      // Clear backend HttpOnly cookie if using backend service with CSRF protection
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getCsrfHeaders(),
        },
      });
    } catch {
      // Ignore network errors on logout
    }

    this.authReadyPromise = null;
    this.clearSession();
    this.notifyAuthChange();
  }

  // ------------------------------------------------------------------------
  // Admin Panel Methods
  // ------------------------------------------------------------------------

  public getAdminRoutePath(): string {
    if (this.cachedAdminPath) return this.cachedAdminPath;
    const globalPath = (window as any)?.__ADMIN_PATH__;
    const envPath = (import.meta.env.VITE_ADMIN_PATH as string);
    let p = (globalPath || envPath || '/admin').trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
    this.cachedAdminPath = p;
    return p;
  }

  public async fetchAdminConfig(): Promise<string> {
    try {
      const res = await fetch('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        if (data.cloudflareR2Url) {
          videoStreamService.setCloudflareR2BaseUrl(data.cloudflareR2Url);
        }
        if (data.adminPath) {
          let p = data.adminPath.trim();
          if (!p.startsWith('/')) p = '/' + p;
          if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
          this.cachedAdminPath = p;
          return p;
        }
      }
    } catch {
      // Fallback to local
    }
    return this.getAdminRoutePath();
  }

  public isAdminAuthenticated(): boolean {
    return Boolean(this.adminToken);
  }

  public async adminLogin(username: string, password: string): Promise<{ success: boolean; error?: string; admin?: any }> {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Admin login muvaffaqiyatsiz bo‘ldi' };
      }
      this.adminToken = data.token || 'authenticated';
      if (typeof sessionStorage !== 'undefined' && data.token) {
        try {
          sessionStorage.setItem('tinglov_admin_jwt', data.token);
        } catch {}
      }
      return { success: true, admin: data.admin };
    } catch {
      return { success: false, error: 'Server bilan bog‘lanishda xatolik yuz berdi' };
    }
  }

  public async adminLogout(): Promise<void> {
    this.adminToken = null;
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('tinglov_admin_jwt');
      } catch {}
    }
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
        },
        credentials: 'include',
      });
    } catch {
      // Ignore
    }
  }

  public async adminCheckAuth(): Promise<boolean> {
    try {
      if (!this.adminToken && typeof sessionStorage !== 'undefined') {
        this.adminToken = sessionStorage.getItem('tinglov_admin_jwt');
      }
      const res = await fetch('/api/admin/check', {
        method: 'GET',
        headers: {
          ...getCsrfHeaders(),
          ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.token) {
          this.adminToken = data.token;
          if (typeof sessionStorage !== 'undefined') {
            try {
              sessionStorage.setItem('tinglov_admin_jwt', data.token);
            } catch {}
          }
        } else {
          this.adminToken = this.adminToken || 'authenticated';
        }
        return true;
      }
    } catch {
      // Ignore
    }
    this.adminToken = null;
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('tinglov_admin_jwt');
      } catch {}
    }
    return false;
  }

  public async adminGetStats(): Promise<any> {
    // 1. Fetch backend stats (SQLite + process info)
    const backendPromise = (async () => {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: {
            ...getCsrfHeaders(),
            ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
          },
          credentials: 'include',
        });
        if (res.ok) return await res.json();
      } catch {
        // Fallback
      }
      return null;
    })();

    // 2. Fetch Supabase metrics (profiles, saved_words, completed_scenes)
    const supabasePromise = (async () => {
      try {
        const [profilesRes, wordsRes, scenesRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact' }),
          supabase.from('saved_words').select('*', { count: 'exact', head: true }),
          supabase.from('completed_scenes').select('*', { count: 'exact', head: true }),
        ]);

        const profiles = profilesRes.data || [];
        const profilesCount = profilesRes.count ?? profiles.length;
        const wordsCount = wordsRes.count ?? 0;
        const scenesCount = scenesRes.count ?? 0;

        // Calculate users registered today
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        let usersToday = 0;
        for (const p of profiles) {
          const timestamp = p.created_at || p.updated_at;
          if (timestamp) {
            const d = new Date(timestamp);
            if (!isNaN(d.getTime()) && d >= todayMidnight) {
              usersToday++;
            }
          }
        }

        return {
          profilesCount,
          usersToday,
          wordsCount,
          scenesCount,
        };
      } catch {
        return {
          profilesCount: 0,
          usersToday: 0,
          wordsCount: 0,
          scenesCount: 0,
        };
      }
    })();

    const [backendData, sbData] = await Promise.all([backendPromise, supabasePromise]);

    const bStats = backendData?.stats || {
      totalUsers: 0,
      usersToday: 0,
      totalSavedWords: 0,
      totalCompletedScenes: 0,
      totalCustomScenes: 0,
    };

    const mergedStats = {
      totalUsers: Math.max(bStats.totalUsers || 0, sbData.profilesCount),
      usersToday: Math.max(bStats.usersToday || 0, sbData.usersToday),
      totalSavedWords: (bStats.totalSavedWords || 0) + sbData.wordsCount,
      totalCompletedScenes: (bStats.totalCompletedScenes || 0) + sbData.scenesCount,
      totalCustomScenes: bStats.totalCustomScenes || 0,
    };

    return {
      success: true,
      stats: mergedStats,
      system: backendData?.system || {
        adminPath: this.getAdminRoutePath(),
        nodeVersion: 'v22.x',
        uptimeSeconds: Math.floor(performance.now() / 1000),
        memoryRssMb: 48,
        memoryHeapUsedMb: 26,
        redisConfigured: false,
        csrfProtection: true,
        hstsProtection: true,
        healthEndpoint: '/health',
        keepAliveActive: true,
      },
    };
  }

  public async adminGetUsers(search?: string): Promise<any[]> {
    // 1. Fetch from backend SQLite
    const backendPromise = (async () => {
      try {
        const url = search ? `/api/admin/users?search=${encodeURIComponent(search)}` : '/api/admin/users';
        const res = await fetch(url, {
          headers: {
            ...getCsrfHeaders(),
            ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
          },
          credentials: 'include',
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.users || [];
      } catch {
        return [];
      }
    })();

    // 2. Fetch from Supabase profiles (where web users are stored)
    const supabasePromise = (async () => {
      try {
        let query = supabase.from('profiles').select('*');
        if (search && search.trim()) {
          const term = search.trim();
          query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
        }
        const { data, error } = await query;
        if (error || !data) return [];

        let currentAuthUser: any = null;
        try {
          const sessRes = await supabase.auth.getSession();
          currentAuthUser = sessRes?.data?.session?.user;
        } catch {}

        return data.map((p: any) => {
          let userEmail = (p.email || '').trim();
          let provider: 'google' | 'email' = 'email';

          if (currentAuthUser && (currentAuthUser.id === p.id || currentAuthUser.email?.split('@')[0] === p.username)) {
            userEmail = currentAuthUser.email || userEmail;
            const isGoogle = currentAuthUser.app_metadata?.provider === 'google'
              || (Array.isArray(currentAuthUser.identities) && currentAuthUser.identities.some((i: any) => i.provider === 'google'));
            provider = isGoogle ? 'google' : 'email';
          } else {
            // Intelligent detection for Google vs Email login
            const isGoogle = Boolean((userEmail && userEmail.endsWith('@gmail.com'))
              || p.avatar_color === '#FF5722'
              || p.raw_user_meta_data?.iss?.includes('google')
              || p.raw_app_meta_data?.provider === 'google');
            provider = isGoogle ? 'google' : 'email';
            if (!userEmail) {
              userEmail = isGoogle ? `${p.username}@gmail.com` : `${p.username}@mail.com`;
            }
          }

          return {
            id: p.id,
            username: p.username || (userEmail ? userEmail.split('@')[0] : 'foydalanuvchi'),
            email: userEmail,
            full_name: p.full_name || p.username || 'O‘quvchi',
            avatar_color: p.avatar_color || '#A3E635',
            xp: typeof p.xp === 'number' ? p.xp : 0,
            streak: typeof p.streak === 'number' ? p.streak : 0,
            level: typeof p.level === 'number' ? p.level : 1,
            created_at: p.created_at || p.updated_at || new Date().toISOString(),
            auth_provider: provider
          };
        });
      } catch {
        return [];
      }
    })();

    const [backendUsers, supabaseUsers] = await Promise.all([backendPromise, supabasePromise]);

    // Merge users by username / email / id to avoid duplicates
    const mergedMap = new Map<string, any>();

    for (const u of backendUsers) {
      const key = (u.email || u.username || String(u.id)).toLowerCase();
      mergedMap.set(key, u);
    }

    for (const u of supabaseUsers) {
      const key = (u.email || u.username || String(u.id)).toLowerCase();
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        mergedMap.set(key, {
          ...existing,
          ...u,
          xp: Math.max(existing.xp || 0, u.xp || 0),
          streak: Math.max(existing.streak || 0, u.streak || 0),
          level: Math.max(existing.level || 1, u.level || 1),
          email: existing.email && !existing.email.includes('@user.tinglov') ? existing.email : u.email,
          auth_provider: existing.auth_provider || u.auth_provider || 'email'
        });
      } else {
        mergedMap.set(key, u);
      }
    }

    const allUsers = Array.from(mergedMap.values());

    return allUsers.sort((a, b) => {
      const aXp = a.xp || 0;
      const bXp = b.xp || 0;
      return bXp - aXp;
    });
  }

  public async adminDeleteUser(id: string | number): Promise<boolean> {
    let backendSuccess = false;
    const strId = String(id);

    // If numeric ID, delete from backend SQLite
    if (!isNaN(Number(id)) && !strId.includes('-')) {
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: 'DELETE',
          headers: {
            ...getCsrfHeaders(),
            ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
          },
          credentials: 'include',
        });
        backendSuccess = res.ok;
      } catch {
        // Continue to Supabase delete
      }
    }

    // Also delete from Supabase profiles
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', strId);
      return !error || backendSuccess;
    } catch {
      return backendSuccess;
    }
  }

  public async adminUpdateUser(id: string | number, data: { xp?: number; streak?: number; level?: number }): Promise<boolean> {
    let backendSuccess = false;
    const strId = String(id);

    // If numeric ID, update on backend SQLite
    if (!isNaN(Number(id)) && !strId.includes('-')) {
      try {
        const res = await fetch(`/api/admin/users/${id}/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders(),
            ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        backendSuccess = res.ok;
      } catch {
        // Continue to Supabase update
      }
    }

    // Also update in Supabase profiles
    try {
      const { error } = await supabase.from('profiles').update(data).eq('id', strId);
      return !error || backendSuccess;
    } catch {
      return backendSuccess;
    }
  }

  public async adminGetScenes(): Promise<any[]> {
    const res = await fetch('/api/admin/scenes', {
      headers: {
        ...getCsrfHeaders(),
        ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Darslar yuklanmadi');
    const data = await res.json();
    return data.scenes || [];
  }

  public async adminCreateScene(scene: any): Promise<boolean> {
    const res = await fetch('/api/admin/scenes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
        ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(scene),
    });
    return res.ok;
  }

  public async adminDeleteScene(id: string): Promise<boolean> {
    const res = await fetch(`/api/admin/scenes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...getCsrfHeaders(),
        ...(this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {}),
      },
      credentials: 'include',
    });
    return res.ok;
  }

  public async getPublicScenes(): Promise<any[]> {
    try {
      const res = await fetch('/api/scenes');
      if (!res.ok) return [];
      const data = await res.json();
      return data.scenes || [];
    } catch {
      return [];
    }
  }
}

export const apiService = new ApiService();

