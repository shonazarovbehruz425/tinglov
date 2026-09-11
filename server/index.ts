import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import { apiLimiter, generateCaptchaChallenge } from './rateLimiter';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { csrfIssueMiddleware, csrfTokenHandler } from './middleware/csrf';
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { adminRoutes, ADMIN_PATH, CLOUDFLARE_R2_URL } from './routes/admin.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Request ID for tracing (returned in 404/500 + X-Request-Id header)
app.use((req, res, next) => {
  const requestId = randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// CORS allowlist from ALLOWED_ORIGINS (comma-separated), credentials enabled.
// origin:true (reflect any origin) + credentials is unsafe — only listed origins allowed.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / curl / mobile
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Security Headers (HSTS, Anti-Clickjacking, XSS Protection & Content Security Policy)
// Qiymatlar yagona manba: shared/securityHeaders.ts (kanonik CSP bilan bir xil)
app.use(securityHeadersMiddleware);

// CSRF: XSRF-TOKEN cookie'sini avtomatik berish (tekshiruv requireCsrf
// middleware'i route'larda — server/middleware/csrf.ts, yagona CSRF_COOKIE_NAME)
app.use(csrfIssueMiddleware);

// --------------------------------------------------------------------------
// UptimeRobot & Health Check Endpoints (Zero-overhead, rate-limit exempt)
// MUHIM: /api rate limiter'dan OLDIN ulanadi — monitorlar hech qachon 429
// olmasligi uchun (/health, /ping, /api/health, /api/ping).
// --------------------------------------------------------------------------
app.use(healthRoutes);

// Apply rate limiting to all /api endpoints (120 requests/minute per IP)
app.use('/api', apiLimiter);

// Endpoint to retrieve or refresh current CSRF token
app.get('/api/csrf-token', csrfTokenHandler);

// Endpoint to generate a new CAPTCHA security challenge
app.get('/api/captcha/new', (_req, res) => {
  const challenge = generateCaptchaChallenge();
  res.json(challenge);
});

// --------------------------------------------------------------------------
// Feature Routers (handler'lar routes fayllarida; middleware tartibi kanonik
// index.ts bilan aynan: registerLimiter / checkAuthRateLimit / requireCsrf /
// requireAuth / requireAdminAuth)
// - authRoutes: RELATIVE path'lar → /api/auth prefixi bilan ulanadi
// - userRoutes va adminRoutes: FULL path'lar → prefixsiz ulanadi
// --------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use(userRoutes);
app.use(adminRoutes);

// --------------------------------------------------------------------------
// Static SPA Serving (Render.com Web Service & Production)
// ADMIN_PATH / CLOUDFLARE_R2_URL yagona manbasidan foydalanadi
// (server/routes/admin.routes.ts eksporti).
// MUHIM: 404 handler'dan OLDIN turishi shart, aks holda barcha SPA marshrutlari
// (/, /dashboard, /practice va static fayllar) 404 JSON qaytarib yuboradi!
// --------------------------------------------------------------------------
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    },
  }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      try {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        const scriptInjection = `<script>window.__ADMIN_PATH__ = ${JSON.stringify(ADMIN_PATH)}; window.__CLOUDFLARE_R2_URL__ = ${JSON.stringify(CLOUDFLARE_R2_URL)};</script>`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${scriptInjection}</head>`);
        } else {
          html = `${scriptInjection}${html}`;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch {
        res.sendFile(indexHtmlPath);
      }
    } else {
      next();
    }
  });
}

// --------------------------------------------------------------------------
// Global 404 (JSON) + Central Error Handler (with requestId tracing)
// Faqat yuqoridagi static SPA va API routerlar tutmagan so‘rovlar uchun.
// --------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    error: 'So‘ralgan manzil topilmadi',
    path: req.path,
    requestId: (req as any).requestId || res.getHeader('X-Request-Id'),
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${(req as any).requestId || '-'}] Unhandled error:`, err?.message || err);
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Serverda ichki xatolik yuz berdi' : (err?.message || 'So‘rovni bajarishda xatolik'),
    requestId: (req as any).requestId || res.getHeader('X-Request-Id'),
  });
});

// --------------------------------------------------------------------------
// Automatic Self-Ping Keep-Alive Heartbeat for Render.com Free Tier
// --------------------------------------------------------------------------
function startKeepAliveHeartbeat(): void {
  const targetUrl = (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    process.env.KEEP_ALIVE_URL ||
    ''
  ).trim().replace(/\/+$/, '');

  // Render.com free tier sleeps after 15 minutes of inactivity.
  // We send a ping every 12 minutes (720,000 ms) to keep the web service awake.
  const PING_INTERVAL_MS = 12 * 60 * 1000;

  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    const healthUrl = `${targetUrl}/health`;
    console.log(`⏱️ Auto Keep-Alive faol: Har 12 daqiqada ${healthUrl} ga so‘rov yuboriladi.`);

    setInterval(async () => {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'Tinglov-KeepAlive-Heartbeat/1.0' }
        });
        if (response.ok) {
          console.log(`[KeepAlive] Render uyqudan saqlandi: ${healthUrl} (Status: ${response.status})`);
        }
      } catch (err: any) {
        console.warn(`[KeepAlive] So‘rov yuborishda xatolik: ${err?.message}`);
      }
    }, PING_INTERVAL_MS);
  } else {
    console.log('ℹ️ RENDER_EXTERNAL_URL topilmadi. UptimeRobot orqali https://<sizning-service>.onrender.com/health ga so‘rov yuboring.');
  }
}

// Boot-time admin credential validation (fail-closed, no hardcoded fallbacks)
// server/routes/admin.routes.ts importida bajariladi — yagona nusxa.

app.listen(PORT, () => {
  console.log(`🚀 Tinglov Web Service server ishga tushdi: http://localhost:${PORT}`);
  console.log(`🔒 Admin panel faol marshrut: ${ADMIN_PATH}`);
  console.log(`🩺 Health check monitoring URL: http://localhost:${PORT}/health (yoki /ping)`);
  startKeepAliveHeartbeat();
});
