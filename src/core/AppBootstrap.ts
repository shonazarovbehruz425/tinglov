/**
 * src/core/AppBootstrap.ts
 * ---------------------------------------------------------------------------
 * Ilovani ishga tushirish uchun plumbing (infratuzilma).
 * MovieListenApp ni main.ts dan ajratib, Router + SessionManager bilan bog'lash
 * uchun ishlaydigan stub.
 *
 * Hozircha MovieListenApp main.ts ichida yaratilgani uchun bootstrap faqat
 * router/session infratuzilmasini tayyorlaydi va delegate'ni ro'yxatdan
 * o'tkazish uchun hook beradi. Kelajakda main.ts shu funksiyani chaqirib,
 * MovieListenApp ni `RouterDelegate` sifatida uzatadi.
 */

import { AppRouter, type RouterDelegate } from './Router';
import { SessionManager } from './SessionManager';

export interface BootstrapOptions {
  router?: AppRouter;
  session?: SessionManager;
  delegate?: RouterDelegate;
}

export class AppBootstrap {
  public readonly router: AppRouter;
  public readonly session: SessionManager;

  constructor(options: BootstrapOptions = {}) {
    this.router = options.router ?? new AppRouter();
    this.session = options.session ?? new SessionManager();
    if (options.delegate) {
      this.router.setDelegate(options.delegate);
    }
  }

  public init(): void {
    this.session.init();
    this.router.start();
  }

  public getSnapshot() {
    return this.session.getSnapshot();
  }
}

/**
 * Ilovani ishga tushuruvchi yordamchi funksiya.
 * Kelajakda: `bootstrapApp(appInstance)` orqali MovieListenApp ni ulash.
 */
export function bootstrapApp(delegate: RouterDelegate, options: BootstrapOptions = {}): AppBootstrap {
  const bootstrap = new AppBootstrap({ ...options, delegate });
  bootstrap.init();
  return bootstrap;
}
