import { Scene } from '../types';
import { soundEffects } from '../services/soundEffects';
import { escapeHtml } from '../utils/sanitize';

export interface CompletionStats {
  accuracy: number;
  wpm: number;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  isNewTopScore?: boolean;
  rank?: number;
}

export class CompletionModal {
  private container: HTMLElement;
  private currentScene: Scene | null = null;
  private currentStats: CompletionStats | null = null;
  private onNextSceneCallback: (() => void) | null = null;
  private onRestartSceneCallback: (() => void) | null = null;
  private onLibraryCallback: (() => void) | null = null;
  private onChallengeFriendCallback: ((scene: Scene, stats: CompletionStats) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onNextScene: () => void;
    onRestartScene: () => void;
    onLibrary: () => void;
    onChallengeFriend?: (scene: Scene, stats: CompletionStats) => void;
  }): void {
    this.onNextSceneCallback = callbacks.onNextScene;
    this.onRestartSceneCallback = callbacks.onRestartScene;
    this.onLibraryCallback = callbacks.onLibrary;
    this.onChallengeFriendCallback = callbacks.onChallengeFriend || null;
  }

  public show(scene: Scene, stats: CompletionStats): void {
    if (stats.leveledUp) {
      soundEffects.playLevelUp();
    } else {
      soundEffects.playSentenceComplete();
    }

    this.container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card" style="text-align: center; padding: 2.5rem 2rem;">
          <h2 style="font-family: var(--font-heading); font-size: 2rem; font-weight: 800; color: var(--text-heading); margin-bottom: 0.5rem;">
            Ajoyib Natija!
          </h2>
          <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1.5rem;">
            "<strong>${escapeHtml(scene.title)}</strong>" darsini muvaffaqiyatli yakunladingiz!
          </p>

          ${stats.leveledUp ? `
            <div class="completion-level-up-box" style="padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
              <strong>YANGI DARAJA: Level ${stats.newLevel}!</strong>
            </div>
          ` : ''}

          ${stats.isNewTopScore ? `
            <div class="completion-highscore-badge" style="padding: 0.9rem 1.25rem; border-radius: 14px; margin-bottom: 1.5rem; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border: 1.5px solid #F59E0B; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              <span style="font-size: 1.6rem;">🏆</span>
              <div style="text-align: left;">
                <strong style="display: block; color: #92400E; font-size: 0.95rem;">TOP 3 REKORDCHI! (${stats.rank}-o'rin)</strong>
                <span style="font-size: 0.82rem; color: #B45309;">Siz ushbu videoni eng tez va xatosiz yozganlar reytingiga kirdingiz!</span>
              </div>
            </div>
          ` : ''}

          <div class="clean-results-grid">
            <div class="clean-result-tile">
              <span class="clean-result-val">${stats.accuracy}%</span>
              <span class="clean-result-lbl">Aniqlik</span>
            </div>
            <div class="clean-result-tile">
              <span class="clean-result-val">${stats.wpm}</span>
              <span class="clean-result-lbl">WPM Tezlik</span>
            </div>
            <div class="clean-result-tile highlight">
              <span class="clean-result-val" style="color: #FF5B37;">+${stats.xpEarned}</span>
              <span class="clean-result-lbl">XP Ball</span>
            </div>
          </div>

          <!-- Friend Challenge Action Banner -->
          <div class="completion-challenge-card" style="margin-top: 1.25rem; padding: 1rem 1.25rem; border-radius: var(--radius-lg); background: rgba(99, 102, 241, 0.08); border: 1.5px dashed #818CF8; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.75rem; text-align: left;">
              <span style="font-size: 1.6rem;">⚔️</span>
              <div>
                <strong style="display: block; font-size: 0.95rem; color: #4338CA;">Do'stingiz bilan bellashing!</strong>
                <span style="font-size: 0.82rem; color: #4B5563;">"Men bu sahnani ${stats.accuracy}% bilan yozdim, sen ham sinab ko'r!"</span>
              </div>
            </div>
            <button class="header-action-pill" id="completionChallengeFriendBtn" style="background: #4F46E5; color: #FFFFFF; border-color: #4F46E5; font-weight: 700;">
              <i class="ph ph-sword"></i> Challenge Yuborish
            </button>
          </div>

          <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
            <button class="clean-btn" id="restartCurrentSceneBtn">Qayta takrorlash</button>
            <button class="clean-btn primary-orange" id="modalNextSceneBtn">Keyingi darsga o'tish</button>
            <button class="card-continue-btn" id="backToLibraryBtn">Darslar ro'yxati</button>
          </div>
        </div>
      </div>
    `;

    this.currentScene = scene;
    this.currentStats = stats;
    this.bindEvents();
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

  private bindEvents(): void {
    this.container.querySelector('#restartCurrentSceneBtn')?.addEventListener('click', () => {
      this.hide();
      this.onRestartSceneCallback?.();
    });

    this.container.querySelector('#modalNextSceneBtn')?.addEventListener('click', () => {
      this.hide();
      this.onNextSceneCallback?.();
    });

    this.container.querySelector('#backToLibraryBtn')?.addEventListener('click', () => {
      this.hide();
      this.onLibraryCallback?.();
    });

    this.container.querySelector('#completionChallengeFriendBtn')?.addEventListener('click', () => {
      if (this.currentScene && this.currentStats) {
        this.onChallengeFriendCallback?.(this.currentScene, this.currentStats);
      }
    });
  }
}
