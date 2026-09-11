/**
 * authFormLogic — AuthView va AuthModal orasidagi takrorlanuvchi
 * autentifikatsiya mantiq'ining yagona manbai.
 *
 * Birlashtiradi:
 * - alert ko'rsatish/tozalash (XSS-escape bilan),
 * - tugma loading/cooldown holatlari,
 * - CAPTCHA yuklash/tekshirish,
 * - CSRF + Zod validatsiya,
 * - login xatoligi oqimi (failure qaydi + captcha + cooldown),
 * - muvaffaqiyatdan keyin server bilan sinxronlash.
 *
 * Ovozli fikr-mulohaza (soundEffects) va API chaqiruvlari ataylab
 * chaqiruvchilarda qoldirilgan — oqim tartibi o'zgarmaydi.
 */

// internal
import { apiService, AuthUser } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { escapeHtml } from '../../utils/sanitize';
import {
  safeValidate,
  registerSchema,
  loginSchema,
  LoginInput,
  RegisterInput,
  ValidationResult,
} from '../../utils/validation';
import { validateCsrfToken } from '../../utils/csrf';
import {
  getClientAuthStatus,
  recordClientAuthFailure,
  resetClientAuthFailures,
  getCaptchaChallenge,
  verifyCaptchaClient,
  CaptchaData,
  ClientRateLimitStatus,
} from '../../utils/rateLimiter';

export type AuthAlertType = 'error' | 'success';

export interface AuthFormIds {
  alertBoxId: string;
  captchaGroupId: string;
  captchaQuestionId: string;
  captchaAnswerId: string;
  /** Masalan: 'ph-warning-circle' (AuthView) — sukut bo'yicha shu. */
  errorIconClass?: string;
  /** Masalan: 'ph-check-circle-fill' (AuthModal) — sukut bo'yicha 'ph-check-circle'. */
  successIconClass?: string;
}

export interface LoginFailureInfo {
  retryAfter?: number;
  requiresCaptcha?: boolean;
}

export const AUTH_COOLDOWN_MESSAGE = (sec: number): string =>
  `Iltimos, qayta urinishdan oldin ${sec} soniya kuting.`;

export const AUTH_CAPTCHA_ERROR =
  'Xavfsizlik kodi (CAPTCHA) noto‘g‘ri yoki kiritilmadi. Qaytadan yeching.';

// ---------------------------------------------------------------------------
// Moduli eksport funksiyalar (vazifa talabi: validateAuthForm,
// handleCaptchaFlow, setCooldownUI, togglePasswordVisibility).
// AuthFormHelper sinfi shu funksiyalarning holat (state) bilan bog'langan
// yupqa qobig'i — mantiq'ning yagona manbai shu yerda.
// ---------------------------------------------------------------------------

export type AuthMode = 'login' | 'register';

export interface LoginFormValues {
  identifier: string;
  password: string;
}

export interface RegisterFormValues {
  fullName?: string;
  username: string;
  email: string;
  password: string;
}

/** Login yoki register formasi qiymatlarini Zod-sxema bilan tekshiradi. */
export function validateAuthForm(mode: 'login', values: LoginFormValues): ValidationResult<LoginInput>;
export function validateAuthForm(mode: 'register', values: RegisterFormValues): ValidationResult<RegisterInput>;
export function validateAuthForm(
  mode: AuthMode,
  values: LoginFormValues | RegisterFormValues,
): ValidationResult<LoginInput> | ValidationResult<RegisterInput> {
  if (mode === 'login') {
    const v = values as LoginFormValues;
    return safeValidate(loginSchema, { identifier: v.identifier, password: v.password });
  }
  const v = values as RegisterFormValues;
  return safeValidate(registerSchema, {
    fullName: v.fullName,
    username: v.username,
    email: v.email,
    password: v.password,
  });
}

export interface CaptchaFlowArgs {
  /** CAPTCHA hozir talab qilinadimi (rate-limit yoki oldingi xatolik). */
  required: boolean;
  /** Foydalanuvchi kiritgan javob. */
  answer: string;
  /** Javobni joriy topshiriq bilan solishtirish. */
  verify: (answer: string) => boolean;
  /** Yanglioshganda — javob xato bo'lsa qayta captcha yuklash. */
  reload: () => Promise<void>;
}

export interface CaptchaFlowResult {
  ok: boolean;
  requiresCaptcha: boolean;
  error?: string;
}

/**
 * CAPTCHA oqimini boshqaradi: talab bo'lmasa darhol `ok`, talab bo'lib
 * javob xato bo'lsa — captcha'ni yangilaydi va xato xabarini qaytaradi.
 */
export async function handleCaptchaFlow(args: CaptchaFlowArgs): Promise<CaptchaFlowResult> {
  if (!args.required) {
    return { ok: true, requiresCaptcha: false };
  }
  if (args.verify(args.answer)) {
    return { ok: true, requiresCaptcha: true };
  }
  await args.reload();
  return { ok: false, requiresCaptcha: true, error: AUTH_CAPTCHA_ERROR };
}

/**
 * Tugmani `seconds` davomida cooldown holatida ushlaydi (hisoblagich
 * bilan). Qaytargan funksiya chaqirilsa — taymer tozalanadi.
 */
export function setCooldownUI(
  btn: HTMLButtonElement | null,
  seconds: number,
  defaultText: string,
): (() => void) | null {
  if (!btn || seconds <= 0) return null;

  let remaining = seconds;
  const renderCountdown = (n: number): void => {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph ph-hourglass-simple"></i> <span>Kuting: ${n}s</span>`;
  };
  renderCountdown(remaining);

  const timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(timer);
      btn.disabled = false;
      btn.innerHTML = `<span class="btn-text">${defaultText}</span> <i class="ph ph-arrow-right"></i>`;
    } else {
      renderCountdown(remaining);
    }
  }, 1000);

  return () => window.clearInterval(timer);
}

/** Parol maydonining ko'rinishini almashtiradi (eye / eye-slash). */
export function togglePasswordVisibility(
  input: HTMLInputElement | null,
  btn: HTMLElement | null,
): void {
  if (!input || !btn) return;
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.innerHTML = `<i class="ph ph-${isPw ? 'eye-slash' : 'eye'}"></i>`;
}

/** Spinner/loading holatidagi tugma ichki belgisi (bir xil markup). */
export function authSubmitButtonMarkup(defaultText: string): string {
  return `<span class="btn-text">${defaultText}</span> <i class="ph ph-arrow-right"></i>`;
}

export class AuthFormHelper {
  private container: HTMLElement;
  private alertBoxId: string;
  private captchaGroupId: string;
  private captchaQuestionId: string;
  private captchaAnswerId: string;
  private errorIconClass: string;
  private successIconClass: string;
  private currentCaptcha: CaptchaData | null = null;
  private cooldownDispose: (() => void) | null = null;

  constructor(container: HTMLElement, ids: AuthFormIds) {
    this.container = container;
    this.alertBoxId = ids.alertBoxId;
    this.captchaGroupId = ids.captchaGroupId;
    this.captchaQuestionId = ids.captchaQuestionId;
    this.captchaAnswerId = ids.captchaAnswerId;
    this.errorIconClass = ids.errorIconClass || 'ph-warning-circle';
    this.successIconClass = ids.successIconClass || 'ph-check-circle';
  }

  /** Joriy CAPTCHA topshirig'i (API'ga yuborish uchun token olinadi). */
  public get captcha(): CaptchaData | null {
    return this.currentCaptcha;
  }

  /** CAPTCHA hozir talab qilinadimi (rate-limit yoki oldingi xatolik). */
  public isCaptchaRequired(status?: ClientRateLimitStatus): boolean {
    const s = status || getClientAuthStatus();
    return s.requiresCaptcha || this.currentCaptcha !== null;
  }

  public showAlert(message: string, type: AuthAlertType): void {
    const alertBox = this.container.querySelector<HTMLElement>(`#${this.alertBoxId}`);
    if (!alertBox) return;
    const icon = type === 'error' ? this.errorIconClass : this.successIconClass;
    alertBox.className = `${alertBox.className.split(' ')[0]} ${type}`;
    alertBox.innerHTML = `<i class="ph ${icon}"></i><span>${escapeHtml(message)}</span>`;
    alertBox.style.display = 'flex';
  }

  public clearAlert(): void {
    const alertBox = this.container.querySelector<HTMLElement>(`#${this.alertBoxId}`);
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.innerHTML = '';
    }
  }

  public setButtonLoading(
    btn: HTMLButtonElement | null,
    isLoading: boolean,
    defaultText: string,
  ): void {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `<i class="ph ph-spinner-gap auth-spinner"></i> <span>Iltimos, kuting...</span>`;
    } else {
      btn.innerHTML = authSubmitButtonMarkup(defaultText);
    }
  }

  public setupPasswordToggle(inputId: string, btnId: string): void {
    const input = this.container.querySelector<HTMLInputElement>(`#${inputId}`);
    const btn = this.container.querySelector<HTMLElement>(`#${btnId}`);
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
      togglePasswordVisibility(input, btn);
    });
  }

  public async loadCaptcha(): Promise<void> {
    const group = this.container.querySelector<HTMLElement>(`#${this.captchaGroupId}`);
    const questionEl = this.container.querySelector<HTMLElement>(`#${this.captchaQuestionId}`);
    const answerInput = this.container.querySelector<HTMLInputElement>(`#${this.captchaAnswerId}`);
    if (!group || !questionEl) return;

    this.currentCaptcha = await getCaptchaChallenge();
    questionEl.textContent = this.currentCaptcha.question;
    group.style.display = 'block';
    if (answerInput) {
      answerInput.value = '';
    }
  }

  public startCooldown(
    btn: HTMLButtonElement | null,
    seconds: number,
    defaultText: string,
  ): void {
    this.clearCooldownTimer();
    this.cooldownDispose = setCooldownUI(btn, seconds, defaultText);
  }

  /** Sahifa/modal ochilgandagi boshlang'ich rate-limit holatini qo'llash. */
  public applyInitialAuthStatus(
    submitBtn: HTMLButtonElement | null,
    submitLabel: string,
  ): void {
    const status = getClientAuthStatus();
    if (status.requiresCaptcha) {
      void this.loadCaptcha();
    }
    if (status.cooldownRemainingSec > 0) {
      this.startCooldown(submitBtn, status.cooldownRemainingSec, submitLabel);
    }
  }

  /** Cooldown faol bo'lsa — bloklovchi xabar, aks holda null. */
  public checkCooldown(): { blocked: boolean; message: string; status: ClientRateLimitStatus } {
    const status = getClientAuthStatus();
    if (status.cooldownRemainingSec > 0) {
      return {
        blocked: true,
        message: AUTH_COOLDOWN_MESSAGE(status.cooldownRemainingSec),
        status,
      };
    }
    return { blocked: false, message: '', status };
  }

  public verifyCaptchaAnswer(answer: string): boolean {
    if (!this.currentCaptcha) return false;
    return verifyCaptchaClient(this.currentCaptcha, answer);
  }

  public validateLoginInput(identifier: string, password: string): ValidationResult<LoginInput> {
    return validateAuthForm('login', { identifier, password });
  }

  public validateRegisterInput(
    fullName: string | undefined,
    username: string,
    email: string,
    password: string,
  ): ValidationResult<RegisterInput> {
    return validateAuthForm('register', { fullName, username, email, password });
  }

  /**
   * Login submit'edagi CAPTCHA bloki — yagona `handleCaptchaFlow` oqimiga
   * delegat (AuthView va AuthModal bir xil foydalanadi).
   */
  public runCaptchaFlow(captchaAnswer: string, status?: ClientRateLimitStatus): Promise<CaptchaFlowResult> {
    return handleCaptchaFlow({
      required: this.isCaptchaRequired(status),
      answer: captchaAnswer,
      verify: (answer) => this.verifyCaptchaAnswer(answer),
      reload: () => this.loadCaptcha(),
    });
  }

  public validateCsrfTokenValue(token: unknown): boolean {
    return validateCsrfToken(token);
  }

  /**
   * Muvaffaqiyatsiz login oqimi: failure qaydi + zarur bo'lsa CAPTCHA
   * yangilash + cooldown boshlash. Xabar ko'rsatish chaqiruvchida qoladi
   * (asl tartib saqlanadi).
   */
  public async applyLoginFailure(
    result: LoginFailureInfo,
    submitBtn: HTMLButtonElement | null,
    submitLabel: string,
  ): Promise<void> {
    const updatedStatus = recordClientAuthFailure(result.retryAfter);
    if (updatedStatus.requiresCaptcha || result.requiresCaptcha) {
      await this.loadCaptcha();
    }
    if (updatedStatus.cooldownRemainingSec > 0) {
      this.startCooldown(submitBtn, updatedStatus.cooldownRemainingSec, submitLabel);
    }
  }

  public resetAuthFailures(): void {
    resetClientAuthFailures();
  }

  /** Muvaffaqiyatli auth'dan keyin lokal holatni server bilan sinxronlash. */
  public syncUserOnAuth(user: AuthUser): void {
    apiService.getMe().then((data) => {
      if (data) {
        storageService.syncWithServer(data);
      } else {
        storageService.syncWithServer({
          user,
          savedWords: [],
          completedScenes: [],
        });
      }
    }).catch(() => {
      storageService.syncWithServer({
        user,
        savedWords: [],
        completedScenes: [],
      });
    });
  }

  /** Cooldown taymerini tozalash (modal yopilganda chaqiriladi). */
  public dispose(): void {
    this.clearCooldownTimer();
  }

  private clearCooldownTimer(): void {
    if (this.cooldownDispose) {
      this.cooldownDispose();
      this.cooldownDispose = null;
    }
  }
}
