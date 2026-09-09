export interface AuthUser {
  id: number;
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
  savedWords: Array<{ id: number; word: string; translation: string | null; scene_title: string | null }>;
  completedScenes: Array<{ id: number; scene_id: string; accuracy: number; wpm: number }>;
}

const TOKEN_KEY = 'tinglov_auth_token';

class ApiService {
  private token: string | null = null;
  private currentUser: AuthUser | null = null;
  private onAuthChangeCallbacks: Array<(user: AuthUser | null) => void> = [];

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
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

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  public async register(params: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Ro‘yxatdan o‘tishda xatolik yuz berdi' };
      }

      if (data.token && data.user) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem(TOKEN_KEY, data.token);
        this.notifyAuthChange();
      }

      return data;
    } catch (e: any) {
      return { error: 'Server bilan bog‘lanishda xatolik yuz berdi' };
    }
  }

  public async login(params: {
    identifier: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Login yoki parol noto‘g‘ri' };
      }

      if (data.token && data.user) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem(TOKEN_KEY, data.token);
        this.notifyAuthChange();
      }

      return data;
    } catch (e: any) {
      return { error: 'Server bilan bog‘lanishda xatolik yuz berdi' };
    }
  }

  public async getMe(): Promise<MeResponse | null> {
    if (!this.token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        // Invalid or expired token
        this.logout();
        return null;
      }
      const data: MeResponse = await res.json();
      this.currentUser = data.user;
      this.notifyAuthChange();
      return data;
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
    if (!this.token) return null;

    try {
      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.user) {
        this.currentUser = data.user;
      }
      return data;
    } catch {
      return null;
    }
  }

  public async saveWord(word: string, translation?: string, sceneTitle?: string): Promise<void> {
    if (!this.token) return;
    try {
      await fetch('/api/user/words', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ action: 'save', word, translation, sceneTitle }),
      });
    } catch {
      // Ignore background sync error
    }
  }

  public async deleteWord(word: string): Promise<void> {
    if (!this.token) return;
    try {
      await fetch('/api/user/words', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ action: 'delete', word }),
      });
    } catch {
      // Ignore
    }
  }

  public async getLeaderboard(): Promise<Array<{
    id: number;
    username: string;
    full_name: string;
    avatar_color: string;
    xp: number;
    streak: number;
    level: number;
  }>> {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) return [];
      const data = await res.json();
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }

  public logout(): void {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(TOKEN_KEY);
    this.notifyAuthChange();
  }
}

export const apiService = new ApiService();
