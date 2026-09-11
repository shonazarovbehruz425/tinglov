/**
 * public/js/boot.js
 * ---------------------------------------------------------------------------
 * Render'dan OLDIN (pre-paint) ishlashi shart bo'lgan bootstrapping skripti.
 *
 * Nima uchun ALOHIDA fayl?
 *   CSP skript direktivasidan inline ruxsat ('unsafe-inline') olib tashlangan,
 *   shuning uchun index.html ichidagi inline script bloklari brauzer tomonidan
 *   bloklanardi. Ular mazmuni o'zgarmay qolgan holda shu tashqi (external)
 *   faylga ko'chirildi. index.html da BU SKRIPT SINXRON tarzda (defer/async'SIZ)
 *   ulanadi, chunki:
 *     - Dark-mode atributi FOUC (Flash of Unstyled Content) oldini olish uchun
 *       birinchi paint'dan oldin <html> tegiga qo'yilishi kerak;
 *     - Anti-clickjacking framebuster zararli iframe ichida birinchi kadrda
 *       sizib chiqishni oldini olish uchun darhol ishishi kerak.
 *   defer/async ishlatilsa, skript body parse bo'lgandan keyin ishlab, ikkala
 *   himoyani ham buyadi.
 *
 * Muhit: faqat brauzer (DOM) da ishlaydi, Hech qanday import/eksport yo'q —
 * oddiy klassik (classic) script sifatida <head> da sinxron yuklanadi.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * 1) Instant Dark Mode Init
   *    Saqlangan tema 'dark' bo'lsa, brauzer hech qanday "oq chaqnash"
   *    (theme flash) ko'rsatmasdan <html data-theme="dark" qo'yadi.
   * ------------------------------------------------------------------- */
  try {
    if (localStorage.getItem('movielisten_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    /* localStorage mavjud emas yoki bloklangan (masalan, private mode) —
     * e'tiborsiz qoldiram: standart (yorug') mavzu qo'llaniladi. */
  }

  /* ---------------------------------------------------------------------
   * 2) Anti-Clickjacking Defense-in-Depth (OWASP Framebuster)
   *    index.html head ichidagi <style id="antiClickjack"> body ni
   *    display:none qilgan holda ochadi. Agar sahifa o'z-ichi (top frame)
   *    bo'lsa, shu maskalani darhol olib tashlaymiz (FOUC derhasiga
   *    yetganda). Aks holda (iframe ichida) top window ni sahifaning
   *    o'z manziliga yo'naltiramiz — clickjacking ni buzamiz.
   * ------------------------------------------------------------------- */
  if (self === top) {
    var antiClickjack = document.getElementById('antiClickjack');
    if (antiClickjack && antiClickjack.parentNode) {
      antiClickjack.parentNode.removeChild(antiClickjack);
    }
  } else {
    top.location = self.location;
  }
})();
