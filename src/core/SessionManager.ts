/**
 * src/core/SessionManager.ts
 * ---------------------------------------------------------------------------
 * Foydalanuvchi sessiyasi holatini markazlashtirilgan tarzda boshqaradi.
 * `apiService.onAuthChange` asosida ishlaydi va istalgan komponentga obuna
 * bo'lish (subscribe) imkonini beradi.
 *
 * Bu — MovieListenApp ichidagi auth mantiqini ajratib olish uchun
 * ishlaydigan stub (functional placeholder).
 */

import { apiService, type AuthUser } from '../services/apiService';

export type AuthStateListener = (user: AuthUser | null) => void;

export interface SessionSnapshot {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export class SessionManager {
  private currentUser: AuthUser | null = null;
  private listeners = new Set<AuthStateListener>();
  private unsubscribe: (() => void) | null = null;
  private ready = false;

  /** Auth o'zgarishlarini tinglashni boshlaydi. */
  public init(): void {
    if (this.unsubscribe) return;
    this.currentUser = apiService.getCurrentUser();
    this.unsubscribe = apiService.onAuthChange((user) => {
      this.currentUser = user;
      this.ready = true;
      this.emit();
    });
  }

  /** Tinglashni to'xtatadi va resurslarni bo'shatadi. */
  public destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  public isAuthenticated(): boolean {
    return apiService.isAuthenticated();
  }

  public getUser(): AuthUser | null {
    return this.currentUser ?? apiService.getCurrentUser();
  }

  public getSnapshot(): SessionSnapshot {
    const user = this.getUser();
    return { user, isAuthenticated: !!user };
  }

  public isReady(): boolean {
    return this.ready;
  }

  /**
   * Boot-time readiness latch. MovieListenApp flips this to `true` once its
   * initial `waitForAuth()` resolution has completed (the two-phase auth
   * bootstrap previously tracked this with a private `isAuthReady` field).
   * Centralising it here makes SessionManager the single source of truth for
   * auth state; the AppRouter guard reads it via `isReady()`.
   */
  public markReady(): void {
    this.ready = true;
  }

  /**
   * Holat o'zgarganda chaqiriladigan listener ni ro'yxatdan o'tkazadi.
   *
   * `options.immediate` defaults to `true` (fires once with the current state,
   * preserving the original contract). Pass `{ immediate: false }` to react only
   * to *changes* — this mirrors the previous `apiService.onAuthChange(...)`
   * semantics and lets MovieListenApp consolidate onto a single auth listener
   * without re-running its boot-time reaction on registration.
   */
  public subscribe(
    listener: AuthStateListener,
    options?: { immediate?: boolean }
  ): () => void {
    this.listeners.add(listener);
    if (options?.immediate !== false) {
      listener(this.currentUser);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }
}

/** Global session manager nusxasi. */
export const sessionManager = new SessionManager();
