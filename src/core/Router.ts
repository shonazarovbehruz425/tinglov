/**
 * src/core/Router.ts
 * ---------------------------------------------------------------------------
 * Ilova ichki routing logikasi. Hozirgi src/main.ts dagi `routeCurrentUrl` /
 * `routeInitialUrl` / popstate+hashchange tinglovchilari mantiqiga mos keladi.
 *
 * Router MovieListenApp dan ajratilgan: u faqat yo'lni tahlil qiladi, auth
 * guard ni bajaradi va `RouterDelegate` orqali mos view'ni chaqiradi.
 * main.ts hali o'zgartirilmagan — kelajakda `appRouter.setDelegate(app)` orqali
 * ulash mumkin.
 */

import { apiService } from '../services/apiService';

export type RouteName =
  | 'landing'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'library'
  | 'practice'
  | 'profile'
  | 'settings'
  | 'admin';

export interface RouteDescriptor {
  name: RouteName;
  /** Statik yo'l. Dynamic admin uchun maxsus `__ADMIN__` belgisi ishlatiladi. */
  path: string;
  /** Foydalanuvchi autentifikatsiyasi talab qilinadimi. */
  auth: boolean;
  /** Faqat admin (dinamik ADMIN_PATH) uchun. */
  adminOnly?: boolean;
}

/** Asosiy yo'l jadvali. */
export const ROUTE_TABLE: RouteDescriptor[] = [
  { name: 'landing', path: '/', auth: false },
  { name: 'login', path: '/login', auth: false },
  { name: 'register', path: '/register', auth: false },
  { name: 'dashboard', path: '/dashboard', auth: true },
  { name: 'library', path: '/library', auth: true },
  { name: 'practice', path: '/practice', auth: true },
  { name: 'profile', path: '/profile', auth: true },
  { name: 'settings', path: '/settings', auth: true },
  // Dynamic admin route — yo'li env (VITE_ADMIN_PATH) orqali belgilanadi.
  { name: 'admin', path: '__ADMIN__', auth: false, adminOnly: true },
];

/** View'larni ko'rsatish uchun delegate interfeysi (MovieListenApp amalga oshiradi). */
export interface RouterDelegate {
  onLanding(push: boolean): void;
  onLogin(push: boolean): void;
  onRegister(push: boolean): void;
  onDashboard(push: boolean): void;
  onLibrary(push: boolean): void;
  onPractice(push: boolean): void;
  onProfile(push: boolean): void;
  onSettings(push: boolean): void;
  onAdmin(push: boolean): void;
  /** Himoyalangan route ga ruxsatsiz kirishda (login ga yo'naltirish uchun). */
  onUnauthorized(target: RouteName): void;
}

export class AppRouter {
  private delegate: RouterDelegate | null = null;
  private started = false;

  constructor(private readonly getAdminPath: () => string = () => apiService.getAdminRoutePath()) {}

  public setDelegate(delegate: RouterDelegate): void {
    this.delegate = delegate;
  }

  /** popstate/hashchange tinglovchilarini bir marta ulaydi va bosh yo'lni hal qiladi. */
  public start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('popstate', () => this.resolve(false));
    window.addEventListener('hashchange', () => this.resolve(false));
    this.resolve(false);
  }

  /** Tarixni yangilaydi (pushState yoki replaceState). */
  public navigate(path: string, push = true, title?: string): void {
    try {
      const current = window.location.pathname + window.location.search;
      if (current !== path) {
        if (push) {
          window.history.pushState({ path }, title || '', path);
        } else {
          window.history.replaceState({ path }, title || '', path);
        }
      }
      if (title) document.title = title;
    } catch {
      try {
        window.location.hash = path;
      } catch {
        /* ignore */
      }
    }
  }

  private normalizePath(raw: string): string {
    return raw.replace(/\/+$/, '') || '/';
  }

  private resolveAdminPath(): string {
    const p = this.getAdminPath();
    return p.startsWith('/') ? p : '/' + p;
  }

  /** Joriy URL ni tahlil qiladi, auth guard ni bajaradi va delegate ni chaqiradi. */
  public resolve(push: boolean): RouteName {
    // OAuth hash tozalash (access_token= / error=)
    if (window.location.hash.includes('access_token=') || window.location.hash.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname || '/');
    }

    const rawPath = this.normalizePath(window.location.pathname);
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    // search params faqat /practice uchun kerak (scene id)
    const search = new URLSearchParams(window.location.search);

    // 0. Dynamic Admin Route
    const adminPath = this.resolveAdminPath();
    const adminHash = adminPath.replace(/^\//, '').toLowerCase();
    if (rawPath === adminPath || rawHash === adminHash) {
      this.delegate?.onAdmin(push);
      return 'admin';
    }

    // 1. Auth routes
    if (rawPath === '/login' || rawHash === 'login' || rawPath === '/auth') {
      if (apiService.isAuthenticated()) {
        this.delegate?.onDashboard(push);
        return 'dashboard';
      }
      this.delegate?.onLogin(push);
      return 'login';
    }
    if (rawPath === '/register' || rawHash === 'register') {
      if (apiService.isAuthenticated()) {
        this.delegate?.onDashboard(push);
        return 'dashboard';
      }
      this.delegate?.onRegister(push);
      return 'register';
    }

    // 2. Landing
    if (rawPath === '/' && (!rawHash || rawHash === 'landing')) {
      this.delegate?.onLanding(push);
      return 'landing';
    }

    // 3. Settings
    if (rawPath === '/settings' || rawHash === 'settings') {
      if (!apiService.isAuthenticated()) {
        this.delegate?.onUnauthorized('settings');
        return 'login';
      }
      this.delegate?.onSettings(push);
      return 'settings';
    }

    // 4. Profile
    if (rawPath === '/profile' || rawHash === 'profile') {
      if (!apiService.isAuthenticated()) {
        this.delegate?.onUnauthorized('profile');
        return 'login';
      }
      this.delegate?.onProfile(push);
      return 'profile';
    }

    // 5. Practice
    if (rawPath === '/practice' || rawPath.startsWith('/practice/') || rawHash.startsWith('practice')) {
      if (!apiService.isAuthenticated()) {
        this.delegate?.onUnauthorized('practice');
        return 'login';
      }
      this.delegate?.onPractice(push);
      return 'practice';
    }

    // 6. Dashboard / Library
    if (rawPath === '/dashboard' || rawPath === '/library' || rawHash === 'dashboard' || rawHash === 'library') {
      if (!apiService.isAuthenticated()) {
        this.delegate?.onUnauthorized('dashboard');
        return 'login';
      }
      this.delegate?.onLibrary(push);
      return 'library';
    }

    // 7. Fallback
    if (apiService.isAuthenticated()) {
      this.delegate?.onDashboard(push);
      return 'library';
    }
    this.delegate?.onLanding(push);
    return 'landing';
  }
}

/** Global router nusxasi (kelajakda main.ts dan foydalanish uchun). */
export const appRouter = new AppRouter();
