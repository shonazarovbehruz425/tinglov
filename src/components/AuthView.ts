import { apiService, AuthUser } from '../services/apiService';
import { soundEffects } from '../services/soundEffects';
import { storageService } from '../services/storageService';
import { escapeHtml } from '../utils/sanitize';
import { safeValidate, registerSchema, loginSchema } from '../utils/validation';

export class AuthView {
  private container: HTMLElement;
  private activeTab: 'login' | 'register' = 'login';
  private onAuthSuccessCallback: ((user: AuthUser) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setOnAuthSuccess(callback: (user: AuthUser) => void): void {
    this.onAuthSuccessCallback = callback;
  }

  public render(tab: 'login' | 'register' = 'login'): void {
    const existingToggle = this.container.querySelector('#pageAuthTabsToggle');
    if (existingToggle) {
      this.switchTab(tab);
      return;
    }

    this.activeTab = tab;
    this.container.innerHTML = `
      <div class="auth-page-wrapper">
        <div class="auth-page-grid-overlay"></div>
        <div class="auth-page-bg-glow glow-1"></div>
        <div class="auth-page-bg-glow glow-2"></div>
        <div class="auth-page-bg-glow glow-3"></div>

        <div class="auth-page-container">
          <!-- Left: Hero Branding & Features -->
          <div class="auth-page-hero">
            <div class="auth-hero-brand">
              <img src="/logo-full.png" alt="Tinglov Logo" class="auth-hero-logo" />
              <div class="auth-hero-tag-badge">
                <span class="auth-tag-pulse"></span>
                <span>Language Mastery Platform</span>
              </div>
            </div>

            <h2 class="auth-hero-title">
              Kino va multfilmlar orqali ingliz tilini <span>eshitib tushuning</span>
            </h2>
            <p class="auth-hero-sub">
              Dunyodagi eng sara film va multfilm dialoglari asosida listening hamda imloni interaktiv diktant bilan o‘rganing.
            </p>

            <div class="auth-hero-features">
              <div class="auth-feature-item">
                <div class="auth-feature-icon"><i class="ph ph-film-slate"></i></div>
                <div class="auth-feature-text">
                  <h4>Haqiqiy dialoglar</h4>
                  <p>Jonli aktyorlar va qahramonlar talaffuzida eshitish ko‘nikmasi</p>
                </div>
              </div>

              <div class="auth-feature-item">
                <div class="auth-feature-icon"><i class="ph ph-keyboard"></i></div>
                <div class="auth-feature-text">
                  <h4>Interaktiv diktant</h4>
                  <p>Harflarni yozib, har bir so‘zni aniq va chuqur eslab qoling</p>
                </div>
              </div>

              <div class="auth-feature-item">
                <div class="auth-feature-icon"><i class="ph ph-fire"></i></div>
                <div class="auth-feature-text">
                  <h4>Streak va XP reytingi</h4>
                  <p>Har kuni dars qilib, do‘stlaringiz va boshqalar bilan bellashing</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Auth Form Card -->
          <div class="auth-page-form-wrapper">
            <div class="auth-page-card">
              <!-- Header with tabs -->
              <div class="auth-card-top">
                <div class="auth-tabs-toggle" id="pageAuthTabsToggle" data-active="${this.activeTab}">
                  <div class="auth-tab-slider"></div>
                  <button type="button" class="auth-tab-choice ${this.activeTab === 'login' ? 'active' : ''}" id="pageTabLogin">
                    <i class="ph ph-sign-in"></i> <span>Kirish</span>
                  </button>
                  <button type="button" class="auth-tab-choice ${this.activeTab === 'register' ? 'active' : ''}" id="pageTabRegister">
                    <i class="ph ph-user-plus"></i> <span>Ro‘yxatdan o‘tish</span>
                  </button>
                </div>
              </div>

              <div class="auth-card-heading">
                <h3 class="auth-card-title" id="authCardTitle">
                  ${this.activeTab === 'login' ? 'Xush kelibsiz!' : 'Yangi hisob yaratish'}
                </h3>
                <p class="auth-card-desc" id="authCardDesc">
                  ${this.activeTab === 'login' 
                    ? 'Platformaga kirish uchun ma‘lumotlaringizni kiriting' 
                    : 'Bepul ro‘yxatdan o‘ting va o‘rganishni boshlang'}
                </p>
              </div>

              <!-- Alert Box -->
              <div id="pageAuthAlertBox" class="auth-page-alert" style="display: none;"></div>

              <!-- Social Google Sign-In -->
              <div class="auth-social-section">
                <button type="button" class="auth-google-btn" id="pageGoogleSignInBtn">
                  <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Google orqali davom etish</span>
                </button>

                <div class="auth-divider">
                  <span>yoki</span>
                </div>
              </div>

              <!-- Forms Slider -->
              <div class="auth-card-body">
                <div class="auth-form-slide ${this.activeTab === 'login' ? 'active' : ''}" id="loginSlide" style="display: ${this.activeTab === 'login' ? 'block' : 'none'};">
                  ${this.renderLoginFormHtml()}
                </div>
                <div class="auth-form-slide ${this.activeTab === 'register' ? 'active' : ''}" id="registerSlide" style="display: ${this.activeTab === 'register' ? 'block' : 'none'};">
                  ${this.renderRegisterFormHtml()}
                </div>
              </div>

              <!-- Footer Switcher -->
              <div class="auth-card-footer" id="authCardFooter">
                <span id="authFooterText">${this.activeTab === 'login' ? 'Akkauntingiz yo‘qmi?' : 'Hisobingiz bormi?'}</span>
                <button type="button" class="auth-switch-link" id="authFooterSwitchBtn">
                  ${this.activeTab === 'login' ? 'Ro‘yxatdan o‘tish' : 'Kirish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderLoginFormHtml(): string {
    return `
      <form class="auth-page-form" id="pageLoginForm" autocomplete="on">
        <div class="auth-form-field">
          <label for="pageLoginId">Foydalanuvchi nomi yoki Email</label>
          <div class="auth-field-input-box">
            <i class="ph ph-user field-icon"></i>
            <input
              type="text"
              id="pageLoginId"
              name="username"
              class="auth-text-input"
              placeholder="masalan: behruz_99 yoki email@domain.com"
              required
              autocomplete="username"
            />
          </div>
        </div>

        <div class="auth-form-field">
          <label for="pageLoginPw">Parol</label>
          <div class="auth-field-input-box">
            <i class="ph ph-lock-key field-icon"></i>
            <input
              type="password"
              id="pageLoginPw"
              name="password"
              class="auth-text-input"
              placeholder="Parolingizni kiriting"
              required
              autocomplete="current-password"
            />
            <button type="button" class="pw-eye-btn" id="pageLoginPwToggle" title="Parolni ko‘rsatish">
              <i class="ph ph-eye"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="auth-submit-btn" id="pageLoginSubmitBtn">
          <span class="btn-text">Kirish</span>
          <i class="ph ph-arrow-right"></i>
        </button>
      </form>
    `;
  }

  private renderRegisterFormHtml(): string {
    return `
      <form class="auth-page-form" id="pageRegisterForm" autocomplete="on">
        <div class="auth-form-field">
          <label for="pageRegFullName">Ism va familiya (ixtiyoriy)</label>
          <div class="auth-field-input-box">
            <i class="ph ph-identification-card field-icon"></i>
            <input
              type="text"
              id="pageRegFullName"
              name="name"
              class="auth-text-input"
              placeholder="masalan: Behruz Shonazarov"
              autocomplete="name"
            />
          </div>
        </div>

        <div class="auth-form-field">
          <label for="pageRegUsername">Login (foydalanuvchi nomi) *</label>
          <div class="auth-field-input-box">
            <i class="ph ph-at field-icon"></i>
            <input
              type="text"
              id="pageRegUsername"
              name="username"
              class="auth-text-input"
              placeholder="masalan: behruz99 (kamida 3 belgi)"
              required
              minlength="3"
              autocomplete="username"
            />
          </div>
        </div>

        <div class="auth-form-field">
          <label for="pageRegEmail">Email manzil *</label>
          <div class="auth-field-input-box">
            <i class="ph ph-envelope-simple field-icon"></i>
            <input
              type="email"
              id="pageRegEmail"
              name="email"
              class="auth-text-input"
              placeholder="masalan: behruz@gmail.com"
              required
              autocomplete="email"
            />
          </div>
        </div>

        <div class="auth-form-field">
          <label for="pageRegPw">Parol *</label>
          <div class="auth-field-input-box">
            <i class="ph ph-lock-key field-icon"></i>
            <input
              type="password"
              id="pageRegPw"
              name="new-password"
              class="auth-text-input"
              placeholder="Kamida 8 ta belgi (1 ta katta harf va raqam)"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <button type="button" class="pw-eye-btn" id="pageRegPwToggle" title="Parolni ko‘rsatish">
              <i class="ph ph-eye"></i>
            </button>
          </div>
          <span class="auth-field-hint" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; display: block;">Kamida 8 ta belgi, 1 ta katta harf (A-Z) va 1 ta raqam (0-9)</span>
        </div>

        <button type="submit" class="auth-submit-btn" id="pageRegSubmitBtn">
          <span class="btn-text">Ro‘yxatdan o‘tish</span>
          <i class="ph ph-arrow-right"></i>
        </button>
      </form>
    `;
  }

  public showAlert(msg: string, type: 'error' | 'success'): void {
    const alertBox = this.container.querySelector<HTMLElement>('#pageAuthAlertBox');
    if (!alertBox) return;
    alertBox.className = `auth-page-alert ${type}`;
    alertBox.innerHTML = `
      <i class="ph ph-${type === 'error' ? 'warning-circle' : 'check-circle'}"></i>
      <span>${escapeHtml(msg)}</span>
    `;
    alertBox.style.display = 'flex';
  }

  private clearAlert(): void {
    const alertBox = this.container.querySelector<HTMLElement>('#pageAuthAlertBox');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.innerHTML = '';
    }
  }

  private setBtnLoading(btn: HTMLButtonElement | null, isLoading: boolean, defaultText: string): void {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `<i class="ph ph-spinner-gap auth-spinner"></i> <span>Iltimos, kuting...</span>`;
    } else {
      btn.innerHTML = `<span class="btn-text">${defaultText}</span> <i class="ph ph-arrow-right"></i>`;
    }
  }

  public switchTab(tab: 'login' | 'register'): void {
    if (this.activeTab === tab) return;

    this.activeTab = tab;

    // 1. Sliding pill animation
    const toggleEl = this.container.querySelector<HTMLElement>('#pageAuthTabsToggle');
    if (toggleEl) {
      toggleEl.setAttribute('data-active', tab);
    }

    const tabLoginBtn = this.container.querySelector('#pageTabLogin');
    const tabRegBtn = this.container.querySelector('#pageTabRegister');
    tabLoginBtn?.classList.toggle('active', tab === 'login');
    tabRegBtn?.classList.toggle('active', tab === 'register');

    // 2. Headings with soft fade
    const titleEl = this.container.querySelector<HTMLElement>('#authCardTitle');
    const descEl = this.container.querySelector<HTMLElement>('#authCardDesc');
    if (titleEl && descEl) {
      titleEl.style.opacity = '0';
      descEl.style.opacity = '0';
      titleEl.style.transform = 'translateY(-4px)';
      descEl.style.transform = 'translateY(-4px)';
      setTimeout(() => {
        titleEl.textContent = tab === 'login' ? 'Xush kelibsiz!' : 'Yangi hisob yaratish';
        descEl.textContent = tab === 'login'
          ? 'Platformaga kirish uchun ma‘lumotlaringizni kiriting'
          : 'Bepul ro‘yxatdan o‘ting va o‘rganishni boshlang';
        titleEl.style.opacity = '1';
        descEl.style.opacity = '1';
        titleEl.style.transform = 'translateY(0)';
        descEl.style.transform = 'translateY(0)';
      }, 140);
    }

    // 3. Clear alert box
    this.clearAlert();

    // 4. Form slides with smooth sliding animation
    const loginSlide = this.container.querySelector<HTMLElement>('#loginSlide');
    const regSlide = this.container.querySelector<HTMLElement>('#registerSlide');

    if (loginSlide && regSlide) {
      if (tab === 'login') {
        regSlide.style.display = 'none';
        regSlide.classList.remove('active', 'slide-in-right', 'slide-in-left');

        loginSlide.style.display = 'block';
        loginSlide.classList.remove('slide-in-right', 'slide-in-left');
        void loginSlide.offsetWidth; // trigger reflow
        loginSlide.classList.add('active', 'slide-in-left');
        this.container.querySelector<HTMLInputElement>('#pageLoginId')?.focus();
      } else {
        loginSlide.style.display = 'none';
        loginSlide.classList.remove('active', 'slide-in-right', 'slide-in-left');

        regSlide.style.display = 'block';
        regSlide.classList.remove('slide-in-right', 'slide-in-left');
        void regSlide.offsetWidth; // trigger reflow
        regSlide.classList.add('active', 'slide-in-right');
        this.container.querySelector<HTMLInputElement>('#pageRegFullName')?.focus();
      }
    }

    // 5. Footer Switcher
    const footerText = this.container.querySelector<HTMLElement>('#authFooterText');
    const footerBtn = this.container.querySelector<HTMLElement>('#authFooterSwitchBtn');
    if (footerText && footerBtn) {
      footerText.textContent = tab === 'login' ? 'Akkauntingiz yo‘qmi?' : 'Hisobingiz bormi?';
      footerBtn.textContent = tab === 'login' ? 'Ro‘yxatdan o‘tish' : 'Kirish';
    }

    // 6. Update URL and title smoothly
    try {
      const newPath = tab === 'register' ? '/register' : '/login';
      const newTitle = `${tab === 'register' ? 'Ro‘yxatdan o‘tish' : 'Kirish'} — Tinglov`;
      window.history.replaceState({ path: newPath }, newTitle, newPath);
      document.title = newTitle;
    } catch {}
  }

  private bindEvents(): void {
    // Tabs click
    this.container.querySelector('#pageTabLogin')?.addEventListener('click', () => {
      this.switchTab('login');
    });

    this.container.querySelector('#pageTabRegister')?.addEventListener('click', () => {
      this.switchTab('register');
    });

    this.container.querySelector('#authFooterSwitchBtn')?.addEventListener('click', () => {
      this.switchTab(this.activeTab === 'login' ? 'register' : 'login');
    });

    // Google Sign-In button
    this.container.querySelector('#pageGoogleSignInBtn')?.addEventListener('click', async () => {
      const res = await apiService.signInWithGoogle();
      if (res?.error) {
        this.showAlert(res.error, 'error');
      }
    });

    // Password toggles
    this.setupPasswordToggle('pageLoginPw', 'pageLoginPwToggle');
    this.setupPasswordToggle('pageRegPw', 'pageRegPwToggle');

    // Login submit
    const loginForm = this.container.querySelector<HTMLFormElement>('#pageLoginForm');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.clearAlert();

      const idInput = this.container.querySelector<HTMLInputElement>('#pageLoginId');
      const pwInput = this.container.querySelector<HTMLInputElement>('#pageLoginPw');
      const submitBtn = this.container.querySelector<HTMLButtonElement>('#pageLoginSubmitBtn');

      if (!idInput || !pwInput) return;

      const validation = safeValidate(loginSchema, {
        identifier: idInput.value,
        password: pwInput.value,
      });

      if (!validation.success) {
        soundEffects.triggerErrorFeedback();
        this.showAlert(validation.error, 'error');
        return;
      }

      this.setBtnLoading(submitBtn, true, 'Kirish');
      const result = await apiService.login({
        identifier: idInput.value,
        password: pwInput.value,
      });
      this.setBtnLoading(submitBtn, false, 'Kirish');

      if (result.error) {
        soundEffects.triggerErrorFeedback();
        this.showAlert(result.error, 'error');
      } else if (result.user) {
        soundEffects.playLevelUp();
        this.showAlert('Muvaffaqiyatli kirdingiz! Darslar ochilmoqda...', 'success');
        this.syncUserOnAuth(result.user);

        setTimeout(() => {
          this.onAuthSuccessCallback?.(result.user!);
        }, 500);
      }
    });

    // Register submit
    const regForm = this.container.querySelector<HTMLFormElement>('#pageRegisterForm');
    regForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.clearAlert();

      const nameInput = this.container.querySelector<HTMLInputElement>('#pageRegFullName');
      const userInput = this.container.querySelector<HTMLInputElement>('#pageRegUsername');
      const emailInput = this.container.querySelector<HTMLInputElement>('#pageRegEmail');
      const pwInput = this.container.querySelector<HTMLInputElement>('#pageRegPw');
      const submitBtn = this.container.querySelector<HTMLButtonElement>('#pageRegSubmitBtn');

      if (!userInput || !emailInput || !pwInput) return;

      const validation = safeValidate(registerSchema, {
        fullName: nameInput?.value,
        username: userInput.value,
        email: emailInput.value,
        password: pwInput.value,
      });

      if (!validation.success) {
        soundEffects.triggerErrorFeedback();
        this.showAlert(validation.error, 'error');
        return;
      }

      this.setBtnLoading(submitBtn, true, 'Ro‘yxatdan o‘tish');
      const result = await apiService.register({
        fullName: nameInput?.value,
        username: userInput.value,
        email: emailInput.value,
        password: pwInput.value,
      });
      this.setBtnLoading(submitBtn, false, 'Ro‘yxatdan o‘tish');

      if (result.error) {
        soundEffects.triggerErrorFeedback();
        this.showAlert(result.error, 'error');
      } else if (result.user) {
        soundEffects.playLevelUp();
        this.showAlert('Tabriklaymiz! Hisobingiz yaratildi.', 'success');
        this.syncUserOnAuth(result.user);

        setTimeout(() => {
          this.onAuthSuccessCallback?.(result.user!);
        }, 500);
      }
    });
  }

  private setupPasswordToggle(inputId: string, btnId: string): void {
    const input = this.container.querySelector<HTMLInputElement>(`#${inputId}`);
    const btn = this.container.querySelector<HTMLButtonElement>(`#${btnId}`);
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.innerHTML = `<i class="ph ph-${isPw ? 'eye-slash' : 'eye'}"></i>`;
    });
  }

  private syncUserOnAuth(user: AuthUser): void {
    const localStats = storageService.getStats();
    localStats.userName = user.full_name || user.username;
    localStats.userHandle = `@${user.username}`;
    localStats.xp = Math.max(localStats.xp, user.xp);
    localStats.streak = Math.max(localStats.streak, user.streak);
    localStats.level = Math.max(localStats.level, user.level);
    storageService.saveStats();

    if (localStats.savedWords.length > 0) {
      apiService.syncProgress({
        xp: localStats.xp,
        streak: localStats.streak,
        level: localStats.level,
        savedWords: localStats.savedWords.map(sw => ({
          word: sw.word,
          translation: sw.translation,
          sceneTitle: sw.movieName,
        })),
      });
    }
  }
}
