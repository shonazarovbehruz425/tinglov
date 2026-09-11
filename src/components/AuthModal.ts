// internal
import { apiService, AuthUser } from '../services/apiService';
import { soundEffects } from '../services/soundEffects';
import { getCsrfToken } from '../utils/csrf';
import { BaseModal } from './BaseModal';
import { AuthFormHelper, AUTH_CAPTCHA_ERROR } from './auth/authFormLogic';

export class AuthModal extends BaseModal {
  private activeTab: 'login' | 'register' = 'login';
  private isMandatory: boolean = true;
  private onAuthSuccessCallback: ((user: AuthUser) => void) | null = null;
  private form: AuthFormHelper;

  constructor(container: HTMLElement) {
    super(container);
    this.backdropSelector = '.auth-modal-backdrop';
    this.form = new AuthFormHelper(container, {
      alertBoxId: 'authAlertBox',
      captchaGroupId: 'loginCaptchaGroup',
      captchaQuestionId: 'loginCaptchaQuestion',
      captchaAnswerId: 'loginCaptchaAnswer',
      errorIconClass: 'ph-warning-circle',
      successIconClass: 'ph-check-circle-fill',
    });
  }

  public setOnAuthSuccess(callback: (user: AuthUser) => void): void {
    this.onAuthSuccessCallback = callback;
  }

  public open(initialTab: 'login' | 'register' = 'login', mandatory: boolean = true): void {
    this.markOpened();
    this.activeTab = initialTab;
    this.isMandatory = mandatory;
    this.render();
    soundEffects.playKeyClick();
  }

  public override close(force: boolean = false): void {
    if (this.isMandatory && !apiService.isAuthenticated() && !force) {
      soundEffects.triggerErrorFeedback();
      return;
    }
    this.form.dispose();
    super.close();
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
        <input type="hidden" name="_csrf" id="loginCsrfToken" value="${getCsrfToken()}" />
        <div class="auth-field-group">
          <label for="loginIdentifier">Email yoki Login</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-user auth-field-icon"></i>
            <input
              type="text"
              id="loginIdentifier"
              name="username"
              class="auth-input"
              placeholder="masalan: user_99 yoki email"
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

        <div class="auth-field-group" id="loginCaptchaGroup" style="display: none;">
          <label for="loginCaptchaAnswer">Xavfsizlik tekshiruvi: <span id="loginCaptchaQuestion" style="font-weight: 700; color: #38bdf8;"></span></label>
          <div class="auth-input-wrapper">
            <i class="ph ph-shield-check auth-field-icon"></i>
            <input
              type="text"
              id="loginCaptchaAnswer"
              name="captcha"
              class="auth-input"
              placeholder="Natijani kiriting"
              autocomplete="off"
            />
            <button type="button" class="auth-pw-toggle" id="loginCaptchaRefreshBtn" title="Kodni yangilash">
              <i class="ph ph-arrows-clockwise"></i>
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
        <input type="hidden" name="_csrf" id="registerCsrfToken" value="${getCsrfToken()}" />
        <div class="auth-field-group">
          <label for="registerFullName">Ismingiz (To‘liq ism)</label>
          <div class="auth-input-wrapper">
            <i class="ph ph-identification-card auth-field-icon"></i>
            <input
              type="text"
              id="registerFullName"
              class="auth-input"
              placeholder="masalan: Ali Valiyev"
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
              placeholder="masalan: user_99"
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
              placeholder="Kamida 8 ta belgi (A-Z, a-z, 0-9, !@#)"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <button type="button" class="auth-pw-toggle" id="registerPwToggle" title="Parolni ko‘rsatish">
              <i class="ph ph-eye"></i>
            </button>
          </div>
          <span class="auth-field-hint">Kamida 8 ta belgi: katta (A-Z), kichik (a-z), raqam (0-9) va maxsus belgi (!@#$)</span>
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

  private bindEvents(): void {
    this.bindBackdropClose('authModalBackdrop', () => !this.isMandatory || apiService.isAuthenticated());

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
    this.form.setupPasswordToggle('loginPassword', 'loginPwToggle');
    this.form.setupPasswordToggle('registerPassword', 'registerPwToggle');

    // Captcha refresh button
    this.container.querySelector('#loginCaptchaRefreshBtn')?.addEventListener('click', () => {
      void this.form.loadCaptcha();
    });

    // Check initial rate limit status
    const submitBtn = this.container.querySelector<HTMLButtonElement>('#loginSubmitBtn');
    this.form.applyInitialAuthStatus(submitBtn, 'Kirish');

    // Login submit
    const loginForm = this.container.querySelector<HTMLFormElement>('#loginForm');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.form.clearAlert();

      const cooldown = this.form.checkCooldown();
      if (cooldown.blocked) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert(cooldown.message, 'error');
        return;
      }

      const idInput = this.container.querySelector<HTMLInputElement>('#loginIdentifier');
      const pwInput = this.container.querySelector<HTMLInputElement>('#loginPassword');

      if (!idInput || !pwInput) return;

      const captchaInput = this.container.querySelector<HTMLInputElement>('#loginCaptchaAnswer');
      const captchaResult = await this.form.runCaptchaFlow(
        captchaInput?.value?.trim() || '',
        cooldown.status,
      );
      if (!captchaResult.ok) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert(captchaResult.error || AUTH_CAPTCHA_ERROR, 'error');
        return;
      }

      const validation = this.form.validateLoginInput(idInput.value, pwInput.value);

      if (!validation.success) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert(validation.error, 'error');
        return;
      }

      const csrfInput = this.container.querySelector<HTMLInputElement>('#loginCsrfToken');
      if (!this.form.validateCsrfTokenValue(csrfInput?.value)) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert('CSRF xavfsizlik tokeni tasdiqlanmadi. Iltimos, sahifani yangilang.', 'error');
        return;
      }

      this.form.setButtonLoading(submitBtn, true, 'Kirish');
      const result = await apiService.login({
        identifier: idInput.value,
        password: pwInput.value,
        csrfToken: csrfInput?.value,
        captchaToken: this.form.captcha?.token,
        captchaAnswer: captchaInput?.value?.trim(),
      });
      this.form.setButtonLoading(submitBtn, false, 'Kirish');

      if (result.error) {
        soundEffects.triggerErrorFeedback();
        await this.form.applyLoginFailure(result, submitBtn, 'Kirish');
        this.form.showAlert(result.error, 'error');
      } else if (result.user) {
        this.form.resetAuthFailures();
        soundEffects.playLevelUp();
        this.form.showAlert('Muvaffaqiyatli kirdingiz! Ma‘lumotlar yuklanmoqda...', 'success');

        // Sync local stats with cloud
        this.form.syncUserOnAuth(result.user);

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
      this.form.clearAlert();

      const nameInput = this.container.querySelector<HTMLInputElement>('#registerFullName');
      const userInput = this.container.querySelector<HTMLInputElement>('#registerUsername');
      const emailInput = this.container.querySelector<HTMLInputElement>('#registerEmail');
      const pwInput = this.container.querySelector<HTMLInputElement>('#registerPassword');
      const submitBtn = this.container.querySelector<HTMLButtonElement>('#registerSubmitBtn');

      if (!userInput || !emailInput || !pwInput) return;

      const validation = this.form.validateRegisterInput(
        nameInput?.value,
        userInput.value,
        emailInput.value,
        pwInput.value,
      );

      if (!validation.success) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert(validation.error, 'error');
        return;
      }

      const csrfInput = this.container.querySelector<HTMLInputElement>('#registerCsrfToken');
      if (!this.form.validateCsrfTokenValue(csrfInput?.value)) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert('CSRF xavfsizlik tokeni tasdiqlanmadi. Iltimos, sahifani yangilang.', 'error');
        return;
      }

      this.form.setButtonLoading(submitBtn, true, 'Akkaunt yaratish');
      const result = await apiService.register({
        fullName: nameInput?.value,
        username: userInput.value,
        email: emailInput.value,
        password: pwInput.value,
        csrfToken: csrfInput?.value,
      });
      this.form.setButtonLoading(submitBtn, false, 'Akkaunt yaratish');

      if (result.error) {
        soundEffects.triggerErrorFeedback();
        this.form.showAlert(result.error, 'error');
      } else if (result.user) {
        soundEffects.playLevelUp();
        this.form.showAlert('Tabriklaymiz! Akkauntingiz muvaffaqiyatli yaratildi.', 'success');

        this.form.syncUserOnAuth(result.user);

        setTimeout(() => {
          this.close(true);
          this.onAuthSuccessCallback?.(result.user!);
        }, 700);
      }
    });
  }
}
