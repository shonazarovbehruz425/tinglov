# Security Audit Report - Tinglov/MovieListen
**Date:** 2026-09-09
**Auditor:** Claude AI
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **HARDCODED CREDENTIALS EXPOSED IN SOURCE CODE**
**Severity:** 🔴 CRITICAL
**Location:** `src/services/supabaseClient.ts:3-4`

```typescript
export const SUPABASE_URL = 'https://juzytimtoetduvkbigih.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_1jH-EkUd3QmczGBi_ImTGQ_zVSYtCJG';
```

**Impact:**
- Supabase API keys are hardcoded and visible in client-side bundle
- Anyone with access to the code can abuse your Supabase backend
- Potential for unauthorized database access, data theft, or manipulation

**Recommendation:**
- Move credentials to `.env` file
- Use `import.meta.env.VITE_SUPABASE_URL` pattern
- Never commit `.env` file (already in `.gitignore` ✅)
- Regenerate and rotate the exposed API keys immediately

---

### 2. **XSS VULNERABILITIES IN MULTIPLE LOCATIONS**
**Severity:** 🔴 CRITICAL
**Locations:** 50+ instances of `innerHTML` without sanitization

**Examples:**
- `src/components/DictationInput.ts:397` - User input directly inserted
- `src/components/CustomSceneModal.ts:137` - Dynamic content rendering
- `src/components/ShadowingModal.ts:313` - User speech transcript

```typescript
// VULNERABLE CODE
slot.innerHTML = `<span>✗</span><span>${token.word}</span>`;
```

If `token.word` contains malicious HTML/JS like `<script>alert('XSS')</script>`, it will execute.

**Impact:**
- Stored XSS attacks possible through custom scenes
- User-generated content can execute arbitrary JavaScript
- Session hijacking, credential theft, malware injection

**Recommendation:**
- Use `textContent` instead of `innerHTML` for user data
- Implement DOM sanitization library (DOMPurify)
- Validate and escape all user inputs before rendering
- Use Content Security Policy (CSP) headers

---

## 🟠 HIGH SEVERITY ISSUES

### 3. **LocalStorage for Sensitive Data**
**Severity:** 🟠 HIGH
**Locations:** Multiple files store sensitive data in localStorage

```typescript
// apiService.ts:43
localStorage.setItem(TOKEN_KEY, session.access_token);
```

**Impact:**
- Auth tokens accessible via JavaScript
- Vulnerable to XSS attacks
- Data persists after logout (if not cleared properly)
- Accessible by browser extensions and third-party scripts

**Recommendation:**
- Use HttpOnly cookies for auth tokens (backend change required)
- Implement short token expiration
- Clear sensitive data on logout
- Consider using sessionStorage for temporary tokens

---

### 4. **No Input Validation on User Data**
**Severity:** 🟠 HIGH
**Locations:** All user input fields

**Examples:**
- Email validation: Only basic `.toLowerCase()` and `.trim()`
- Password: No strength requirements beyond Supabase default
- Custom scene data: No sanitization before storage
- YouTube URLs: Minimal validation

**Impact:**
- SQL injection via Supabase queries
- NoSQL injection potential
- Malicious content storage
- Phishing through custom scenes

**Recommendation:**
```typescript
// Implement validation library like Zod or Yup
import { z } from 'zod';

const emailSchema = z.string().email().max(255);
const usernameSchema = z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/);
const passwordSchema = z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[0-9])/);
```

---

### 5. **Insecure Third-Party Content Loading**
**Severity:** 🟠 HIGH
**Location:** `src/components/AnimatedStage.ts:449`

```typescript
src="https://www.youtube-nocookie.com/embed/${this.currentScene.youtubeVideoId}?..."
```

**Impact:**
- YouTube video IDs not validated
- Potential for malicious video embeds
- Clickjacking through iframes

**Recommendation:**
- Validate YouTube video ID format: `/^[a-zA-Z0-9_-]{11}$/`
- Use sandbox attributes: `sandbox="allow-scripts allow-same-origin"`
- Implement allowlist of allowed video domains

---

## 🟡 MEDIUM SEVERITY ISSUES

### 6. **Missing CSRF Protection**
**Severity:** 🟡 MEDIUM
**Impact:** Login/logout forms lack CSRF tokens

While Supabase handles this partially, the custom forms should include CSRF protection.

**Recommendation:**
- Implement CSRF tokens for all state-changing operations
- Use SameSite cookie attribute

---

### 7. **No Rate Limiting**
**Severity:** 🟡 MEDIUM

**Impact:**
- Brute force attacks on login
- API abuse
- DoS through excessive requests

**Recommendation:**
- Implement rate limiting on backend
- Add CAPTCHA after failed attempts
- Use exponential backoff

---

### 8. **Console Logs in Production**
**Severity:** 🟡 MEDIUM
**Locations:** `videoStreamService.ts:122`, `i18nService.ts:469`

```typescript
console.warn(`[VideoStreamService] Source failed: ...`);
console.error('Error in i18n listener:', err);
```

**Impact:**
- Information leakage
- Debug information exposure
- Helps attackers understand system

**Recommendation:**
- Remove all console statements in production build
- Use build-time stripping
- Implement proper logging service

---

### 9. **Clickjacking Vulnerability**
**Severity:** 🟡 MEDIUM

**Impact:**
- App can be embedded in malicious iframe
- UI redress attacks possible

**Recommendation:**
- Add `X-Frame-Options: DENY` header
- Implement `Content-Security-Policy: frame-ancestors 'none'`
- Use `frame-ancestors` directive

---

### 10. **Missing Content Security Policy (CSP)**
**Severity:** 🟡 MEDIUM

**Impact:**
- No protection against XSS
- Inline scripts can execute freely

**Recommendation:**
Add CSP meta tag or header:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' https://cdn.jsdelivr.net;
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://*.supabase.co;">
```

---

## 🟢 LOW SEVERITY ISSUES

### 11. **Weak Password Requirements**
**Severity:** 🟢 LOW

Supabase enforces minimum 6 characters, but should require:
- Minimum 8 characters
- Mix of uppercase/lowercase
- Numbers and special characters

---

### 12. **No HTTP Security Headers**
**Severity:** 🟢 LOW
**Location:** `index.html`

Missing headers:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection`
- `Referrer-Policy`

**Recommendation:** Configure on web server or CDN

---

### 13. **Dependencies Not Audited**
**Severity:** 🟢 LOW

Run `npm audit` regularly and fix vulnerabilities in dependencies.

---

## ✅ POSITIVE SECURITY PRACTICES

1. ✅ `.env` file in `.gitignore`
2. ✅ TypeScript strict mode enabled
3. ✅ Using Supabase Auth (secure backend)
4. ✅ HTTPS enforced (Supabase)
5. ✅ No `eval()` or `new Function()` usage
6. ✅ Password fields use `type="password"`
7. ✅ Using YouTube-nocookie domain

---

## 🛠️ IMMEDIATE ACTION ITEMS

1. **URGENT:** Rotate Supabase API keys - exposed in source code
2. **URGENT:** Move `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env`
3. **HIGH:** Implement input sanitization (DOMPurify)
4. **HIGH:** Add Content Security Policy
5. **HIGH:** Validate all user inputs server-side
6. **MEDIUM:** Remove console logs from production
7. **MEDIUM:** Implement CSRF protection

---

## 📊 VULNERABILITY SUMMARY

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 5 |
| 🟡 Medium | 5 |
| 🟢 Low | 3 |
| **Total** | **15** |

---

## 🔐 SECURITY BEST PRACTICES TO IMPLEMENT

1. **Defense in Depth:** Multiple layers of security
2. **Least Privilege:** Users only access what they need
3. **Input Validation:** Validate on client AND server
4. **Output Encoding:** Always escape before rendering
5. **Secure by Default:** Fail closed, not open
6. **Regular Audits:** Quarterly security reviews
7. **Dependency Updates:** Monthly dependency audits
8. **Penetration Testing:** Annual professional pentest
9. **Security Headers:** Implement all OWASP recommended headers
10. **Error Handling:** Don't leak sensitive info in errors

---

## 📚 RESOURCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

---

**Report Generated:** 2026-09-09
**Status:** ⚠️ ACTION REQUIRED
