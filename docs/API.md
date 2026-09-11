# Tinglov API Hujjati

**Base URL:** `http://localhost:3000` (dev) · `https://tinglov.onrender.com` (prod)  
**Content-Type:** `application/json` · **Auth:** `HttpOnly cookie (token)` yoki `Authorization: Bearer <JWT>`  
**CSRF:** Barcha `POST/DELETE` so‘rovlarida `XSRF-TOKEN` cookie + `x-csrf-token` header majburiy (Bearer bo‘lsa shart emas)  
**Rate Limit headerlari:** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After` (429 da)

---

## 1. Endpointlar Jadvali (23 ta)

| # | Method | Path | Auth | Rate Limit | Success (2xx) | Error |
|---|--------|------|------|------------|---------------|-------|
| 1 | `GET` | `/health` | ❌ | Yo‘q (exempt) | `200 {status:"ok", uptimeSeconds}` | — |
| 2 | `GET` | `/api/csrf-token` | ❌ | 120/min | `200 {csrfToken}` | — |
| 3 | `GET` | `/api/captcha/new` | ❌ | 120/min | `200 {id, question, token}` | — |
| 4 | `POST` | `/api/auth/register` | ❌ + CSRF | 5/soat (`registerLimiter`) | `201 {message, token, user}` | `400 validatsiya`, `400 email/login band` |
| 5 | `POST` | `/api/auth/login` | ❌ + CSRF | `checkAuthRateLimit` (backoff) | `200 {message, token, user}` | `400 validatsiya`, `401 noto‘g‘ri parol`, `429 lockout` |
| 6 | `POST` | `/api/auth/session` | ❌ + CSRF | 120/min | `200 {success, user}` | `400 ma’lumot yetarli emas`, `401 identifikatsiya talab` |
| 7 | `POST` | `/api/auth/logout` | ❌ + CSRF | 120/min | `200 {success, message}` | — |
| 8 | `GET` | `/api/auth/me` | ✅ JWT | 120/min | `200 {user, savedWords, completedScenes, completedSceneIds, lastPositions}` | `401 token yo‘q/yaroqsiz` |
| 9 | `POST` | `/api/user/sync` | ✅ JWT + CSRF | 120/min | `200 {success, user, savedWords, completedScenes}` | `401`, `500 sinxron xato` |
| 10 | `POST` | `/api/user/words` | ✅ JWT + CSRF | 120/min | `200 {success, savedWords}` | `400 so‘z ko‘rsatilmadi`, `401` |
| 11 | `GET` | `/api/leaderboard` | ❌ | 120/min | `200 {leaderboard: [...]}` (TOP-20) | `500` |
| 12 | `GET` | `/api/scenes` | ❌ | 120/min | `200 {scenes: [...]}` | `500` |
| 13 | `GET` | `/api/admin/config` | ❌ | 120/min | `200 {adminPath, cloudflareR2Url}` | — |
| 14 | `POST` | `/api/admin/login` | ❌ | 20/15min | `200 {success, token, admin, adminPath}` | `400 login/parol shart`, `401 noto‘g‘ri admin` |
| 15 | `POST` | `/api/admin/logout` | ❌ | 120/min | `200 {success, message}` | — |
| 16 | `GET` | `/api/admin/check` | ✅ Admin JWT | 120/min | `200 {authenticated, admin, token}` | `401 admin token yo‘q/yaroqsiz` |
| 17 | `GET` | `/api/admin/stats` | ✅ Admin JWT | 120/min | `200 {success, stats, system}` | `401`, `500` |
| 18 | `GET` | `/api/admin/users` | ✅ Admin JWT | 120/min | `200 {success, users, count}` | `401`, `500` |
| 19 | `DELETE` | `/api/admin/users/:id` | ✅ Admin JWT | 120/min | `200 {success, message}` | `400 yaroqsiz ID`, `401`, `404 topilmadi` |
| 20 | `POST` | `/api/admin/users/:id/update` | ✅ Admin JWT | 120/min | `200 {success, message}` | `401`, `500` |
| 21 | `GET` | `/api/admin/scenes` | ✅ Admin JWT | 120/min | `200 {success, scenes}` | `401`, `500` |
| 22 | `POST` | `/api/admin/scenes` | ✅ Admin JWT | 120/min | `200 {success, scene}` | `400 majburiy maydon`, `401`, `500` |
| 23 | `DELETE` | `/api/admin/scenes/:id` | ✅ Admin JWT | 120/min | `200 {success, message}` | `401`, `404 topilmadi` |

> Qo‘shimcha health endpointlari (`HEAD /health`, `GET /ping`, `GET /api/health` va h.k.) monitoring uchun mavjud, lekin yuqoridagi 23 ta — funksional API hisoblanadi.

**Auth belgilari:**
- `❌` = token shart emas
- `✅ JWT` = `token` cookie yoki `Bearer` header talab qilinadi (`requireAuth`)
- `✅ Admin JWT` = `admin_token` cookie yoki `Bearer` (`requireAdminAuth`, `role: admin`)

---

## 2. cURL Misollari

### 2.1 CSRF token olish (barcha POST uchun kerak)

```bash
# CSRF cookie + tokenni olish
curl -c cookies.txt http://localhost:3000/api/csrf-token
# → {"csrfToken":"a1b2c3..."}

# Yoki cookie dan o'qish:
CSRF=$(curl -s -c cookies.txt http://localhost:3000/api/csrf-token | jq -r .csrfToken)
echo $CSRF
```

### 2.2 Ro‘yxatdan o‘tish — `POST /api/auth/register`

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "username": "ali_uz",
    "email": "ali@tinglov.uz",
    "password": " KuchliParol123!",
    "fullName": "Ali Valiyev"
  }'

# Muvaffaqiyatli javob (201):
# {
#   "message": "Muvaffaqiyatli ro‘yxatdan o‘tdingiz!",
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "user": {"id":1,"username":"ali_uz","email":"ali@tinglov.uz","xp":0,"level":1}
# }

# Xato (400 — validatsiya):
# {"error":"Parol kamida 8 belgidan iborat bo‘lishi kerak"}
```

**Validatsiya qoidalari (Zod):**
- `username`: 3–20 belgi, `a-z0-9_` , boshida harf
- `email`: to‘g‘ri email format
- `password`: ≥8 belgi, kamida 1 katta harf + 1 raqam
- `fullName`: 2–50 belgi

### 2.3 Kirish — `POST /api/auth/login`

```bash
# Oddiy login (email yoki username bilan)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt -c cookies.txt \
  -d '{"identifier":"ali@tinglov.uz","password":"KuchliParol123!"}'

# Muvaffaqiyatli (200):
# {"message":"Xush kelibsiz!","token":"eyJ...","user":{...}}

# Noto'g'ri parol (401):
# {"error":"Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri","requiresCaptcha":false,"retryAfter":0}

# 3+ muvaffaqiyatsiz urinishdan keyin CAPTCHA talab qilinadi:
curl http://localhost:3000/api/captcha/new
# → {"id":"abc123","question":"7 + 5 = ?","token":"eyJwYXlsb2Fk...signature"}

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt -c cookies.txt \
  -d '{
    "identifier":"ali@tinglov.uz",
    "password":"KuchliParol123!",
    "captchaToken":"eyJwYXlsb2Fk...signature",
    "captchaAnswer":"12"
  }'

# Lockout (429 — 15+ muvaffaqiyatsiz urinish):
# {"error":"Xavfsizlik choralari tufayli hisob vaqtincha bloklandi. Iltimos, 60 soniyadan keyin qayta urinib ko‘ring.","retryAfter":60,"requiresCaptcha":true}
```

### 2.4 Profil — `GET /api/auth/me`

```bash
# Cookie orqali (register/login dan keyin avtomatik)
curl http://localhost:3000/api/auth/me -b cookies.txt

# Yoki Bearer token bilan
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# Muvaffaqiyatli (200):
# {
#   "user":{"id":1,"username":"ali_uz","email":"ali@tinglov.uz","xp":320,"streak":5,"level":3},
#   "savedWords":[{"id":1,"word":"hello","translation":"salom","scene_title":"Daily Life"}],
#   "completedScenes":[{"scene_id":"scene_1","accuracy":95,"wpm":42}],
#   "completedSceneIds":["scene_1"],
#   "lastPositions":{"scene_1":3}
# }

# Token yo'q (401):
# {"error":"Avtorizatsiyadan o‘tish talab etiladi (Token topilmadi)"}
```

### 2.5 Progress sinxronlash — `POST /api/user/sync`

```bash
# Bearer yoki cookie auth + CSRF
curl -X POST http://localhost:3000/api/user/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt \
  -d '{
    "xp": 450,
    "streak": 7,
    "level": 4,
    "lastActiveDate": "2026-09-10",
    "lastPositions": {"scene_1": 5, "scene_2": 0},
    "savedWords": [{"word":"serendipity","translation":"omad","sceneTitle":"Cinema"}],
    "completedScene": {"sceneId":"scene_1","accuracy":92,"wpm":48},
    "completedScenes": ["scene_1","scene_2"]
  }'

# Muvaffaqiyatli (200):
# {
#   "success": true,
#   "user": {"id":1,"xp":450,"streak":7,"level":4},
#   "savedWords": [...],
#   "completedScenes": [...],
#   "completedSceneIds": ["scene_1","scene_2"],
#   "lastPositions": {"scene_1":5}
# }
```

**Eslatma:** `streak` — client-authoritative, ya’ni pasayishi ham qabul qilinadi (inactive bo‘lsa). `xp`/`level` esa `Math.max` bilan faqat o‘sadi.

### 2.6 So‘z saqlash/o‘chirish — `POST /api/user/words`

```bash
# Saqlash
curl -X POST http://localhost:3000/api/user/words \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-csrf-token: $CSRF" -b cookies.txt \
  -d '{"action":"save","word":"ephemeral","translation":"vaqtinchalik","sceneTitle":"Anime"}'

# O'chirish
curl -X POST http://localhost:3000/api/user/words \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-csrf-token: $CSRF" -b cookies.txt \
  -d '{"action":"delete","word":"ephemeral"}'

# Javob (200): {"success":true,"savedWords":[...]}
```

### 2.7 Leaderboard — `GET /api/leaderboard`

```bash
curl http://localhost:3000/api/leaderboard

# Javob (200):
# {"leaderboard":[
#   {"id":1,"username":"ali_uz","full_name":"Ali Valiyev","avatar_color":"#A3E635","xp":1250,"streak":12,"level":7},
#   {"id":2,"username":"sara_uz","full_name":"Sara","avatar_color":"#FF5B37","xp":980,"streak":9,"level":6}
# ]}
```

### 2.8 Admin: login → stats → users → scenes

```bash
# 1. Admin login (rate: 20/15min)
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" -b cookies.txt -c cookies.txt \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
# → {"success":true,"token":"eyJ...","admin":{"username":"admin","role":"admin"}}

ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" -H "x-csrf-token: $CSRF" -b cookies.txt -c cookies.txt \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}' | jq -r .token)

# 2. Session tekshirish
curl http://localhost:3000/api/admin/check \
  -H "Authorization: Bearer $ADMIN_TOKEN" -b cookies.txt
# → {"authenticated":true,"admin":{"username":"admin","role":"admin"}}

# 3. Statistika
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" -b cookies.txt
# → {"success":true,"stats":{"totalUsers":42,"usersToday":5,"totalSavedWords":120,"totalCompletedScenes":310,"totalCustomScenes":8},"system":{"nodeVersion":"v20.x","uptimeSeconds":3600}}

# 4. Foydalanuvchilar (qidiruv bilan)
curl "http://localhost:3000/api/admin/users?search=ali" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -b cookies.txt
# → {"success":true,"users":[...],"count":3}

# 5. Dars yaratish
curl -X POST http://localhost:3000/api/admin/scenes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-csrf-token: $CSRF" -b cookies.txt \
  -d '{
    "title": "Daily Conversation",
    "category": "Daily Life",
    "difficulty": "beginner",
    "video_url": "https://pub-xxxx.r2.dev/video.mp4",
    "poster_url": "https://pub-xxxx.r2.dev/poster.jpg",
    "dialogues": [{"id":"line_1","character":"Anna","text":"Hello, how are you?","uzbekTranslation":"Salom, yaxshimisiz?","startTime":0,"endTime":3}]
  }'
# → {"success":true,"scene":{"id":"custom_admin_...","title":"Daily Conversation"}}

# 6. Dars o'chirish
curl -X DELETE http://localhost:3000/api/admin/scenes/custom_admin_123 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-csrf-token: $CSRF" -b cookies.txt

# 7. Foydalanuvchi XP ni yangilash
curl -X POST http://localhost:3000/api/admin/users/1/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-csrf-token: $CSRF" -b cookies.txt \
  -d '{"xp":2000,"streak":15,"level":10}'
```

---

## 3. Umumiy Xatolik Formatlari

| Status | Body | Qachon |
|--------|------|--------|
| `400` | `{"error":"..."}` | Validatsiya, majburiy maydon yo‘q, JSON parse xato |
| `401` | `{"error":"Avtorizatsiyadan o‘tish talab etiladi"}` | Token yo‘q / yaroqsiz / muddati o‘tgan |
| `403` | `{"error":"CSRF token xatosi..."}` | CSRF mismatch |
| `403` | `{"error":"Ruxsat berilmagan: faqat admin uchun"}` | Admin bo‘lmagan token |
| `404` | `{"error":"Foydalanuvchi topilmadi"}` | Resurs topilmadi |
| `429` | `{"error":"Juda ko‘p so‘rov...","retryAfter":60}` | Rate limit / lockout |
| `500` | `{"error":"Serverda xatolik yuz berdi"}` | Ichki xato (logda `console.error`) |

---

## 4. Eslatmalar

- **Supabase Auth** bilan parallel ishlaydi: `apiService` avval `/api/auth/login` ni sinaydi, muvaffaqiyatsiz bo‘lsa Supabase `signInWithPassword` ga tushadi.
- **Session sync** (`POST /api/auth/session`): Supabase identity ni `verifySupabaseIdentity` orqali tekshiradi — faqat tasdiqlangan Supabase access token bilan mavjud akkauntga session beriladi.
- **Keep-Alive:** `GET /health`, `GET /ping`, `GET /api/health`, `HEAD` variantlari rate-limit dan ozod, `Cache-Control: no-store`.

Batafsil OpenAPI spetsifikatsiya: [`../openapi.yaml`](../openapi.yaml)
