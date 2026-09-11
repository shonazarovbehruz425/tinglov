# Tinglov — Kino va Multfilm orqali Listening

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-brightgreen?style=flat&logo=node.js)](https://nodejs.org)
[![TypeScript 5.4](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Vite 6.4](https://img.shields.io/badge/Vite-6.4-646cff?style=flat&logo=vite)](https://vitejs.dev)
[![Express 5.2](https://img.shields.io/badge/Express-5.2-black?style=flat&logo=express)](https://expressjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Deploy: Render](https://img.shields.io/badge/Deploy-Render-46e3b7?style=flat)](https://render.com)
[![Frontend: Vercel](https://img.shields.io/badge/Frontend-Vercel-black?style=flat&logo=vercel)](https://vercel.com)

> **Tinglov** — ingliz tilini kino, multfilm va anime sahnalari orqali tinglab tushunish (listening) ko‘nikmasini o‘stirish uchun yaratilgan interaktiv SPA platforma. Har bir replika alohida mashq sifatida tinglanadi, yozib olinadi (dictation), talaffuz tekshiriladi va lug‘atga saqlanadi.

Tinglov foydalanuvchiga YouTube yoki R2-videodan dialogni kesib olib, har bir jumlani sekinlashtirilgan ovoz, subtitr rejimlari, WPM/aniqlik tahlili va XP/level tizimi bilan mashq qilish imkonini beradi. Backend — Node + Express + SQLite (WAL) + Supabase Auth, xavfsizlik qatlamlari (CSP/CSRF/JWT/CAPTCHA/Rate-limit/HSTS) bilan qoplangan, frontend esa Vite + TypeScript da yozilgan yengil SPA.

Platforma ikki tomonlama sinxronlashni qo‘llaydi: mahalliy `localStorage` + SQLite/Redis server + Supabase `profiles/saved_words/completed_scenes` jadvallari. Offline yozilgan natija `navigator.onLine` qaytganda avtomatik sinxronlanadi. Admin panel (`ADMIN_PATH`) orqali darslar, foydalanuvchilar va statistika boshqariladi.

---

## ✨ Asosiy Xususiyatlar (6 ta)

| # | Xususiyat | Tavsif |
|---|-----------|--------|
| 1 | **Interactive Dictation** | Har bir replika uchun yozib tekshirish, xatolarni rangli diff (`stringDiff.ts`), aniqlik % va WPM hisoblash, hint/reveal tizimi |
| 2 | **Video + Audio Mashqi** | YouTube embed / Cloudflare R2 streaming / HLS kesimi; tezlik 0.5x–1.0x; klaviatura yorliqlari (Space, Alt+R, Ctrl+Space) |
| 3 | **Shadowing & Talaffuz** | (tez orada) Web Speech API asosida talaffuz baholash, bonus XP |
| 4 | **Lug‘at & Takrorlash** | Har bir so‘z uchun `WordInfo` (tarjima, izoh, fonetika), `VocabularyModal` da saqlangan so‘zlarni takrorlash |
| 5 | **Gamifikatsiya** | XP → Level (`sqrt(xp/25+0.25)-0.5`), streak, leaderboard (global TOP-20), sahna highscore TOP-3, do‘stga challenge link |
| 6 | **Admin Boshqaruv Markazi** | Dinamik `ADMIN_PATH`, dars CRUD (`admin_scenes`), foydalanuvchi qidiruv/o‘chirish/XP tahrirlash, tizim statistikasi |

---

## 👥 Foydalanuvchi Rollari

| Rol | Kirish yo‘li | Huquqlari | Misol marshrut |
|-----|--------------|-----------|----------------|
| **Mehmon (Guest)** | Token yo‘q | Landing, login/register ko‘rish; mashq qila olmaydi | `/`, `/login`, `/register` |
| **Foydalanuvchi (User)** | `Authorization: Bearer <JWT>` yoki `token` HttpOnly cookie | Mashq, lug‘at, sync, leaderboard, profil/sozlamalar | `/dashboard`, `/practice`, `/profile` |
| **Admin** | `admin_token` HttpOnly cookie + `role: admin` JWT (24 soat) | Foydalanuvchilarni boshqarish, dars CRUD, statistika | `/admin` (yoki `ADMIN_PATH`) |

> Admin token alohida `JWT_SECRET` bilan imzolanadi, `SameSite: strict`, `httpOnly: true`. Oddiy user tokeni `7d` yashaydi, admin token `24h`.

---

## 🧱 Texnologik Stek

| Qatlam | Texnologiya | Versiya / Izoh |
|--------|-------------|----------------|
| **Frontend** | Vite + TypeScript + Vanilla TS SPA | Vite 6.4, ES2020, `esbuild` minify, `manualChunks` (supabase/zod/dompurify) |
| **UI** | Custom CSS (`style.css`), Phosphor Icons 2.1.2 (SRI), Lexend Deca + JetBrains Mono | `cursorGlow`, `SkeletonLoader` |
| **Backend** | Node.js + Express 5.2 + `tsx watch` | `trust proxy: 1`, `cors`, `cookie-parser`, `dotenv` |
| **DB (asosiy)** | `node:sqlite` `DatabaseSync` (WAL) — `tinglov.db` | Jadvallar: `users`, `saved_words`, `completed_scenes`, `admin_scenes` |
| **Auth DB** | Supabase (Postgres + Auth) | `profiles`, `saved_words`, `completed_scenes` (RLS) |
| **Kesh / Limit** | Redis (`ioredis` 6.0) — ixtiyoriy, fallback bounded memory (10k) | `tinglov:rl:*`, `tinglov:auth:*` |
| **Video** | Cloudflare R2 (Zero Egress) + YouTube nocookie embed | `CLOUDFLARE_R2_URL` |
| **Validatsiya** | Zod 4.6.1 (`validation.ts`) | `registerSchema`, `loginSchema` |
| **Xavfsizlik** | JWT (`jsonwebtoken` 9.0), `bcryptjs` 3.0, `dompurify` 3.4, `helmet` headerlar | CSP, HSTS, CSRF, CAPTCHA HMAC |
| **Deploy** | Render.com (Web Service, free) + Vercel (frontend) | `render.yaml`, `vercel.json` |
| **Keep-Alive** | Self-ping `12min` + UptimeRobot → `/health` | `RENDER_EXTERNAL_URL` |

---

## 🚀 Tez Boshlash

### Talablar

- **Node.js 20+** (`node -v` ≥ 20)
- **npm 10+**
- Supabase loyiha (URL + anon key)
- (Ixtiyoriy) Redis URL, Cloudflare R2 bucket

### O‘rnatish

```bash
git clone https://github.com/<org>/LearnLanguagesEasily.git
cd LearnLanguagesEasily
npm install
```

### Muhit o‘zgaruvchilari

```bash
cp .env.example .env
# .env ni to'ldiring (quyidagi Jadvalga qarang)
```

### Ishga tushirish

```bash
# 1. Frontend dev server (Vite, HMR) — http://localhost:5173
npm run dev

# 2. Backend API server (tsx watch) — http://localhost:3000
npm run server

# 3. Production build
npm run build        # tsc && vite build → dist/

# 4. Production start (Render shu buyruqni ishlatadi)
npm start            # tsx server/index.ts

# 5. Preview build
npm run preview
```

> Dev rejimda frontend `5173`-portda, backend `3000`-portda alohida ishlaydi. Productionda Express `dist/` ni statik serve qiladi + SPA fallback (`index.html`).

---

## 📜 Skriptlar

| Buyruq | Tavsif |
|--------|--------|
| `npm run dev` | Vite dev server (HMR, CSP headerlar) |
| `npm run server` | `tsx watch server/index.ts` — backend hot-reload |
| `npm run build` | `tsc && vite build` — production build (`dist/`) |
| `npm start` | `tsx server/index.ts` — production start (Render) |
| `npm run preview` | `vite preview` — buildni lokal preview |
| `npm test` | Vitest — barcha testlarni ishga tushirish (393 test) |
| `npm run test:coverage` | Coverage hisoboti (Stmts ~90%, Lines ~91%, Branches ~82%) |
| `npm run typecheck` | `tsc --noEmit` — frontend tip tekshiruvi |
| `npm run typecheck:server` | `tsc --noEmit` (tsconfig.server.json) — server tip tekshiruvi |

---

## 🧪 Testing

Testlar **Vitest** da yozilgan (393 ta test):

```bash
# Barcha testlarni ishga tushirish
npm test

# Coverage hisoboti bilan (Stmts ~90%, Lines ~91%, Branches ~82%)
npm run test:coverage

# Tip tekshiruvi — frontend
npm run typecheck

# Tip tekshiruvi — server
npm run typecheck:server
```

> `test:coverage` natijasi `coverage/` papkasiga yoziladi (gitignore qilingan).

---

## 🔧 Muhit O‘zgaruvchilari (.env)

| O‘zgaruvchi | Majburiy | Tavsif | Misol |
|-------------|----------|--------|-------|
| `VITE_SUPABASE_URL` | ✅ | Supabase loyiha URL | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/publishable key | `sb_publishable_...` |
| `JWT_SECRET` | ✅ | JWT imzo kaliti (≥32 belgidan) | `openssl rand -hex 32` |
| `CAPTCHA_SECRET` | ✅ | CAPTCHA HMAC kaliti (≥16) | `openssl rand -hex 16` |
| `REDIS_URL` | ⭕ | Redis ulanish URL (bo‘lmasa memory fallback) | `redis://default:pass@host:6379` |
| `ADMIN_PATH` | ⭕ | Admin panel yo‘li (default `/admin`) | `/boshqaruv` |
| `VITE_ADMIN_PATH` | ⭕ | Frontend admin yo‘li (ADMIN_PATH bilan bir xil) | `/boshqaruv` |
| `ADMIN_USERNAME` | ⭕ | Admin login | `admin` |
| `ADMIN_PASSWORD` | ⭕ | Admin parol | `<ADMIN_PASSWORD>` |
| `CLOUDFLARE_R2_URL` | ⭕ | R2 public bucket URL | `https://pub-xxxx.r2.dev` |
| `VITE_CLOUDFLARE_R2_URL` | ⭕ | Frontend R2 URL | `https://pub-xxxx.r2.dev` |
| `RENDER_EXTERNAL_URL` | ⭕ | Keep-Alive self-ping manzili | `https://tinglov.onrender.com` |
| `PORT` | ⭕ | Server port (default 3000) | `3000` |
| `DATABASE_PATH` | ⭕ | SQLite fayl yo‘li (default `tinglov.db`) | `./tinglov.db` |

---

## 📚 API Hujjatlari

To‘liq 23 ta endpoint jadvali, cURL misollari va xatolik kodlari:

- **REST API qo‘llanma:** [`docs/API.md`](./docs/API.md)
- **OpenAPI 3.0 spetsifikatsiya:** [`openapi.yaml`](./openapi.yaml)

Tezkor misol:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "XSRF-TOKEN=$CSRF" \
  -d '{"identifier":"demo@tinglov.uz","password":"Demo123!"}'
```

---

## 🗄️ Ma'lumotlar Bazasi Sxemasi (4 jadval)

> Asosiy DB — SQLite (`tinglov.db`, WAL). Supabase da bir xil jadvallar (RLS bilan) mavjud. Quyida SQLite sxemasi keltirilgan.

### 1. `users`

| Ustun | Tip | Cheklov | Izoh |
|-------|-----|---------|------|
| `id` | INTEGER | PK AUTOINCREMENT | Foydalanuvchi ID |
| `username` | TEXT | UNIQUE COLLATE NOCASE | Login |
| `email` | TEXT | UNIQUE COLLATE NOCASE | Email |
| `password_hash` | TEXT | NOT NULL | bcrypt hash |
| `full_name` | TEXT | NOT NULL | To‘liq ism |
| `avatar_color` | TEXT | DEFAULT `#A3E635` | Avatar rangi |
| `xp` | INTEGER | DEFAULT 0 | Tajriba |
| `streak` | INTEGER | DEFAULT 1 | Kunlik ketma-ketlik |
| `level` | INTEGER | DEFAULT 1 | Daraja |
| `last_active_date` | TEXT |  | Oxirgi faollik (YYYY-MM-DD) |
| `auth_provider` | TEXT | DEFAULT `email` | `email` / `google` |
| `uuid` | TEXT |  | Supabase UUID |
| `last_positions` | TEXT |  | JSON `{sceneId: index}` |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Yaratilgan sana |

### 2. `saved_words`

| Ustun | Tip | Cheklov | Izoh |
|-------|-----|---------|------|
| `id` | INTEGER | PK AUTOINCREMENT |  |
| `user_id` | INTEGER | FK → users(id) CASCADE | Egasi |
| `word` | TEXT | NOT NULL | So‘z (lowercase) |
| `translation` | TEXT |  | Tarjimasi |
| `scene_title` | TEXT |  | Qaysi sahnadan |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |  |
| **UNIQUE** |  | `(user_id, word)` | Bir so‘z bir marta |
| **INDEX** |  | `idx_saved_words_user` |  |

### 3. `completed_scenes`

| Ustun | Tip | Cheklov | Izoh |
|-------|-----|---------|------|
| `id` | INTEGER | PK AUTOINCREMENT |  |
| `user_id` | INTEGER | FK → users(id) CASCADE |  |
| `scene_id` | TEXT | NOT NULL | Sahna ID |
| `accuracy` | INTEGER | DEFAULT 100 | Aniqlik % |
| `wpm` | INTEGER | DEFAULT 0 | Tezlik |
| `completed_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |  |
| **INDEX** |  | `idx_completed_scenes_user` |  |

### 4. `admin_scenes`

| Ustun | Tip | Cheklov | Izoh |
|-------|-----|---------|------|
| `id` | TEXT | PK | `custom_admin_<timestamp>` |
| `title` | TEXT | NOT NULL | Sarlavha |
| `category` | TEXT | NOT NULL | Cartoon / Cinema / Anime / Daily Life |
| `difficulty` | TEXT | NOT NULL | beginner / intermediate / advanced |
| `video_url` | TEXT | NOT NULL | R2 / CDN URL |
| `poster_url` | TEXT |  | Muqova rasmi |
| `dialogues_json` | TEXT | NOT NULL | JSON massiv (`DialogueSentence[]`) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |  |
| **INDEX** |  | `idx_admin_scenes_created` |  |

---

## 🔒 Xavfsizlik

| Himoya | Qayerda | Qisqa tavsif |
|--------|---------|--------------|
| **CSP** | `index.html` meta + `server/index.ts` header | `default-src 'self'`, `script-src` allowlist, `object-src 'none'`, `base-uri 'self'` |
| **CSRF** | `XSRF-TOKEN` cookie + `x-csrf-token` header | Safe methodlar (GET/HEAD/OPTIONS) va Bearer auth dan tashqari barcha POST/DELETE da tekshiriladi |
| **JWT** | `server/auth.ts` | `HttpOnly`, `SameSite:lax/strict`, `Secure` (prod), `7d` (user) / `24h` (admin) |
| **CAPTCHA** | `server/rateLimiter.ts` (HMAC-SHA256) | 3 muvaffaqiyatsiz login → CAPTCHA majburiy, 5 daq amal qiladi, bir marta ishlatiladi |
| **Rate Limit** | Redis yoki bounded memory (10k) | `apiLimiter` 120 req/min, `registerLimiter` 5/h, `adminLoginLimiter` 20/15min, auth backoff 3s→5s→60s→15m |
| **HSTS** | `vercel.json` + Express middleware | `max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| **Validatsiya** | `zod` + `dompurify` | `registerSchema`/`loginSchema` (username/email/parol qoidalari), HTML sanitize |
| **Bcrypt** | `bcryptjs` 10 rounds | Parollar hech qachon plain saqlanmaydi |

> **Eslatma:** `ADMIN_PASSWORD` (plain) o‘rniga `ADMIN_PASSWORD_HASH` (bcrypt hash) berish tavsiya etiladi — hash o‘rnatilganda server `bcrypt.compare` bilan tekshiradi va plain parol `.env` da saqlanmaydi.

Batafsil: [`docs/SECURITY.md`](./docs/SECURITY.md)

---

## 🚢 Deploy

### Render.com (Backend + SPA)

1. GitHub repo ni Render ga ulang → **New Web Service**
2. `render.yaml` avtomatik o‘qiladi:
   - `buildCommand: npm install && npm run build`
   - `startCommand: npm start`
3. **Environment** da quyidagilarni qo‘shing (Render Dashboard → Environment):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `JWT_SECRET` (Generate), `CAPTCHA_SECRET` (Generate), `ADMIN_PATH`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CLOUDFLARE_R2_URL`, `RENDER_EXTERNAL_URL`
4. **Health Check Path:** `/health` yoki `/api/health`
5. UptimeRobot da `https://<service>.onrender.com/health` ni har 5 daqiqada ping qiling (free tier uyquga ketmasligi uchun self-ping ham 12 daqiqada ishlaydi)

### Vercel (Frontend only — alternativ)

```bash
npm i -g vercel
vercel --prod
```

- `vercel.json` dagi `Strict-Transport-Security`, `X-Frame-Options` headerlari avtomatik qo‘shiladi
- Env o‘zgaruvchilarini Vercel Dashboard → Settings → Environment Variables da kiriting
- Backend alohida Render da qolsa, frontendda `VITE_API_URL` orqali bog‘lang (hozirda `/api` — bir xil origin)

Qo‘shimcha qadamlar: [`docs/SETUP.md`](./docs/SETUP.md)

---

## 🤝 Hissa Qo‘shish

Loyiha ochiq! Xatolik topdingizmi yoki yangi g‘oya bormi?

1. `CONTRIBUTING.md` ni o‘qing — branch, commit, PR qoidalari
2. Issue oching yoki to‘g‘ridan-to‘g‘ri PR yuboring

**Hujjatlar:**

- Hissa qo‘shish yo‘riqnomasi: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- O‘zgarishlar tarixi: [`CHANGELOG.md`](./CHANGELOG.md)
- Arxitektura: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Sozlash: [`docs/SETUP.md`](./docs/SETUP.md)

---

## 📄 Litsenziya

MIT — [`LICENSE`](./LICENSE) fayliga qarang.

---

<p align="center">
  <sub>Tinglov jamoasi tomonidan ❤️ bilan yaratildi · <a href="https://tinglov.uz">tinglov.uz</a></sub>
</p>
