/**
 * Secure Logger Service for Tinglov
 * Suppresses debug & operational logs in production to prevent information disclosure.
 */

class LoggerService {
  private isDevelopment(): boolean {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return Boolean(import.meta.env.DEV);
    }
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  }

  private formatMessage(prefix: string, message: string): string {
    return `[Tinglov:${prefix}] ${message}`;
  }

  /**
   * Verbose debug logging (Development only)
   */
  public debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment()) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  /**
   * Informational logs (Development only)
   */
  public info(message: string, ...args: unknown[]): void {
    if (this.isDevelopment()) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  /**
   * Warning logs (Development only)
   */
  public warn(message: string, ...args: unknown[]): void {
    if (this.isDevelopment()) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  /**
   * Error logs (Development only, sanitized to avoid leaking sensitive credentials/stack)
   */
  public error(message: string, error?: unknown): void {
    if (this.isDevelopment()) {
      console.error(this.formatMessage('ERROR', message), error);
    }
    // In production, errors are suppressed from DevTools console to prevent information leakage
  }
}

export const logger = new LoggerService();
