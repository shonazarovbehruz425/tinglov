# Tinglov — Sozlash va Deploy Yo‘riqnomasi (SETUP)

Ushbu hujjat loyihani **lokal muhitda ishga tushirish**, **Supabase + R2 + Redis** ni sozlash va **Render + Vercel** ga deploy qilish bo‘yicha to‘liq qadamlarni o‘z ichiga oladi.

---

## 1. Talablar

| Dastur | Minimal versiya | Tekshirish |
|--------|-----------------|------------|
| Node.js | **20+** | `node -v` |
| npm | 10+ | `npm -v` |
| Git | istalgan | `git --version` |
| Supabase hisob | — | https://supabase.com |
| (Ixtiyoriy) Redis | 6+ | `redis-cli ping` |
| (Ixtiyoriy) Cloudflare R2 | — | https://dash.cloudflare.com |

---

## 2. Lokal Sozlash (5 daqiqa)

```bash
# 1. Klonlash
git clone https://github.com/<org>/LearnLanguagesEasily.git
cd LearnLanguagesEasily

# 2. Bog'liqliklarni o'rnatish
npm install

# 3. Muhit faylini yaratish
cp .env.example .env
# .env ni tahrirlang (quyidagi 3-bo'limga qarang)

# 4. Frontend dev server (http://localhost:5173)
npm run dev

# 5. Aliohta terminalda backend server (http://localhost:3000)
npm run server

# 6. Production build tekshiruvi
npm run build
npm start
# → http://localhost:3000 da ham frontend (dist) ham API (/api/*) ishlaydi
```

> Agar `JWT_SECRET` yoki `CAPTCHA_SECRET` belgilanmagan bo‘lsa, server `FATAL: ... required` xatosi bilan to‘xtaydi — bu atay qilingan xavfsizlik chorasi.

---

## 3. Supabase Sozlash

### 3.1 Loyiha yaratish

1. https://supabase.com → **New Project** (region: `EU` yoki `Singapore` — O‘zbekistonga yaqin)
2. **Project Settings → API** dan nusxa oling:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 3.2 SQL — Jadvallarni yaratish (Supabase SQL Editor da ishga tushiring)

> SQLite sxemasi (`server/db.ts`) ga mos, lekin Supabase da `uuid` PK va RLS bilan.

```sql
-- ============================================================
-- Tinglov — Supabase SQL (profiles / saved_words / completed_scenes)
-- SQL Editor (https://supabase.com/dashboard/project/<id>/sql) da ishga tushiring
-- ============================================================

-- 1. profiles — auth.users ga bog'langan foydalanuvchi profili
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null default '',
  avatar_color text not null default '#FF5722',
  xp integer not null default 0,
  streak integer not null default 1,
  level integer not null default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists idx_profiles_xp on public.profiles(xp desc);
create index if not exists idx_profiles_username on public.profiles(username);

-- 2. saved_words — lug'at
create table if not exists public.saved_words (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  word text not null,
  translation text,
  scene_title text,
  created_at timestamp with time zone default now(),
  unique(user_id, word)
);
create index if not exists idx_saved_words_user on public.saved_words(user_id);

-- 3. completed_scenes — yakunlangan darslar
create table if not exists public.completed_scenes (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scene_id text not null,
  accuracy integer not null default 100,
  wpm integer not null default 0,
  completed_at timestamp with time zone default now()
);
create index if not exists idx_completed_scenes_user on public.completed_scenes(user_id);

-- 4. admin_scenes — admin yaratgan darslar (ixtiyoriy, asosan SQLite da saqlanadi)
create table if not exists public.admin_scenes (
  id text primary key,
  title text not null,
  category text not null,
  difficulty text not null,
  video_url text not null,
  poster_url text,
  dialogues_json text not null,
  created_at timestamp with time zone default now()
);

-- 5. RLS ni yoqish
alter table public.profiles enable row level security;
alter table public.saved_words enable row level security;
alter table public.completed_scenes enable row level security;
-- admin_scenes — faqat backend service_role orqali yoziladi, RLS shart emas

-- 6. RLS siyosatlari (har bir foydalanuvchi faqat o'z yozuvlarini ko'radi/yozadi)
-- profiles
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- saved_words
drop policy if exists "saved_words_all_own" on public.saved_words;
create policy "saved_words_all_own" on public.saved_words for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- completed_scenes
drop policy if exists "completed_scenes_all_own" on public.completed_scenes;
create policy "completed_scenes_all_own" on public.completed_scenes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. updated_at trigger (profiles)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 8. Yangi auth.users uchun avtomatik profiles qatori (ixtiyoriy, apiService upsert ham qiladi)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Tekshirish:**

```sql
select * from public.profiles limit 5;
select * from public.saved_words limit 5;
select * from public.completed_scenes limit 5;
```

### 3.3 Auth sozlamalari

- **Supabase Dashboard → Authentication → Providers → Email** — enabled (confirm email ixtiyoriy, dev da o‘chiring)
- **Google OAuth** (ixtiyoriy): `Authentication → Providers → Google` → Client ID/Secret kiriting, `Redirect URL` ga `https://<project>.supabase.co/auth/v1/callback` qo‘shing.
- **Site URL:** `Authentication → URL Configuration` → `Site URL = http://localhost:5173` (dev), prod da `https://tinglov.onrender.com`

---

## 4. Cloudflare R2 Bucket Sozlash (Video Streaming)

R2 — S3-mos, **zero egress** (chiqish trafiki bepul) video xosting.

### 4.1 Bucket yaratish

1. https://dash.cloudflare.com → **R2 Object Storage** → **Create bucket**
   - Nom: `tinglov-videos` (yoki istalgan)
   - Lokatsiya: `Automatic`
2. **Settings → Public access → Allow Access** → R2 dev subdomain ni nusxa oling: `https://pub-xxxx.r2.dev`
   - Yoki custom domain ulang: `media.tinglov.uz` → CNAME
3. **Manage → CORS** (ixtiyoriy, frontenddan to‘g‘ridan-to‘g‘ri yuklash uchun):

```json
[
  {
    "AllowedOrigins": ["https://tinglov.onrender.com", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4.2 Fayllarni yuklash

- **R2 Dashboard → Upload** yoki `wrangler` / `rclone` / `aws-cli` bilan:
```bash
aws s3 cp video.mp4 s3://tinglov-videos/video.mp4 \
  --endpoint-url https://<accountId>.r2.cloudflarestorage.com \
  --profile r2
```
- Public URL: `https://pub-xxxx.r2.dev/video.mp4` → `CLOUDFLARE_R2_URL` ga qo‘ying.

### 4.3 .env da sozlash

```env
CLOUDFLARE_R2_URL=https://pub-xxxx.r2.dev
VITE_CLOUDFLARE_R2_URL=https://pub-xxxx.r2.dev
```

Admin panelda dars yaratishda `video_url` ga shu URL ni qo‘ying.

---

## 5. Redis Sozlash (Ixtiyoriy, lekin prod da tavsiya etiladi)

Redis — distributed rate limiting va auth lockout uchun.

### Lokal (Docker)

```bash
docker run -d --name tinglov-redis -p 6379:6379 redis:7-alpine
# .env
REDIS_URL=redis://localhost:6379
```

### Managed (Upstash / Redis Cloud)

1. https://upstash.com yoki https://redis.com → free Redis yarating
2. URL ni nusxa oling: `redis://default:PASSWORD@host:6379`
3. Render env ga qo‘shing: `REDIS_URL`

### Fallback

`REDIS_URL` belgilanmagan bo‘lsa, server **bounded in-memory** (10k entry, LRU, 5 daqiqada tozalash) ishlatadi — bitta instansda yetarli, lekin bir nechta instansda limitlar alohida hisoblanadi.

Tekshirish:

```bash
curl http://localhost:3000/api/captcha/new
# Logda: "✅ Connected to Redis" yoki "ℹ️ Running with bounded in-memory rate limiter."
```

---

## 6. Render.com Deploy Qadamları

### 6.1 GitHub → Render

1. https://dashboard.render.com → **New → Web Service** → GitHub repo ni tanlang
2. **Settings:**
   - **Name:** `tinglov`
   - **Runtime:** `Node`
   - **Region:** `Singapore` yoki `Frankfurt` (O‘zbekistonga yaqin)
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free` (yoki `Starter` — uyqu bo‘lmaydi)

`render.yaml` mavjud bo‘lsa, Render uni avtomatik taniydi:

```yaml
services:
  - type: web
    name: tinglov
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: CAPTCHA_SECRET
        generateValue: true
      # ... qolganlari sync: false (dashboardda qo'lda kiritiladi)
```

### 6.2 Environment Variables (Render Dashboard → Environment)

| Key | Qiymat |
|-----|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | **Generate** (32+ belgi) |
| `CAPTCHA_SECRET` | **Generate** (16+ belgi) |
| `VITE_SUPABASE_URL` | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `ADMIN_PATH` | `/admin` (yoki maxfiy) |
| `VITE_ADMIN_PATH` | `/admin` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | kuchli parol |
| `CLOUDFLARE_R2_URL` | `https://pub-xxxx.r2.dev` |
| `VITE_CLOUDFLARE_R2_URL` | `https://pub-xxxx.r2.dev` |
| `RENDER_EXTERNAL_URL` | `https://tinglov.onrender.com` |
| `REDIS_URL` | (ixtiyoriy) |

> **Muhim:** `VITE_` prefiksli o‘zgaruvchilar build vaqtida `import.meta.env` ga embed qilinadi — ularni o‘zgartirgandan keyin **Manual Deploy → Clear build cache & deploy** qiling.

### 6.3 Health Check & Keep-Alive

- **Health Check Path:** `/health` (yoki `/api/health`) — Render → Settings → Health Check Path
- **Keep-Alive:** `server/index.ts` dagi `startKeepAliveHeartbeat()` har 12 daqiqada `RENDER_EXTERNAL_URL/health` ga `fetch` qiladi.
- **UptimeRobot:** https://uptimerobot.com → **New Monitor** → Type: `HTTP(s)` → URL: `https://tinglov.onrender.com/health` → Interval: 5 min

---

## 7. Vercel Deploy (Frontend alternativ)

Agar frontendni Vercel ga deploy qilmoqchi bo‘lsangiz:

```bash
npm i -g vercel
vercel --prod
# yoki GitHub integration: vercel.com → New Project → Import
```

- `vercel.json` dagi security headerlar avtomatik qo‘shiladi
- Env o‘zgaruvchilarini **Vercel Dashboard → Settings → Environment Variables** ga kiriting
- Backend alohida Render da qolsa, `vite.config.ts` da proxy yoki `VITE_API_URL` qo‘shing

---

## 8. Tekshirish Ro‘yxati (Checklist)

- [ ] `npm run dev` + `npm run server` lokalda ishlayapti
- [ ] Supabase da 3 jadval + RLS siyosatlari yaratildi
- [ ] `GET /health` → `200 {status:"ok"}`
- [ ] `POST /api/auth/register` → `201` + cookie o‘rnatildi
- [ ] `GET /api/auth/me` → `200 user`
- [ ] R2 video URL admin panelda ijro etilmoqda
- [ ] Render build yashil, health check `healthy`
- [ ] UptimeRobot monitor `UP`

---

*Muammo bormi? → [GitHub Issues](https://github.com/<org>/LearnLanguagesEasily/issues) oching yoki `CONTRIBUTING.md` ga qarang.*
