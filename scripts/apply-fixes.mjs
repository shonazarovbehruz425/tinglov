// Bug & security fix script for Tinglov project
// Run: node scripts/apply-fixes.mjs
import fs from 'node:fs';

const report = [];
function patch(file, oldText, newText, label) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(oldText)) {
    report.push(`SKIP (not found): ${label} -> ${file}`);
    return;
  }
  text = text.replace(oldText, newText);
  fs.writeFileSync(file, text, 'utf8');
  report.push(`OK: ${label} -> ${file}`);
}

// ============================================================
// 1. server/index.ts — hardening
// ============================================================
const SERVER = 'server/index.ts';

// 1a. CORS whitelist instead of origin: true
patch(
  SERVER,
  "app.use(cors({\n  origin: true,\n  credentials: true,\n}));",
  `// CORS whitelist: ONLY explicitly allowed origins may send credentialed (cookie) requests.
// In production the SPA is served by this same server (same-origin), so cross-origin
// access must be granted explicitly via the ALLOWED_ORIGINS env variable (comma separated).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\\/+$/, ''))
  .filter(Boolean);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const corsOptionsDelegate: cors.CorsOptionsDelegate = (req, callback) => {
  const rawOrigin = req.headers.origin;
  const requestOrigin = typeof rawOrigin === 'string' ? rawOrigin.replace(/\\/+$/, '') : '';

  // Production: same-origin only, unless ALLOWED_ORIGINS explicitly lists the origin.
  // Development: allow all local origins (Vite dev server, etc.)
  const isAllowed = IS_PRODUCTION
    ? ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(requestOrigin)
    : true;

  callback(null, { origin: isAllowed, credentials: isAllowed });
};

app.use(cors(corsOptionsDelegate));`,
  'FIX-1a: CORS whitelist (origin: true -> delegate)'
);

// 1b. Remove insecure default admin credentials
patch(
  SERVER,
  "const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';\nconst ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tinglov_admin_2026';",
  `// NOTE: No insecure default credentials. In production ADMIN_USERNAME / ADMIN_PASSWORD
// MUST be provided via environment variables, otherwise the admin panel stays disabled.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const IS_ADMIN_CREDENTIALS_CONFIGURED = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD);`,
  'FIX-1b: Remove insecure default admin credentials'
);

// FIX-1c appended below via marker

// 1c. Admin login: CSRF + brute-force lockout + CAPTCHA
patch(
  SERVER,
  "// C. Admin Login\napp.post('/api/admin/login', (req, res) => {\n  const { username, password } = req.body || {};\n  if (!username || !password) {\n    res.status(400).json({ error: 'Login va parol kiritilishi shart' });\n    return;\n  }\n\n  const trimmedUser = String(username).trim();\n  const trimmedPass = String(password).trim();\n\n  if (trimmedUser !== ADMIN_USERNAME || trimmedPass !== ADMIN_PASSWORD) {\n    res.status(401).json({ error: 'Noto\\u2018g\\u2018ri admin login yoki parol' });\n    return;\n  }",
  "// C. Admin Login (CSRF-protected + brute-force lockout + CAPTCHA)\napp.post('/api/admin/login', requireCsrf, checkAuthRateLimit, async (req, res) => {\n  if (!IS_ADMIN_CREDENTIALS_CONFIGURED) {\n    res.status(503).json({ error: 'Admin panel sozlanmagan: ADMIN_USERNAME va ADMIN_PASSWORD muhit o\\u2018zgaruvchilari talab qilinadi' });\n    return;\n  }\n\n  const { username, password } = req.body || {};\n  if (!username || !password) {\n    res.status(400).json({ error: 'Login va parol kiritilishi shart' });\n    return;\n  }\n\n  const ip = getClientIp(req);\n  const adminIpKey = `auth:ip:admin:${ip}`;\n  const adminUserKey = `auth:user:admin:${String(username).trim().toLowerCase()}`;\n\n  const requiresCaptcha = Boolean((req as any).requiresCaptcha);\n  let captchaOk = true;\n  if (requiresCaptcha) {\n    const { captchaToken, captchaAnswer } = req.body || {};\n    captchaOk = Boolean(captchaToken && captchaAnswer !== undefined && verifyCaptchaSolution(captchaToken, captchaAnswer));\n  }\n\n  const trimmedUser = String(username).trim();\n  const trimmedPass = String(password).trim();\n\n  const recordAdminFailure = async () => {\n    const ipFail = await recordAuthFailure(adminIpKey);\n    const userFail = await recordAuthFailure(adminUserKey);\n    const maxFail = Math.max(ipFail.failures, userFail.failures);\n    const maxDelay = Math.max(ipFail.delayMs, userFail.delayMs);\n    if (maxDelay > 0 && maxDelay <= 8000) {\n      await new Promise((r) => setTimeout(r, maxDelay));\n    }\n    return maxFail;\n  };\n\n  if (!captchaOk) {\n    const maxFail = await recordAdminFailure();\n    res.status(400).json({\n      error: 'Xavfsizlik kodi (CAPTCHA) noto\\u2018g\\u2018ri yoki kiritilmadi. Iltimos, qaytadan yeching.',\n      requiresCaptcha: true,\n    });\n    return;\n  }\n\n  if (trimmedUser !== ADMIN_USERNAME || trimmedPass !== ADMIN_PASSWORD) {\n    const maxFail = await recordAdminFailure();\n    res.status(401).json({\n      error: 'Noto\\u2018g\\u2018ri admin login yoki parol',\n      requiresCaptcha: maxFail >= 3,\n    });\n    return;\n  }\n\n  await resetAuthFailure(adminIpKey);\n  await resetAuthFailure(adminUserKey);",
  'FIX-1c: Admin login CSRF + lockout + CAPTCHA'
);

// 1d. Do not leak admin path publicly
patch(
  SERVER,
  "// A. Public endpoint to check active admin path and R2 streaming config\napp.get('/api/admin/config', (_req, res) => {\n  res.json({\n    adminPath: ADMIN_PATH,\n    cloudflareR2Url: CLOUDFLARE_R2_URL\n  });\n});",
  `// A. Public endpoint for R2 streaming config only.
// SECURITY: adminPath is intentionally NOT exposed publicly anymore \u2014
// the admin route is resolved client-side from window.__ADMIN_PATH__ injection (same-origin HTML)
// and never from an unauthenticated API response.
app.get('/api/admin/config', (_req, res) => {
  res.json({
    cloudflareR2Url: CLOUDFLARE_R2_URL
  });
});`,
  'FIX-1d: Stop leaking admin path via public endpoint'
);

// 1e. /api/user/sync: sanitize & clamp client-supplied values
patch(
  SERVER,
  "    const newXp = Math.max(user.xp, Number(xp) || 0);\n    const newStreak = Math.max(user.streak, Number(streak) || 1);\n    const newLevel = Math.max(user.level, Number(level) || 1);",
  `    // Sanitize & clamp client-supplied stats (defense against tampering)
    const clampInt = (val: unknown, min: number, max: number, fallback: number): number => {
      const n = Math.floor(Number(val));
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    };

    const newXp = Math.min(10_000_000, Math.max(user.xp, clampInt(xp, 0, 10_000_000, 0)));
    const newStreak = Math.min(3650, Math.max(user.streak, clampInt(streak, 1, 3650, 1)));
    const newLevel = Math.min(1000, Math.max(user.level, clampInt(level, 1, 1000, 1)));

    const safeDate = typeof lastActiveDate === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(lastActiveDate)
      ? lastActiveDate
      : new Date().toISOString().split('T')[0];`,
  'FIX-1e: Clamp & sanitize /api/user/sync stats'
);

patch(
  SERVER,
  "      last_active_date: lastActiveDate || new Date().toISOString().split('T')[0]",
  '      last_active_date: safeDate',
  'FIX-1e2: Use sanitized date in sync'
);

patch(
  SERVER,
  "    // Save words if passed\n    if (Array.isArray(savedWords)) {\n      savedWords.forEach((item: any) => {\n        if (item && item.word) {\n          saveUserWord(user.id, item.word, item.translation, item.sceneTitle);\n        }\n      });\n    }",
  `    // Save words if passed (sanitize: cap count and field lengths)
    if (Array.isArray(savedWords)) {
      const cleanWords = savedWords.slice(0, 500);
      cleanWords.forEach((item: any) => {
        if (item && typeof item.word === 'string') {
          const word = item.word.trim().slice(0, 100);
          if (!word) return;
          const translation = typeof item.translation === 'string' ? item.translation.slice(0, 300) : undefined;
          const sceneTitle = typeof item.sceneTitle === 'string' ? item.sceneTitle.slice(0, 150) : undefined;
          saveUserWord(user.id, word, translation, sceneTitle);
        }
      });
    }`,
  'FIX-1e3: Sanitize savedWords in sync'
);

patch(
  SERVER,
  "    // Record completed scene if passed\n    if (completedScene && completedScene.sceneId) {\n      recordUserCompletedScene(\n        user.id,\n        completedScene.sceneId,\n        Number(completedScene.accuracy) || 100,\n        Number(completedScene.wpm) || 0\n      );\n    }",
  `    // Record completed scene if passed (sanitize IDs and metrics)
    if (completedScene && typeof completedScene.sceneId === 'string' && completedScene.sceneId.trim()) {
      const cleanSceneId = completedScene.sceneId.trim().slice(0, 120);
      const cleanAccuracy = Math.min(100, Math.max(0, Number(completedScene.accuracy) || 0));
      const cleanWpm = Math.min(500, Math.max(0, Number(completedScene.wpm) || 0));
      recordUserCompletedScene(user.id, cleanSceneId, cleanAccuracy, cleanWpm);
    }`,
  'FIX-1e4: Sanitize completedScene in sync'
);

patch(
  SERVER,
  "    if (Array.isArray(completedScenes) && completedScenes.length > 0) {\n      const existingScenes = new Set(getUserCompletedScenes(user.id).map(s => s.scene_id));\n      completedScenes.forEach((sceneId: any) => {\n        const cleanId = String(sceneId || '').trim();\n        if (cleanId && !existingScenes.has(cleanId)) {\n          recordUserCompletedScene(user.id, cleanId, 100, 0);\n          existingScenes.add(cleanId);\n        }\n      });\n    }",
  `    if (Array.isArray(completedScenes) && completedScenes.length > 0) {
      const existingScenes = new Set(getUserCompletedScenes(user.id).map(s => s.scene_id));
      const cleanIds = completedScenes
        .map((sceneId: unknown) => String(sceneId || '').trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 1000);
      cleanIds.forEach((cleanId: string) => {
        if (!existingScenes.has(cleanId)) {
          recordUserCompletedScene(user.id, cleanId, 100, 0);
          existingScenes.add(cleanId);
        }
      });
    }`,
  'FIX-1e5: Cap bulk completedScenes in sync'
);

// 1f. Admin scene creation: length caps on inputs
patch(
  SERVER,
  "    if (!title || !category || !difficulty || !video_url) {\n      res.status(400).json({ error: 'Sarlavha, kategoriya, qiyinchilik va video havolasi talab qilinadi' });\n      return;\n    }",
  `    if (!title || !category || !difficulty || !video_url) {
      res.status(400).json({ error: 'Sarlavha, kategoriya, qiyinchilik va video havolasi talab qilinadi' });
      return;
    }
    if (typeof title !== 'string' || typeof category !== 'string' || typeof difficulty !== 'string' || typeof video_url !== 'string') {
      res.status(400).json({ error: 'Yaroqsiz ma\\u2019lumot turlari' });
      return;
    }
    if (title.length > 150 || category.length > 50 || difficulty.length > 30 || video_url.length > 1000) {
      res.status(400).json({ error: 'Maydonlar juda uzun' });
      return;
    }`,
  'FIX-1f: Validate admin scene input lengths'
);

// <<<PART4>>>


