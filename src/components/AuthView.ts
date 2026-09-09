import { apiService, AuthUser } from '../services/apiService';
import { soundEffects } from '../services/soundEffects';
import { storageService } from '../services/storageService';

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
    this.activeTab = tab;
    this.container.innerHTML = `
      <div class="auth-page-wrapper">
        <div class="auth-page-bg-glow glow-1"></div>
        <div class="auth-page-bg-glow glow-2"></div>

        <div class="auth-page-container">
          <!-- Left: Hero Branding & Features -->
          <div class="auth-page-hero">
            <div class="auth-hero-brand">
              <img src="/logo.png" alt="Tinglov" class="auth-hero-logo" />
              <div class="auth-hero-brand-info">
                <h1 class="auth-hero-brand-name">Ting<span>lov</span></h1>
                <span class="auth-hero-brand-tag">Language Mastery</span>
              </div>
            </div>

            <h2 class="auth-hero-title">
              Kino va multfilmlar orqali ingliz tilini <span>eshitib tushuning</span>
            </h2>
            <p class="auth-hero-sub">
              Dunyodagi eng sevimli filmlar audio dialoglari asosida listening va imloni interaktiv diktant bilan o‘rganing.
            </p>

            <div class="auth-hero-features">
              <div class="auth-feature-item">
                <div class="auth-feature-icon"><i class="ph ph-film-slate"></i></div>
                <div class="auth-feature-text">
                  <h4>Haqiqiy dialoglar</h4>
                  <p>Jonli aktyorlar va qahramonlar talaffuzida o‘rganing</p>
                </div>
              </div>

              <div class="auth-feature-item">
                <div class="auth-feature-icon"><i class="ph ph-keyboard"></i></div>
                <div class="auth-feature-text">
                  <h4>Interaktiv diktant</h4>
                  <p>Harflarni yozib, har bir so‘zni chuqur eslab qoling</p>
                </div>
              </div>

              <div class="auth-feature-item">
                <div class="auth-feature-icon"><i class="ph ph-fire"></i></div>
                <div class="auth-feature-text">
                  <h4>Streak va XP reytingi</h4>
                  <p>Har kuni dars qilib, boshqa foydalanuvchilar bilan bellashing</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Auth Form Card -->
          <div class="auth-page-form-wrapper">
            <div class="auth-page-card">
              <!-- Header with tabs -->
              <div class="auth-card-top">
                <div class="auth-tabs-toggle">
                  <button class="auth-tab-choice ${this.activeTab === 'login' ? 'active' : ''}" id="pageTabLogin">
                    <i class="ph ph-sign-in"></i> Kirish
                  </button>
                  <button class="auth-tab-choice ${this.activeTab === 'register' ? 'active' : ''}" id="pageTabRegister">
                    <i class="ph ph-user-plus"></i> Ro‘yxatdan o‘tish
                  </button>
                </div>
              </div>

              <div class="auth-card-heading">
                <h3 class="auth-card-title">
                  ${this.activeTab === 'login' ? 'Xush kelibsiz!' : 'Yangi hisob yaratish'}
                </h3>
                <p class="auth-card-desc">
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

              <!-- Forms -->
              <div class="auth-card-body">
                ${this.activeTab === 'login' ? this.renderLoginFormHtml() : this.renderRegisterFormHtml()}
              </div>

              <!-- Footer Switcher -->
              <div class="auth-card-footer">
                ${this.activeTab === 'login' ? `
                  <span>Akkauntingiz yo‘qmi?</span>
                  <button type="button" class="auth-switch-link" id="pageSwitchToRegisterBtn">
                    Ro‘yxatdan o‘tish
                  </button>
                ` : `
                  <span>Hisobingiz bormi?</span>
                  <button type="button" class="auth-switch-link" id="pageSwitchToLoginBtn">
                    Kirish
                  </button>
                `}
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
              placeholder="Kamida 6 ta belgi"
              required
              minlength="6"
              autocomplete="new-password"
            />
            <button type="button" class="pw-eye-btn" id="pageRegPwToggle" title="Parolni ko‘rsatish">
              <i class="ph ph-eye"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="auth-submit-btn" id="pageRegSubmitBtn">
          <span class="btn-text">Ro‘yxatdan o‘tish</span>
          <i class="ph ph-arrow-right"></i>
        </button>
      </form>
    `;
  }

  private showAlert(msg: string, type: 'error' | 'success'): void {
    const alertBox = this.container.querySelector<HTMLElement>('#pageAuthAlertBox');
    if (!alertBox) return;
    alertBox.className = `auth-page-alert ${type}`;
    alertBox.innerHTML = `
      <i class="ph ph-${type === 'error' ? 'warning-circle' : 'check-circle'}"></i>
      <span>${msg}</span>
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

  private bindEvents(): void {
    // Tabs
    this.container.querySelector('#pageTabLogin')?.addEventListener('click', () => {
      soundEffects.playKeyClick();
      this.render('login');
    });

    this.container.querySelector('#pageTabRegister')?.addEventListener('click', () => {
      soundEffects.playKeyClick();
      this.render('register');
    });

    this.container.querySelector('#pageSwitchToRegisterBtn')?.addEventListener('click', () => {
      soundEffects.playKeyClick();
      this.render('register');
    });

    this.container.querySelector('#pageSwitchToLoginBtn')?.addEventListener('click', () => {
      soundEffects.playKeyClick();
      this.render('login');
    });

    // Google Sign-In button
    this.container.querySelector('#pageGoogleSignInBtn')?.addEventListener('click', async () => {
      soundEffects.playKeyClick();
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
