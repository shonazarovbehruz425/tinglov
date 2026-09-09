import { supabase } from './supabaseClient';

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
}

export interface AuthResponse {
  message?: string;
  token?: string;
  user?: AuthUser;
  error?: string;
}

export interface MeResponse {
  user: AuthUser;
  savedWords: Array<{ id: string | number; word: string; translation: string | null; scene_title: string | null }>;
  completedScenes: Array<{ id: string | number; scene_id: string; accuracy: number; wpm: number }>;
}

const TOKEN_KEY = 'tinglov_auth_token';

class ApiService {
  private token: string | null = null;
  private currentUser: AuthUser | null = null;
  private onAuthChangeCallbacks: Array<(user: AuthUser | null) => void> = [];

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);

    // Listen to real-time auth state changes in Supabase
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        this.token = session.access_token;
        localStorage.setItem(TOKEN_KEY, session.access_token);
        await this.loadUserProfile(session.user);
      } else {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem(TOKEN_KEY);
        this.notifyAuthChange();
      }
    });

    // Check existing active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        this.token = session.access_token;
        localStorage.setItem(TOKEN_KEY, session.access_token);
        await this.loadUserProfile(session.user);
      }
    }).catch(() => {});
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return !!this.token;
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
      };

      this.currentUser = user;
      this.notifyAuthChange();
      return user;
    } catch {
      return null;
    }
  }

  public async register(params: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<AuthResponse> {
    try {
      const cleanEmail = params.email.trim().toLowerCase();
      const cleanUsername = params.username.trim().toLowerCase();
      const cleanFullName = (params.fullName || '').trim();

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
        password: params.password,
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
          this.token = data.session.access_token;
          localStorage.setItem(TOKEN_KEY, data.session.access_token);
        }

        const authUser: AuthUser = {
          ...newProfile,
          email: cleanEmail,
          last_active_date: new Date().toISOString(),
          created_at: data.user.created_at || new Date().toISOString(),
        };

        this.currentUser = authUser;
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
  }): Promise<AuthResponse> {
    try {
      let email = params.identifier.trim().toLowerCase();

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
            // If email column isn't in profiles table, prompt the user
            return { error: 'Iltimos, tizimga kirish uchun to‘liq Email manzilingizni kiriting.' };
          }
        } catch {
          return { error: 'Iltimos, tizimga kirish uchun to‘liq Email manzilingizni kiriting.' };
        }
      }

      // Supabase Sign In with Password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: params.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Email yoki parol noto‘g‘ri kiritildi.' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: 'Email tasdiqlanmagan. Iltimos, emailingizga yuborilgan havolani bosing.' };
        }
        return { error: error.message };
      }

      if (data.user && data.session) {
        this.token = data.session.access_token;
        localStorage.setItem(TOKEN_KEY, data.session.access_token);
        const user = await this.loadUserProfile(data.user);

        return {
          message: 'Xush kelibsiz!',
          token: this.token,
          user: user || undefined,
        };
      }

      return { error: 'Kirishda xatolik yuz berdi' };
    } catch (e: any) {
      return { error: e.message || 'Server bilan bog‘lanishda xatolik yuz berdi' };
    }
  }

  public async getMe(): Promise<MeResponse | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return null;
      }

      const user = await this.loadUserProfile(session.user);
      if (!user) return null;

      // Fetch saved words from Supabase
      const { data: words } = await supabase
        .from('saved_words')
        .select('*')
        .eq('user_id', user.id);

      // Fetch completed scenes from Supabase
      const { data: scenes } = await supabase
        .from('completed_scenes')
        .select('*')
        .eq('user_id', user.id);

      return {
        user,
        savedWords: (words as any) || [],
        completedScenes: (scenes as any) || [],
      };
    } catch {
      return null;
    }
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

      return { success: true };
    } catch {
      return null;
    }
  }

  public async saveWord(word: string, translation?: string, sceneTitle?: string): Promise<void> {
    if (!this.currentUser) return;
    try {
      await supabase.from('saved_words').insert({
        user_id: this.currentUser.id,
        word: word.trim(),
        translation: translation || null,
        scene_title: sceneTitle || null,
      });
    } catch {
      // Ignore background error
    }
  }

  public async deleteWord(word: string): Promise<void> {
    if (!this.currentUser) return;
    try {
      await supabase
        .from('saved_words')
        .delete()
        .eq('user_id', this.currentUser.id)
        .eq('word', word.trim());
    } catch {
      // Ignore
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
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(TOKEN_KEY);
    this.notifyAuthChange();
  }
}

export const apiService = new ApiService();
