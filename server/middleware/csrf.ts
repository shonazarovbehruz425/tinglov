// server/index.ts dagi CSRF sozlamalari (cookie issue + requireCsrf) va
// GET /api/csrf-token endpoint'i shu faylga ko'chirildi. CSRF_COOKIE_NAME
// konstantasi va cookie opsionlari shu yerda YAGONA manba hisoblanadi.
//
// index.ts da ulanishi:
//   import { csrfIssueMiddleware, csrfTokenHandler } from './middleware/csrf';
//   app.use(csrfIssueMiddleware);            // cookie yo'qsa avtomatik berish
//   app.get('/api/csrf-token', csrfTokenHandler);
// Route'larda: router.post('/login', requireCsrf, loginHandler)

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
 * Mavjud CSRF cookie tokenini qaytaradi; yo'q bo'lsa yangi token yaratib,
 * cookie'ni beradi. csrfIssueMiddleware va csrfTokenHandler shu yagona
 * mantiqdan foydalanadi (index.ts dagi ikki inline nusxa bilan aynan bir xil).
 */
export function getOrCreateCsrfToken(req: Request, res: Response): string {
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
  }
  return csrfToken;
}

/**
 * csrfIssueMiddleware — agar CSRF cookie mavjud bo'lmasa avtomatik tarzda beradi.
 * Barcha so'rovlarga nisbatan ishlatiladi.
 */
export function csrfIssueMiddleware(req: Request, res: Response, next: NextFunction): void {
  getOrCreateCsrfToken(req, res);
  next();
}

/** GET /api/csrf-token — joriy CSRF tokenni qaytaradi (yo'qsa yangisini beradi). */
export function csrfTokenHandler(req: Request, res: Response): void {
  const token = getOrCreateCsrfToken(req, res);
  res.json({ csrfToken: token });
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

  // Authorization Bearer header is immune to browser CSRF attacks
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
