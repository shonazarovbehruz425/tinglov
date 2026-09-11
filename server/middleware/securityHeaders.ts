// MIGRATION: server/index.ts dagi "Security Headers" middleware (88-110 qatorlar)
// shu faylga ko'chirildi. Qadam: index.ts da eski anonim middleware o'rniga
//   import { securityHeadersMiddleware } from './middleware/securityHeaders';
//   app.use(securityHeadersMiddleware);
// yozib ulash (shared/securityHeaders dan qiymatlar olinadi).

import type { Request, Response, NextFunction } from 'express';
import { SECURITY_HEADERS } from '../../shared/securityHeaders';

/**
 * HSTS, Anti-Clickjacking, XSS Protection va Content-Security-Policy
 * sarlavhalarini har bir javobga qo'shadi.
 */
export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Strict-Transport-Security', SECURITY_HEADERS['Strict-Transport-Security']);
  res.setHeader('X-Content-Type-Options', SECURITY_HEADERS['X-Content-Type-Options']);
  res.setHeader('X-Frame-Options', SECURITY_HEADERS['X-Frame-Options']);
  res.setHeader('X-XSS-Protection', SECURITY_HEADERS['X-XSS-Protection']);
  res.setHeader('Referrer-Policy', SECURITY_HEADERS['Referrer-Policy']);
  res.setHeader('Permissions-Policy', SECURITY_HEADERS['Permissions-Policy']);
  res.setHeader('Content-Security-Policy', SECURITY_HEADERS['Content-Security-Policy']);
  next();
}
