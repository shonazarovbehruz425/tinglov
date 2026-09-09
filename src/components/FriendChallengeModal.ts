import { Scene, ChallengePayload } from '../types';
import { storageService } from '../services/storageService';
import { soundEffects } from '../services/soundEffects';
import { i18n } from '../services/i18nService';

export class FriendChallengeModal {
  private container: HTMLElement;
  private currentPayload: ChallengePayload | null = null;
  private currentScene: Scene | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public open(scene: Scene, accuracy: number, wpm: number): void {
    const stats = storageService.getStats();
    const payload: ChallengePayload = {
      sceneId: scene.id,
      creatorName: stats.userName || 'Foydalanuvchi',
      creatorHandle: stats.userHandle,
      accuracy,
      wpm
    };

    this.currentScene = scene;
    this.currentPayload = payload;
    this.render();
  }

  public hide(): void {
    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('modal-closing');
      setTimeout(() => {
        this.container.innerHTML = '';
      }, 240);
    } else {
      this.container.innerHTML = '';
    }
  }

  private render(): void {
    if (!this.currentScene || !this.currentPayload) return;
    const t = i18n.t();
    const challengeLink = storageService.generateChallengeLink(this.currentPayload);
    const quoteText = `🎬 Men "${this.currentScene.title}" sahnasini ${this.currentPayload.accuracy}% aniqlik va ${this.currentPayload.wpm} WPM tezlik bilan yozdim! Sen ham o'zingni sinab ko'r:`;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(challengeLink)}&text=${encodeURIComponent(quoteText)}`;

    this.container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card challenge-modal-card">
          <!-- Modal Top Header -->
          <div class="challenge-modal-header">
            <div class="challenge-modal-header-left">
              <div class="challenge-icon-badge">
                <i class="ph ph-sword-fill"></i>
              </div>
              <div class="challenge-header-titles">
                <h3 class="challenge-title-text">${t.challengeModalTitle}</h3>
                <span class="challenge-subtitle-text">${this.currentScene.title}</span>
              </div>
            </div>
            <button class="close-modal-round-btn" id="closeChallengeModalBtn" title="${t.cancel}">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <p class="challenge-intro-text">
            ${t.challengeModalDesc}
          </p>

          <!-- Preview Message Box -->
          <div class="challenge-message-card">
            <div class="challenge-msg-tag">
              <i class="ph ph-chat-circle-dots"></i> Xabar matni:
            </div>
            <p class="challenge-msg-quote">
              "Men bu sahnani <span class="challenge-accuracy-highlight">${this.currentPayload.accuracy}%</span> aniqlik bilan yozdim, sen ham sinab ko'r!"
            </p>
            <div class="challenge-meta-row">
              <span class="challenge-meta-pill"><i class="ph ph-lightning"></i> Tezlik: <strong>${this.currentPayload.wpm} WPM</strong></span>
              <span class="challenge-meta-sep">•</span>
              <span class="challenge-meta-pill"><i class="ph ph-user"></i> Ism: <strong>${this.currentPayload.creatorName}</strong></span>
            </div>
          </div>

          <!-- Link Box -->
          <div class="challenge-link-group">
            <label class="challenge-link-label">Havola (Link):</label>
            <div class="challenge-link-input-row">
              <div class="challenge-input-wrapper">
                <i class="ph ph-link-simple challenge-input-icon"></i>
                <input 
                  type="text" 
                  id="challengeLinkInput" 
                  readonly 
                  value="${challengeLink}" 
                  class="challenge-link-input"
                  spellcheck="false"
                />
              </div>
              <button class="clean-btn primary-orange challenge-copy-btn" id="copyChallengeLinkBtn">
                <i class="ph ph-copy"></i> Nusxalash
              </button>
            </div>
          </div>

          <!-- Share Actions Row -->
          <div class="challenge-footer-actions">
            <a href="${tgShareUrl}" target="_blank" rel="noopener noreferrer" class="clean-btn challenge-telegram-btn">
              <i class="ph ph-paper-plane-tilt"></i> Telegramda Ulashish
            </a>
            <button class="clean-btn challenge-dismiss-btn" id="challengeDoneBtn">
              Yopish
            </button>
          </div>

          <div id="challengeToastNotice" class="challenge-toast-notice">
            <i class="ph ph-check-circle-fill"></i> ${t.linkCopiedSuccess}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#closeChallengeModalBtn')?.addEventListener('click', () => {
      this.hide();
    });

    this.container.querySelector('#challengeDoneBtn')?.addEventListener('click', () => {
      this.hide();
    });

    const copyBtn = this.container.querySelector('#copyChallengeLinkBtn');
    const linkInput = this.container.querySelector<HTMLInputElement>('#challengeLinkInput');
    const toast = this.container.querySelector<HTMLElement>('#challengeToastNotice');

    copyBtn?.addEventListener('click', () => {
      if (!linkInput) return;
      linkInput.select();
      navigator.clipboard.writeText(linkInput.value).then(() => {
        soundEffects.playKeyClick();
        if (toast) {
          toast.style.display = 'block';
          setTimeout(() => {
            toast.style.display = 'none';
          }, 3000);
        }
      }).catch(() => {
        document.execCommand('copy');
      });
    });
  }
}
