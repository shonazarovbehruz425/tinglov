// MIGRATION: server/index.ts dagi health/ping endpoint'lari (135-176 qatorlar)
// shu faylga ko'chirildi. Qadam: index.ts da eski alohida app.get/.head
// qatorlarini o'chirib, `app.use(healthRoutes)` bilan ulash.
// MUHIM: bu router `app.use('/api', apiLimiter)` DAN OLDIN ulanishi kerak
// (UptimeRobot / uptime monitorlari hech qachon 429 olmasligi uchun).

import { Router, type Request, type Response } from 'express';

const healthCheckHandler = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Render-KeepAlive', 'active');

  res.status(200).json({
    status: 'ok',
    service: 'tinglov',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null,
    message: 'Tinglov server is awake and healthy',
  });
};

const pingHandler = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('pong');
};

const pingHeadHandler = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end();
};

export const healthRoutes = Router();

healthRoutes.get('/health', healthCheckHandler);
healthRoutes.head('/health', healthCheckHandler);
healthRoutes.get('/ping', pingHandler);
healthRoutes.head('/ping', pingHeadHandler);
healthRoutes.get('/api/health', healthCheckHandler);
healthRoutes.head('/api/health', healthCheckHandler);
healthRoutes.get('/api/ping', pingHandler);
healthRoutes.head('/api/ping', pingHeadHandler);
