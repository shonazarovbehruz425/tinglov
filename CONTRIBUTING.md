# Hissa Qo‘shish Yo‘riqnomasi (CONTRIBUTING)

Tinglov loyihasiga qiziqish bildirganingiz uchun rahmat! Ushbu yo‘riqnoma qanday qilib samarali hissa qo‘shishni tushuntiradi.

---

## 1. Ishni Boshlash

```bash
git clone https://github.com/<org>/LearnLanguagesEasily.git
cd LearnLanguagesEasily
npm install
cp .env.example .env
# .env ni to'ldiring (README.md dagi Env jadvaliga qarang)
npm run dev      # frontend
npm run server   # backend (alohida terminal)
```

- **Node.js 20+** talab qilinadi.
- Kod uslubi: TypeScript `strict`, `noUnusedLocals/Parameters`, `esbuild` minify.
- Commitdan oldin `npm run build` muvaffaqiyatli o‘tishiga ishonch hosil qiling.

---

## 2. Branch Strategiyasi

| Branch | Maqsad |
|--------|--------|
| `main` | Stable, har doim deployga tayyor |
| `feature/<nomi>` | Yangi xususiyat (masalan `feature/shadowing-ai`) |
| `fix/<nomi>` | Xatolik tuzatish (masalan `fix/csrf-bypass`) |
| `docs/<nomi>` | Faqat hujjat o‘zgarishi |
| `chore/<nomi>` | Build, deps, tooling |

```bash
git checkout main
git pull origin main
git checkout -b feature/mening-yangiligim
```

---

## 3. Commit Qoidalari (Conventional Commits)

```
<type>(<scope>): <qisqa tavsif>

# type: feat | fix | docs | style | refactor | perf | test | chore | security
# scope: masalan auth, api, ui, db, deploy

feat(dictation): WPM hisoblashga median filtr qo'shildi
fix(auth): JWT expiry da refresh o'rniga logout
docs(api): /api/user/sync misoli qo'shildi
security(rate-limit): Redis fallback LRU eviction tuzatildi
```

- Bitta commit — bitta mantiqiy o‘zgarish.
- O‘zbek yoki ingliz tilida yozish mumkin, lekin bir xil uslubda qoling.

---

## 4. Pull Request (PR) Jarayoni

1. **Issue oching** (agar mavjud bo‘lmasa) — nima uchun kerakligini tushuntiring.
2. Branch yarating, o‘zgarishlarni qiling.
3. `npm run build` va qo‘lda test (`/practice`, `/admin`, `curl` API).
4. PR yarating:
   - Sarlavha: Conventional Commits formatida
   - Tavsif: `Closes #123`, nima o‘zgardi, qanday test qilindi, skrinshot (UI bo‘lsa)
5. Reviewer tayinlanadi — kamida 1 approval.
6. Squash & merge → `main` → auto deploy (Render/Vercel).

**PR andozasi:**

```markdown
## Nima o'zgardi?
- ...

## Qanday test qilindi?
- [ ] npm run build
- [ ] /api/auth/login curl
- [ ] /practice da qo'lda test

## Skrinsnot / Video
...

Closes #123
```

---

## 5. Kod Uslubi

- **Formatter:** Hozircha qo‘lda — 2 space indent, `;` bilan, single quote emas double quote emas — mavjud fayllarga mos yozing.
- **TypeScript:** `strict: true`, `any` dan qoching, `Zod` validatsiyasidan foydalaning.
- **Xavfsizlik:** Yangi endpoint qo‘shsangiz — `requireAuth`/`requireCsrf` ni unutmang, `zod` validatsiya majburiy.
- **Xatoliklar:** `console.error` + foydalanuvchiga o‘zbekcha xabar (`error: '...'`) qaytaring.
- **Commitda sir saqlamang:** `.env`, `*.db`, `JWT_SECRET` ni commit qilmang (`.gitignore` da).

---

## 6. Xavfsizlik Hisoboti

Zaiflik topsangiz **ommaviy issue ochmang**:

- Email: `security@tinglov.uz` yoki GitHub → **Security → Report a vulnerability**
- `docs/SECURITY.md` dagi jadvalga qarang.

---

## 7. Yordam

- Savol bormi? — GitHub Discussions yoki Issues → `question` label.
- Hujjatlar: `README.md` · `docs/API.md` · `docs/ARCHITECTURE.md` · `docs/SETUP.md`

---

*Har bir hissa qadrlanadi — kichik typo tuzatish ham kata yordam!* ❤️
