# O‘zgarishlar Tarixi (CHANGELOG)

Barcha muhim o‘zgarishlar ushbu faylda hujjatlashtiriladi. Format [Keep a Changelog](https://keepachangelog.com/uz/) va versiyalash [Semantic Versioning](https://semver.org/lang/uz/) ga amal qiladi.

---

## [1.0.0] — 2026-09-10

### Qo‘shildi (Added)

- **Core SPA:** Vite 6.4 + TypeScript 5.4 asosida `MovieListenApp` (landing, library, practice, profile, settings, admin, auth viewlari)
- **Dictation mashqi:** `DictationInput` + `AnimatedStage` — aniqlik %, WPM, diff highlight, hint/reveal, tezlik 0.5x–1.0x, klaviatura yorliqlari (Space/Tab/Ctrl+Space/Alt+R/H/C)
- **Video:** YouTube nocookie embed + Cloudflare R2 streaming (`videoStreamService`), prefetch
- **Lug‘at:** `WordInfo` + `VocabularyModal`, `saved_words` (SQLite + Supabase)
- **Gamifikatsiya:** XP/Level (`sqrt` formulasi), streak, highscore TOP-3 (`HighScoreRecord`), leaderboard TOP-20, challenge link (`generateChallengeLink`)
- **Auth:** `register`/`login`/`session`/`logout`/`me` — JWT (7d) + HttpOnly cookie + Supabase Auth parallel, `verifySupabaseIdentity`
- **Admin Panel:** Dinamik `ADMIN_PATH`, `admin_scenes` CRUD, `admin/users` (search/delete/update), `admin/stats`
- **StorageService:** `localStorage` + debounced cloud sync (1200ms) + offline queue + `mergeServerScenes` + `syncWithServer` (XP max, union)
- **DB:** SQLite (`DatabaseSync`, WAL) — `users`, `saved_words`, `completed_scenes`, `admin_scenes` + Supabase `profiles`/`saved_words`/`completed_scenes`
- **Xavfsizlik:** CSP, CSRF (XSRF-TOKEN), HSTS, JWT, CAPTCHA HMAC (single-use), Rate limiting (Redis + memory fallback), bcrypt, Zod, DOMPurify
- **Deploy:** `render.yaml` (build/start, generate secrets), `vercel.json` (security headers), keep-alive self-ping (12min) + UptimeRobot `/health`
- **Hujjatlar:** `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/SECURITY.md`, `openapi.yaml`

### O‘zgartirildi (Changed)

- —

### Tuzatildi (Fixed)

- —

### Xavfsizlik (Security)

- JWT `≥32` belgi prod da majburiy, bo‘lmasa `FATAL` bilan to‘xtaydi
- CAPTCHA replay himoyasi (single-use token store)

---

## Rejalashtirilgan

- [ ] Shadowing AI (Web Speech API → Whisper baholash)
- [ ] PWA + offline dictation
- [ ] WebSocket real-time challenge

---

*Format: `YYYY-MM-DD` · [Unreleased] bo‘limi keyingi versiya uchun ishlatiladi.*
