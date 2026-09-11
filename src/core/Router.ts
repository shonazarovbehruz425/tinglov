/**
 * src/core/Router.ts
 * ---------------------------------------------------------------------------
 * Ilova ichki routing engine. src/main.ts dagi `routeCurrentUrl` /
 * `routeInitialUrl` / popstate+hashchange tinglovchilari mantiqini to'liq
 * o'ziga oldi: AppRouter yo'lni tahlil qiladi, auth guard (ikki-bosqichli
 * `waitForAuth` sharti bilan) ni bajaradi va `RouterDelegate` orqali mos view'ni
 * chaqiradi.
 *
 * MovieListenApp `RouterDelegate` ni amalga oshiradi va `AppBootstrap` orqali
 * ulanadi. Xatti-harakat oldingi main.ts bilan aynan mos: OAuth hash/param
 * tozalash, dinamik ADMIN_PATH, file:// fallback va document.title yangilash
 * delegate/updateUrl tomonida saqlanadi.
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
  /**
   * OAuth qaytishida `?error=`/`?error_description=`/`?error_code=` parametrleri
   * bo'lsa chaqiriladi (main.ts dagi "Google orqali kirishda xatolik" alertini
   * saqlab qolish uchun). Ixtiyoriy — delegate uni login sahifasini ochib,
   * keyin alert ko'rsatish orqali amalga oshiradi.
   */
  onAuthError?(message: string): void;
}

export interface AppRouterOptions {
  /** Dinamik ADMIN_PATH manbasi (default: apiService.getAdminRoutePath). */
  getAdminPath?: () => string;
  /**
   * `waitForAuth` ikki-bosqichli init tugmasi. Himoyalangan route'larda
   * auth yakunlanmaguncha foydalanuvchini login'ga otmaslik uchun ishlatiladi
   * (main.ts dagi eski `isAuthReady` mantiqini aynan saqlaydi).
   */
  isAuthReady?: () => boolean;
}

export class AppRouter {
  private delegate: RouterDelegate | null = null;
  private listenersAttached = false;
  private resolved = false;
  private readonly getAdminPath: () => string;
  private readonly isAuthReady: () => boolean;

  constructor(options: AppRouterOptions = {}) {
    this.getAdminPath = options.getAdminPath ?? (() => apiService.getAdminRoutePath());
    this.isAuthReady = options.isAuthReady ?? (() => true);
  }

  public setDelegate(delegate: RouterDelegate): void {
    this.delegate = delegate;
  }

  /** popstate/hashchange tinglovchilarini faqat BIR marta ulaydi (idempotent). */
  public attachHistoryListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    window.addEventListener('popstate', () => this.resolve(false));
    window.addEventListener('hashchange', () => this.resolve(false));
  }

  /** Tinglovchilarni ulaydi va bosh yo'lni (sync) hal qiladi. */
  public start(): void {
    this.attachHistoryListeners();
    if (this.resolved) return;
    this.resolved = true;
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

  /**
   * Himoyalangan route uchun main.ts `checkAndEnforceAuth()` semantikasini
   * aynan qaytaradi:
   *  - autentifikatsiya bo'lsa → davom et (true)
   *  - auth yakunlangan (`isAuthReady`) va kirilmagan → onUnauthorized (login ga
   *    yo'naltirish delegate da) va to'xta (false)
   *  - auth hali yakunlanmagan (ikki-bosqichli waitForAuth) → hech narsa
   *    qilmay to'xta (false) — bu eski xatti-harakatni saqlaydi va avval
   *    scaffold'da yo'q edi (premature redirect ning oldini oladi).
   */
  private enforce(target: RouteName): boolean {
    if (apiService.isAuthenticated()) return true;
    if (this.isAuthReady()) {
      this.delegate?.onUnauthorized(target);
    }
    return false;
  }

  /**
   * Boshlang'ich (initial) yo'l ochiqmi — ya'ni server auth tugashini kutmasdan
   * birinchi navigation ni darhol qilish mumkinmi. main.ts dagi `routeInitialUrl`
   * hisoblagan `isPublic` shartini aynan takrorlaydi.
   */
  public isPublicBootRoute(): boolean {
    const rawPath = this.normalizePath(window.location.pathname);
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const adminPath = this.resolveAdminPath();
    const adminHash = adminPath.replace(/^\//, '').toLowerCase();
    return (
      rawPath === '/' ||
      rawPath === '/login' ||
      rawPath === '/register' ||
      rawPath === adminPath ||
      rawHash === 'landing' ||
      rawHash === 'login' ||
      rawHash === 'register' ||
      rawHash === adminHash
    );
  }

  /** Joriy URL ni tahlil qiladi, auth guard ni bajaradi va delegate ni chaqiradi. */
  public resolve(push: boolean): RouteName {
    const delegate = this.delegate;

    // OAuth hash tozalash (access_token= / error=) — main.ts routeCurrentUrl 0-qadam
    if (window.location.hash.includes('access_token=') || window.location.hash.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname || '/');
    }

    // OAuth xatolik parametrleri (?error= / ?error_description= / ?error_code=)
    // Supabase/Google qaytargan xatolikni login sahifasida alert ko'rsatish.
    // (Scaffold'da yo'q edi — main.ts xatti-harakatini saqlash uchun qo'shildi.)
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('error') || searchParams.has('error_description') || searchParams.has('error_code')) {
      const errorMsg = searchParams.get('error_description') || searchParams.get('error') || 'Kirishda xatolik yuz berdi';
      window.history.replaceState(null, '', '/login');
      if (delegate?.onAuthError) {
        delegate.onAuthError(decodeURIComponent(errorMsg).replace(/\+/g, ' '));
      } else {
        delegate?.onLogin(false);
      }
      return 'login';
    }

    const rawPath = this.normalizePath(window.location.pathname);
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();

    // 0. Dynamic Admin Route (ADMIN_PATH env orqali) — auth talab qilmaydi
    const adminPath = this.resolveAdminPath();
    const adminHash = adminPath.replace(/^\//, '').toLowerCase();
    if (rawPath === adminPath || rawHash === adminHash) {
      delegate?.onAdmin(push);
      return 'admin';
    }

    // 1. Explicit Auth routes (/login, /register, /auth)
    if (rawPath === '/login' || rawHash === 'login' || rawPath === '/auth') {
      if (apiService.isAuthenticated()) {
        delegate?.onDashboard(push);
        return 'dashboard';
      }
      delegate?.onLogin(push);
      return 'login';
    }
    if (rawPath === '/register' || rawHash === 'register') {
      if (apiService.isAuthenticated()) {
        delegate?.onDashboard(push);
        return 'dashboard';
      }
      delegate?.onRegister(push);
      return 'register';
    }

    // 2. Landing Page at Root (/)
    if (rawPath === '/' && (!rawHash || rawHash === 'landing')) {
      delegate?.onLanding(push);
      return 'landing';
    }

    // 3. Settings View (/settings) — protected
    if (rawPath === '/settings' || rawHash === 'settings') {
      if (!this.enforce('settings')) return 'login';
      delegate?.onSettings(push);
      return 'settings';
    }

    // 4. Profile View (/profile) — protected
    if (rawPath === '/profile' || rawHash === 'profile') {
      if (!this.enforce('profile')) return 'login';
      delegate?.onProfile(push);
      return 'profile';
    }

    // 5. Practice View (/practice?scene=... or /practice/...) — protected
    //    (scene + challenge extraction delegate.onPractice ichida)
    if (rawPath === '/practice' || rawPath.startsWith('/practice/') || rawHash.startsWith('practice')) {
      if (!this.enforce('practice')) return 'login';
      delegate?.onPractice(push);
      return 'practice';
    }

    // 6. Dashboard / Library View (/dashboard or /library) — protected
    if (rawPath === '/dashboard' || rawPath === '/library' || rawHash === 'dashboard' || rawHash === 'library') {
      if (!this.enforce('library')) return 'login';
      delegate?.onLibrary(push);
      return 'library';
    }

    // 7. Fallback: auth bo'lsa dashboard, aks holda landing
    if (apiService.isAuthenticated()) {
      delegate?.onDashboard(push);
      return 'dashboard';
    }
    delegate?.onLanding(push);
    return 'landing';
  }
}

/** Global router nusxasi (kelajakda main.ts dan foydalanish uchun). */
export const appRouter = new AppRouter();
