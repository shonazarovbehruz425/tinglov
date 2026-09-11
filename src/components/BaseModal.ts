/**
 * BaseModal — barcha modal oynalar uchun umumiy baza sinf.
 *
 * Markazlashtiradi:
 * - ochiq/yopiq holat (`isOpen`) va yopilish animatsiyasi vaqtida
 *   takroriy bosishlardan himoya (`isClosing` qo'riqchisi),
 * - backdrop topilishi + `modal-closing` klassi + 260ms timeout bilan
 *   silliq yopilish (`close()` / `hide()`),
 * - backdrop bosilganda yopish (`bindBackdropClose`),
 * - ESC bilan yopish (`enableEscapeClose`, opt-in — main.ts'dagi globall
 *   ESC oqimi bilan bir xil modal to'plamini qoplaydi; idempotent),
 * - async tugmalar uchun spinner/busy holati (`setBusyButton`),
 * - kutilayotgan yopilish taymerlarini tozalash (`destroy`).
 *
 * O'tkazilgan modallar (8 ta): AuthModal, CompletionModal,
 * CustomSceneModal, FriendChallengeModal, ProfileModal,
 * ShadowingModal, VocabularyModal, YouTubeImportModal.
 */

// Yopilish animatsiyasi davomiyligi (CSS `.modal-closing` bilan sinxron).
export const MODAL_CLOSE_ANIMATION_MS = 260;

export class BaseModal {
  protected container: HTMLElement;
  protected isOpen = false;
  protected closeAnimationMs: number = MODAL_CLOSE_ANIMATION_MS;
  protected backdropSelector = '.modal-backdrop';

  private closeTimer: number | null = null;
  private closing = false;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Modal hozir ochiqmi. */
  public isModalOpen(): boolean {
    return this.isOpen;
  }

  /** Yopilish animatsiyasi jarayonidami (takroriy open/close'dan himoya). */
  protected get isClosing(): boolean {
    return this.closing;
  }

  /**
   * Modal muvaffaqiyatli ochilganda chaqiriladi: holatni yangilaydi va
   * oldingi yopilish taymeri qolgan bo'lsa, uni bekor qiladi.
   */
  protected markOpened(): void {
    this.clearCloseTimer();
    this.closing = false;
    this.isOpen = true;
  }

  /**
   * Animatsiyali yopilish: backdrop'ga `modal-closing` qo'shiladi,
   * `closeAnimationMs` dan so'ng konteyner tozalanadi va
   * `onAfterClose()` hook chaqiriladi.
   *
   * Yopiq modalda qo'shimcha `close()` chaqiruvi — no-op (callback'lar
   * takror ishlamaydi).
   */
  public close(): void {
    if (this.closing) return;
    if (!this.isOpen) return;
    this.isOpen = false;

    const backdrop = this.container.querySelector(this.backdropSelector);
    if (backdrop) {
      this.closing = true;
      backdrop.classList.add('modal-closing');
      this.clearCloseTimer();
      this.closeTimer = window.setTimeout(() => {
        this.closeTimer = null;
        this.container.innerHTML = '';
        this.closing = false;
        this.detachEscapeClose();
        this.onAfterClose();
      }, this.closeAnimationMs);
    } else {
      this.clearCloseTimer();
      this.container.innerHTML = '';
      this.detachEscapeClose();
      this.onAfterClose();
    }
  }

  /** `close()` ning aliasi (eski `hide()` API mosligi uchun). */
  public hide(): void {
    this.close();
  }

  /**
   * Yopish tugagach chaqiriladigan hook. `onClose` kollbeklari bo'lgan
   * modallar buni override qilib, o'z kollbeklarini chaqiradi.
   */
  protected onAfterClose(): void {
    // Subklasslar uchun mo'ljallangan; bazada bo'sh.
  }

  /**
   * Backdrop'ning o'zini bosganda modalni yopish.
   * `canClose` qaytarsa va `false` bo'lsa — yopilmaydi
   * (masalan: AuthModal majburiy rejimi).
   */
  protected bindBackdropClose(backdropId: string, canClose?: () => boolean): void {
    this.container.querySelector(`#${backdropId}`)?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === backdropId) {
        if (!canClose || canClose()) {
          this.close();
        }
      }
    });
  }

  /**
   * ESC bosilganda modalni yopish (opt-in, open() ichidan bir marta
   * chaqiriladi). Faol bo'lmagan yoki yopilayotgan modilda hech narsa
   * qilmaydi; `canClose` false qaytsa — yopilmaydi.
   */
  protected enableEscapeClose(canClose?: () => boolean): void {
    if (this.escHandler) return;
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!this.isOpen || this.closing) return;
      if (canClose && !canClose()) return;
      this.close();
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Async amaldagi tugmani busy/spinner holatiga o'tkazish — barcha
   * modalardagi "disabled + matn almashtirish" boilerplate'ini yig'adi.
   */
  protected setBusyButton(
    btn: HTMLButtonElement | null,
    busy: boolean,
    labelEl: HTMLElement | null,
    busyText: string,
    idleText: string,
  ): void {
    if (btn) btn.disabled = busy;
    if (labelEl) labelEl.textContent = busy ? busyText : idleText;
  }

  /** Kutilayotgan yopilish taymerini bekor qilish (unmount/dispose). */
  public destroy(): void {
    this.clearCloseTimer();
    this.detachEscapeClose();
  }

  private detachEscapeClose(): void {
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
