import { apiService, AuthUser } from '../services/apiService';
import { soundEffects } from '../services/soundEffects';
import { storageService } from '../services/storageService';

export class AuthModal {
  private container: HTMLElement;
  private isOpen: boolean = false;
  private activeTab: 'login' | 'register' = 'login';
  private isMandatory: boolean = true;
  private onAuthSuccessCallback: ((user: AuthUser) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setOnAuthSuccess(callback: (user: AuthUser) => void): void {
    this.onAuthSuccessCallback = callback;
  }

  public open(initialTab: 'login' | 'register' = 'login', mandatory: boolean = true): void {
    this.isOpen = true;
    this.activeTab = initialTab;
    this.isMandatory = mandatory;
    this.render();
    soundEffects.playKeyClick();
  }

  public close(force: boolean = false): void {
    if (this.isMandatory && !apiService.isAuthenticated() && !force) {
      soundEffects.triggerErrorFeedback();
      return;
    }
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  private switchTab(tab: 'login' | 'register'): void {
    this.activeTab = tab;
    this.render();
    soundEffects.playKeyClick();
  }

  private render(): void {
    if (!this.isOpen) {
      this.container.innerHTML = '';
      return;
    }

    const isLocked = this.isMandatory && !apiService.isAuthenticated();

    this.container.innerHTML = `
      <div class="auth-modal-backdrop ${isLocked ? 'locked' : ''}" id="authModalBackdrop">
        <div class="auth-modal-dialog" role="dialog" aria-modal="true">
          <!-- Close Button (hidden if login is mandatory) -->
          ${!isLocked ? `
          <button class="auth-modal-close-btn" id="authModalCloseBtn" title="Yopish">
            <i class="ph ph-x"></i>
          </button>
          ` : ''}

          <!-- Modal Header -->
          <div class="auth-modal-header">
            <div class="auth-logo-badge">
              <img src="/logo.png" alt="Tinglov Logo" class="auth-logo-icon" />
            </div>
            <h3 class="auth-modal-title">Tinglov Akkaunti</h3>
            <p class="auth-modal-sub">
              ${isLocked 
                ? 'Platformadan to‘liq foydalanish uchun hisobingizga kiring yoki ro‘yxatdan o‘ting' 
                : 'O‘rganish natijalaringizni bulutda saqlang va do‘stlaringiz bilan musobaqalashing'}
            </p>
          </div>

          ${isLocked ? `
          <div class="auth-mandatory-badge">
            <i class="ph ph-lock-key"></i>
            <span>Saytdan foydalanish uchun tizimga kirish talab qilinadi</span>
          </div>
          ` : ''}

          <!-- Tabs Switcher -->
          <div class="auth-tabs-bar">
            <button class="auth-tab-btn ${this.activeTab === 'login' ? 'active' : ''}" id="authTabLogin">
              <i class="ph ph-sign-in"></i> Kirish
            </button>
            <button class="auth-tab-btn ${this.activeTab === 'register' ? 'active' : ''}" id="authTabRegister">
              <i class="ph ph-user-plus"></i> Ro‘yxatdan o‘tish
            </button>
          </div>

          <!-- Alert Container -->
          <div id="authAlertBox" class="auth-alert-box" style="display: none;"></div>

          <!-- Form Area -->
          <div class="auth-modal-body">
            ${this.activeTab === 'login' ? this.renderLoginFormHtml() : this.renderRegisterFormHtml()}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderLoginFormHtml(): string {
    return `
      <form class="auth-form" id="loginForm" autocomplete="on">
        <div class="auth-field-group">
          <label for="loginIdentifier">Email yoki Login</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-user auth-field-icon"></i>
            <input
              type="text"
              id="loginIdentifier"
              name="username"
              class="auth-input"
              placeholder="masalan: behruz_99 yoki email"
              required
              autocomplete="username"
            />
          </div>
        </div>

        <div class="auth-field-group">
          <label for="loginPassword">Parol</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-lock-key auth-field-icon"></i>
            <input
              type="password"
              id="loginPassword"
              name="password"
              class="auth-input"
              placeholder="Parolingizni kiriting"
              required
              autocomplete="current-password"
            />
            <button type="button" class="auth-pw-toggle" id="loginPwToggle" title="Parolni ko‘rsatish">
              <i class="ph ph-eye"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="auth-submit-btn" id="loginSubmitBtn">
          <span class="btn-text">Kirish</span>
          <i class="ph ph-arrow-right"></i>
        </button>

        <div class="auth-switch-footer">
          <span>Akkauntingiz yo‘qmi?</span>
          <button type="button" class="auth-link-btn" id="switchToRegisterBtn">Ro‘yxatdan o‘ting</button>
        </div>
      </form>
    `;
  }

  private renderRegisterFormHtml(): string {
    return `
      <form class="auth-form" id="registerForm" autocomplete="on">
        <div class="auth-field-group">
          <label for="registerFullName">Ismingiz (To‘liq ism)</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-identification-card auth-field-icon"></i>
            <input
              type="text"
              id="registerFullName"
              class="auth-input"
              placeholder="masalan: Behruz Shonazarov"
              required
              autocomplete="name"
            />
          </div>
        </div>

        <div class="auth-field-group">
          <label for="registerUsername">Foydalanuvchi nomi (Login)</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-at auth-field-icon"></i>
            <input
              type="text"
              id="registerUsername"
              class="auth-input"
              placeholder="masalan: behruz_99"
              required
              autocomplete="username"
            />
          </div>
          <span class="auth-field-hint">Faqat harflar, raqamlar va pastki chiziq</span>
        </div>

        <div class="auth-field-group">
          <label for="registerEmail">Elektron pochta</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-envelope-simple auth-field-icon"></i>
            <input
              type="email"
              id="registerEmail"
              class="auth-input"
              placeholder="masalan: example@gmail.com"
              required
              autocomplete="email"
            />
          </div>
        </div>

        <div class="auth-field-group">
          <label for="registerPassword">Parol</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-lock-key auth-field-icon"></i>
            <input
              type="password"
              id="registerPassword"
              class="auth-input"
              placeholder="Kamida 6 ta belgi"
              required
              minlength="6"
              autocomplete="new-password"
            />
            <button type="button" class="auth-pw-toggle" id="registerPwToggle" title="Parolni ko‘rsatish">
              <i class="ph ph-eye"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="auth-submit-btn" id="registerSubmitBtn">
          <span class="btn-text">Akkaunt yaratish</span>
          <i class="ph ph-sparkle"></i>
        </button>

        <div class="auth-switch-footer">
          <span>Akkauntingiz bormi?</span>
          <button type="button" class="auth-link-btn" id="switchToLoginBtn">Kirish</button>
        </div>
      </form>
    `;
  }

  private showAlert(message: string, type: 'error' | 'success'): void {
    const alertBox = this.container.querySelector<HTMLElement>('#authAlertBox');
    if (!alertBox) return;

    alertBox.className = `auth-alert-box ${type}`;
    alertBox.style.display = 'flex';
    alertBox.innerHTML = `
      <i class="ph ph-${type === 'error' ? 'warning-circle' : 'check-circle-fill'}"></i>
      <span>${message}</span>
    `;
  }

  private clearAlert(): void {
    const alertBox = this.container.querySelector<HTMLElement>('#authAlertBox');
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
    // Backdrop click to close
    this.container.querySelector('#authModalBackdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'authModalBackdrop') {
        if (!this.isMandatory || apiService.isAuthenticated()) {
          this.close();
        }
      }
    });

    // Close button
    this.container.querySelector('#authModalCloseBtn')?.addEventListener('click', () => {
      if (!this.isMandatory || apiService.isAuthenticated()) {
        this.close();
      }
    });

    // Tab buttons
    this.container.querySelector('#authTabLogin')?.addEventListener('click', () => {
      this.switchTab('login');
    });

    this.container.querySelector('#authTabRegister')?.addEventListener('click', () => {
      this.switchTab('register');
    });

    this.container.querySelector('#switchToRegisterBtn')?.addEventListener('click', () => {
      this.switchTab('register');
    });

    this.container.querySelector('#switchToLoginBtn')?.addEventListener('click', () => {
      this.switchTab('login');
    });

    // Password visibility toggle
    this.setupPasswordToggle('loginPassword', 'loginPwToggle');
    this.setupPasswordToggle('registerPassword', 'registerPwToggle');

    // Login submit
    const loginForm = this.container.querySelector<HTMLFormElement>('#loginForm');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.clearAlert();

      const idInput = this.container.querySelector<HTMLInputElement>('#loginIdentifier');
      const pwInput = this.container.querySelector<HTMLInputElement>('#loginPassword');
      const submitBtn = this.container.querySelector<HTMLButtonElement>('#loginSubmitBtn');

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
        this.showAlert('Muvaffaqiyatli kirdingiz! Ma‘lumotlar yuklanmoqda...', 'success');

        // Sync local stats with cloud
        this.syncUserOnAuth(result.user);

        setTimeout(() => {
          this.close(true);
          this.onAuthSuccessCallback?.(result.user!);
        }, 700);
      }
    });

    // Register submit
    const registerForm = this.container.querySelector<HTMLFormElement>('#registerForm');
    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.clearAlert();

      const nameInput = this.container.querySelector<HTMLInputElement>('#registerFullName');
      const userInput = this.container.querySelector<HTMLInputElement>('#registerUsername');
      const emailInput = this.container.querySelector<HTMLInputElement>('#registerEmail');
      const pwInput = this.container.querySelector<HTMLInputElement>('#registerPassword');
      const submitBtn = this.container.querySelector<HTMLButtonElement>('#registerSubmitBtn');

      if (!userInput || !emailInput || !pwInput) return;

      this.setBtnLoading(submitBtn, true, 'Akkaunt yaratish');
      const result = await apiService.register({
        fullName: nameInput?.value,
        username: userInput.value,
        email: emailInput.value,
        password: pwInput.value,
      });
      this.setBtnLoading(submitBtn, false, 'Akkaunt yaratish');

      if (result.error) {
        soundEffects.triggerErrorFeedback();
        this.showAlert(result.error, 'error');
      } else if (result.user) {
        soundEffects.playLevelUp();
        this.showAlert('Tabriklaymiz! Akkauntingiz muvaffaqiyatli yaratildi.', 'success');

        this.syncUserOnAuth(result.user);

        setTimeout(() => {
          this.close(true);
          this.onAuthSuccessCallback?.(result.user!);
        }, 700);
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
    // Update local storage representation with user profile
    const localStats = storageService.getStats();
    localStats.userName = user.full_name || user.username;
    localStats.userHandle = `@${user.username}`;
    localStats.xp = Math.max(localStats.xp, user.xp);
    localStats.streak = Math.max(localStats.streak, user.streak);
    localStats.level = Math.max(localStats.level, user.level);
    storageService.saveStats();

    // Also push any local words to server in background
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
