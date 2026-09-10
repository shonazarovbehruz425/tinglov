import { storageService } from '../services/storageService';
import { soundEffects } from '../services/soundEffects';
import { i18n, AppLanguage } from '../services/i18nService';
import { escapeHtml } from '../utils/sanitize';

export class SettingsView {
  private container: HTMLElement;
  private onBackToLibraryCallback: (() => void) | null = null;
  private onOpenProfileCallback: (() => void) | null = null;
  private onSettingsChangedCallback: (() => void) | null = null;
  private onThemeOrSoundChangedCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onBackToLibrary: () => void;
    onOpenProfile: () => void;
    onSettingsChanged: () => void;
    onThemeOrSoundChanged?: () => void;
  }): void {
    this.onBackToLibraryCallback = callbacks.onBackToLibrary;
    this.onOpenProfileCallback = callbacks.onOpenProfile;
    this.onSettingsChangedCallback = callbacks.onSettingsChanged;
    this.onThemeOrSoundChangedCallback = callbacks.onThemeOrSoundChanged || null;
  }

  public render(): void {
    const stats = storageService.getStats();
    const t = i18n.t();
    const curLang = i18n.getLanguage();
    const isSound = soundEffects.isSoundEnabled();

    const userName = stats.userName || 'Foydalanuvchi';
    const userHandle = stats.userHandle || '@til_organuvchi';

    this.container.innerHTML = `
      <div class="dedicated-page-layout">
        <!-- Top Navigation -->
        <div class="page-top-nav-bar">
          <button class="page-back-btn" id="settingsBackToLibBtn">
            <i class="ph ph-arrow-left"></i>
            <span>${t.backToLibrary}</span>
          </button>
          <div class="page-title-badge">
            <i class="ph ph-gear-six"></i>
            <span>${t.manageAccount}</span>
          </div>
          <button class="page-action-link-btn" id="settingsGoToProfileBtn">
            <i class="ph ph-user"></i>
            <span>${t.viewProfile}</span>
          </button>
        </div>

        <div class="settings-page-grid">
          <!-- Left Main Settings Cards -->
          <div class="settings-main-col">
            <!-- 1. Language Preferences Section -->
            <div class="settings-card-panel">
              <div class="settings-card-header">
                <div class="settings-icon-circle"><i class="ph ph-translate"></i></div>
                <div>
                  <h3 class="settings-card-title" id="settingsLangTitle">${t.language} (Language)</h3>
                  <p class="settings-card-sub" id="settingsLangSub">${t.selectLanguage}</p>
                </div>
              </div>

              <div class="settings-lang-cards-grid" id="settingsLangCardsGrid">
                <div class="settings-lang-glider" id="settingsLangGlider"></div>

                <div class="settings-lang-item ${curLang === 'uz' ? 'active' : ''}" data-lang="uz">
                  <span class="lang-code-tag">UZ</span>
                  <div class="lang-meta">
                    <strong>O‘zbekcha</strong>
                    <span>Asosiy interfeys tili</span>
                  </div>
                </div>

                <div class="settings-lang-item ${curLang === 'en' ? 'active' : ''}" data-lang="en">
                  <span class="lang-code-tag">GB</span>
                  <div class="lang-meta">
                    <strong>English</strong>
                    <span>Full English experience</span>
                  </div>
                </div>

                <div class="settings-lang-item ${curLang === 'ru' ? 'active' : ''}" data-lang="ru">
                  <span class="lang-code-tag">RU</span>
                  <div class="lang-meta">
                    <strong>Русский</strong>
                    <span>Русский интерфейс и перевод</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Profile Details Section -->
            <div class="settings-card-panel">
              <div class="settings-card-header">
                <div class="settings-icon-circle"><i class="ph ph-user-gear"></i></div>
                <div>
                  <h3 class="settings-card-title" id="settingsProfileTitle">${t.editProfile}</h3>
                  <p class="settings-card-sub">Ismingiz va foydalanuvchi taxingizni o‘zgartiring</p>
                </div>
              </div>

              <form id="settingsProfileForm" class="settings-form-layout">
                <div class="settings-form-field">
                  <label class="settings-field-label" id="settingsNameLabel">${t.yourName}</label>
                  <input type="text" id="settingsNameInput" class="form-clean-input" value="${escapeHtml(userName)}" required />
                </div>

                <div class="settings-form-field">
                  <label class="settings-field-label" id="settingsHandleLabel">${t.userHandle}</label>
                  <input type="text" id="settingsHandleInput" class="form-clean-input" value="${escapeHtml(userHandle)}" required />
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                  <button type="submit" class="card-continue-btn" id="saveProfileSettingsBtn" style="padding: 0.6rem 1.4rem;">
                    <i class="ph ph-floppy-disk"></i> ${t.save}
                  </button>
                </div>
              </form>
            </div>

            <!-- 3. Audio & Display Experience -->
            <div class="settings-card-panel">
              <div class="settings-card-header">
                <div class="settings-icon-circle"><i class="ph ph-sliders"></i></div>
                <div>
                  <h3 class="settings-card-title">Tizim va Vizual Sozlamalar</h3>
                  <p class="settings-card-sub">Ovoz effektlari va tashqi ko‘rinish</p>
                </div>
              </div>

                <div class="settings-toggle-row">
                  <div class="toggle-info">
                    <span class="toggle-title"><i class="ph ph-speaker-high"></i> ${t.sound} va Haptika (Vibration)</span>
                    <span class="toggle-desc">Har bir to‘g‘ri harfda yoqimli chertish, xatoda esa tebranish (vibration) signali</span>
                  </div>
                  <button class="settings-switch-btn ${isSound ? 'active' : ''}" id="settingsSoundToggle">
                    <span class="switch-knob"></span>
                  </button>
                </div>

                <!-- Theme Mode Selector: Light, Dark, OLED Pure Black -->
                <div class="settings-theme-selector-block">
                  <div class="theme-selector-labels">
                    <span class="toggle-title"><i class="ph ph-paint-brush"></i> Interfeys Mavzusi</span>
                    <span class="toggle-desc">Ko‘zni charchatmaydigan, faqat video va matnga fokuslangan dizaynlar</span>
                  </div>
                  <div class="theme-choice-buttons-row" id="themeChoiceButtonsRow">
                    <button class="theme-chip-btn ${!document.documentElement.getAttribute('data-theme') ? 'active' : ''}" data-theme="light">
                      <i class="ph ph-sun"></i>
                      <span>Kunduzgi</span>
                    </button>
                    <button class="theme-chip-btn ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'active' : ''}" data-theme="dark">
                      <i class="ph ph-moon"></i>
                      <span>Qulay Qora (Dark)</span>
                    </button>
                    <button class="theme-chip-btn ${document.documentElement.getAttribute('data-theme') === 'oled' ? 'active' : ''}" data-theme="oled">
                      <i class="ph ph-circle-half-tilt" style="color: #A855F7;"></i>
                      <span>OLED Pure Black</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Sidebar Helper Info -->
          <div class="settings-side-col">
            <div class="settings-info-card">
              <div class="info-card-badge">Tinglov v2.4</div>
              <h4>Aqlli Ta'lim Tizimi</h4>
              <p>Barcha o‘zgarishlar darhol saqlanadi va qurilmangiz keshida sinxronlanadi.</p>
              <div class="settings-badge-stat">
                <i class="ph ph-shield-check"></i>
                <span>Xavfsiz Oflayn Kesh</span>
              </div>
            </div>

            <div class="settings-info-card danger-zone">
              <h4>Akkaunt Amallari</h4>
              <p>Tizimdan chiqish yoki ma'lumotlarni qayta tiklash</p>
              <button class="settings-danger-btn" id="settingsSignOutBtn">
                <i class="ph ph-sign-out"></i> ${t.signOut}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();

    // Position glider at active language card
    const activeCard = this.container.querySelector<HTMLElement>('.settings-lang-item.active');
    if (activeCard) {
      this.updateGlider(activeCard, false);
    }
  }

  private updateGlider(activeCard: HTMLElement, animate: boolean = true): void {
    const glider = this.container.querySelector<HTMLElement>('#settingsLangGlider');
    const grid = this.container.querySelector<HTMLElement>('#settingsLangCardsGrid');
    if (!glider || !grid || !activeCard) return;

    const gridRect = grid.getBoundingClientRect();
    const cardRect = activeCard.getBoundingClientRect();
    const leftOffset = cardRect.left - gridRect.left;
    const cardWidth = cardRect.width;

    if (!animate) {
      glider.style.transition = 'none';
    } else {
      glider.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease';
    }

    glider.style.width = `${cardWidth}px`;
    glider.style.transform = `translateX(${leftOffset}px)`;
    glider.style.opacity = '1';

    if (!animate) {
      requestAnimationFrame(() => {
        glider.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease';
      });
    }
  }

  private updateStaticTexts(): void {
    const t = i18n.t();
    const backBtn = this.container.querySelector('#settingsBackToLibBtn span');
    if (backBtn) backBtn.textContent = t.backToLibrary;

    const pageBadge = this.container.querySelector('.page-title-badge span');
    if (pageBadge) pageBadge.textContent = t.manageAccount;

    const profileLink = this.container.querySelector('#settingsGoToProfileBtn span');
    if (profileLink) profileLink.textContent = t.viewProfile;

    const langTitle = this.container.querySelector('#settingsLangTitle');
    if (langTitle) langTitle.textContent = `${t.language} (Language)`;

    const langSub = this.container.querySelector('#settingsLangSub');
    if (langSub) langSub.textContent = t.selectLanguage;

    const profileTitle = this.container.querySelector('#settingsProfileTitle');
    if (profileTitle) profileTitle.textContent = t.editProfile;

    const nameLabel = this.container.querySelector('#settingsNameLabel');
    if (nameLabel) nameLabel.textContent = t.yourName;

    const handleLabel = this.container.querySelector('#settingsHandleLabel');
    if (handleLabel) handleLabel.textContent = t.userHandle;

    const saveBtn = this.container.querySelector('#saveProfileSettingsBtn');
    if (saveBtn) saveBtn.innerHTML = `<i class="ph ph-floppy-disk"></i> ${t.save}`;

    const themeTitle = this.container.querySelector('#settingsThemeTitle');
    if (themeTitle) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeTitle.innerHTML = `<i class="ph ph-${isDark ? 'moon' : 'sun'}"></i> ${t.themeNight} / ${t.themeDay}`;
    }

    const signOutBtn = this.container.querySelector('#settingsSignOutBtn');
    if (signOutBtn) signOutBtn.innerHTML = `<i class="ph ph-sign-out"></i> ${t.signOut}`;
  }

  private bindEvents(): void {
    this.container.querySelector('#settingsBackToLibBtn')?.addEventListener('click', () => {
      this.onBackToLibraryCallback?.();
    });

    this.container.querySelector('#settingsGoToProfileBtn')?.addEventListener('click', () => {
      this.onOpenProfileCallback?.();
    });

    // Language switcher with smooth spring glider
    const langCards = this.container.querySelectorAll<HTMLElement>('.settings-lang-item');
    langCards.forEach(card => {
      card.addEventListener('click', () => {
        const lang = card.dataset.lang as AppLanguage;
        if (lang && lang !== i18n.getLanguage()) {
          i18n.setLanguage(lang);
          soundEffects.playKeyClick();

          langCards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          this.updateGlider(card, true);
          this.updateStaticTexts();
          this.onSettingsChangedCallback?.();
        }
      });
    });

    window.addEventListener('resize', () => {
      const active = this.container.querySelector<HTMLElement>('.settings-lang-item.active');
      if (active) this.updateGlider(active, false);
    });

    // Profile form
    const form = this.container.querySelector<HTMLFormElement>('#settingsProfileForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = this.container.querySelector<HTMLInputElement>('#settingsNameInput');
      const handleInput = this.container.querySelector<HTMLInputElement>('#settingsHandleInput');
      if (nameInput && handleInput) {
        storageService.updateProfile(nameInput.value, handleInput.value);
        this.onSettingsChangedCallback?.();
        soundEffects.playSentenceComplete();
        alert("Ma'lumotlar muvaffaqiyatli saqlandi!");
        this.render();
      }
    });

    // Sound toggle
    const soundToggle = this.container.querySelector('#settingsSoundToggle');
    soundToggle?.addEventListener('click', () => {
      const newState = !soundEffects.isSoundEnabled();
      soundEffects.setSoundEnabled(newState);
      soundToggle.classList.toggle('active', newState);
      if (newState) {
        soundEffects.playKeyClick();
      }
      this.onThemeOrSoundChangedCallback?.();
    });

    // Theme selector chips (Light, Dark, OLED)
    const themeChips = this.container.querySelectorAll('.theme-chip-btn');
    themeChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const selectedTheme = target.dataset.theme as 'light' | 'dark' | 'oled';

        soundEffects.playKeyClick();
        themeChips.forEach(c => c.classList.remove('active'));
        target.classList.add('active');

        if (selectedTheme === 'dark' || selectedTheme === 'oled') {
          document.documentElement.setAttribute('data-theme', selectedTheme);
          localStorage.setItem('movielisten_theme', selectedTheme);
        } else {
          document.documentElement.removeAttribute('data-theme');
          localStorage.setItem('movielisten_theme', 'light');
        }

        this.onThemeOrSoundChangedCallback?.();
      });
    });

    // Sign out
    this.container.querySelector('#settingsSignOutBtn')?.addEventListener('click', () => {
      if (confirm(i18n.t().signOutConfirm)) {
        storageService.updateProfile('Mehmon', '@mehmon');
        this.onSettingsChangedCallback?.();
        this.onBackToLibraryCallback?.();
      }
    });
  }
}
