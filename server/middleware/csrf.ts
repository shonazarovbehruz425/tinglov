// MIGRATION: server/index.ts dagi CSRF sozlamalari va tekshiruv middleware'lari
// (112-225 qatorlar) shu faylga ko'chirildi. Qadam:
//   import { csrfIssueMiddleware, requireCsrf, CSRF_COOKIE_NAME } from './middleware/csrf';
//   app.use(csrfIssueMiddleware);                      // cookie yo'qsa avtomatik berish
//   // route'larda: router.post('/login', requireCsrf, loginHandler)

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** CSRF token cookie nomi (brauzer JS o'qishi uchun httpOnly:false). */
export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

/** So'rov sarlavhasida kutilayotgan CSRF token nomi. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** CSRF cookie muddati (24 soat). */
const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

/** Kriptografik jihatdan xavfsiz tasodifiy CSRF token yaratadi. */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Client JS uchun ochiq (X-CSRF-Token sarlavhasiga qo'yish uchun)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_COOKIE_MAX_AGE,
  });
}

/**
 * csrfIssueMiddleware — agar CSRF cookie mavjud bo'lmasa avtomatik tarzda beradi.
 * Barcha so'rovlarga nisbatan ishlatiladi.
 */
export function csrfIssueMiddleware(req: Request, res: Response, next: NextFunction): void {
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
  }
  next();
}

/**
 * requireCsrf — holat o'zgartiruvchi (state-changing) so'rovlar uchun CSRF
 * tekshiruvi. GET/HEAD/OPTIONS va `Authorization: Bearer` sarlavhali so'rovlar
 * brauzer CSRF hujumlariga qarshi immun.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken =
    req.headers[CSRF_HEADER_NAME] ||
    req.headers['x-xsrf-token'] ||
    req.body?._csrf;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      error: 'CSRF token xatosi yoki yaroqsiz. Sahifani yangilab qayta urinib ko‘ring.',
    });
    return;
  }

  next();
}
