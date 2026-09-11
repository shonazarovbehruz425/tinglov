// internal
import { SavedWord } from '../types';
import { BaseModal } from './BaseModal';
import { storageService } from '../services/storageService';
import { speechService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';
import { escapeHtml } from '../utils/sanitize';

export class VocabularyModal extends BaseModal {
  private isQuizMode: boolean = false;
  private quizIndex: number = 0;
  private showQuizAnswer: boolean = false;
  private onCloseCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    super(container);
  }

  public setOnClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  public open(): void {
    this.isQuizMode = false;
    this.quizIndex = 0;
    this.showQuizAnswer = false;
    this.markOpened();
    this.enableEscapeClose();
    this.render();
  }

  protected override onAfterClose(): void {
    this.onCloseCallback?.();
  }

  private render(): void {
    const stats = storageService.getStats();
    const savedWords = stats.savedWords;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="vocabModalBackdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3>Mening Lug'atim</h3>
              <p>Saqlangan so'zlar: ${savedWords.length} ta</p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${savedWords.length > 0 ? `
                <button class="header-action-pill ${this.isQuizMode ? 'primary' : ''}" id="toggleQuizBtn">
                  <i class="ph ph-cards"></i> ${this.isQuizMode ? 'Ro\'yxat' : 'Quiz'}
                </button>
              ` : ''}
              <button class="close-modal-round-btn" id="closeVocabModalBtn" title="Yopish"><i class="ph ph-x"></i></button>
            </div>
          </div>

          <div class="modal-body">
            ${this.isQuizMode ? this.renderQuizMode(savedWords) : this.renderListView(savedWords)}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(savedWords);
  }

  private renderListView(savedWords: SavedWord[]): string {
    if (savedWords.length === 0) {
      return `
        <div class="clean-empty-box">
          <h3>Lug'atingiz hali bo'sh</h3>
          <p>Kinolar darsida yangi so'zlarni o'rganib, lug'atingizga saqlang va +10 XP oling!</p>
        </div>
      `;
    }

    return `
      <div class="clean-vocab-list">
        ${savedWords.map(w => `
          <div class="clean-vocab-item" data-word-id="${escapeHtml(w.id)}">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span class="clean-vocab-word">${escapeHtml(w.word)}</span>
                <button class="clean-btn" data-word="${escapeHtml(w.word)}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">
                  <i class="ph ph-speaker-high"></i>
                </button>
              </div>
              <span class="clean-vocab-trans">${escapeHtml(w.translation)}</span>
              <span class="clean-vocab-context">"${escapeHtml(w.contextSentence)}" (${escapeHtml(w.movieName)})</span>
            </div>
            <button class="clean-btn" data-delete-id="${escapeHtml(w.id)}" style="padding: 0.4rem; color: #EF4444;">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderQuizMode(savedWords: SavedWord[]): string {
    const currentWord = savedWords[this.quizIndex];
    if (!currentWord) {
      return `
        <div class="clean-empty-box">
          <h3>Barakalla!</h3>
          <p>Barcha ${savedWords.length} ta so'zni takrorlab bo'ldingiz!</p>
          <button class="card-continue-btn" id="restartQuizBtn">Qayta boshlash</button>
        </div>
      `;
    }

    return `
      <div style="text-align: center; padding: 1.5rem;">
        <span style="font-size: 0.8rem; font-weight: 700; color: #6F767E;">
          Karta ${this.quizIndex + 1} / ${savedWords.length}
        </span>

        <div style="background: #F6F7F9; border: 2px solid #E6E8EC; border-radius: 20px; padding: 2.5rem 1.5rem; margin: 1.5rem 0; cursor: pointer;" id="flashcardElement">
          <h2 style="font-family: var(--font-heading); font-size: 2.2rem; font-weight: 800; color: #111315; margin-bottom: 0.5rem;">
            ${escapeHtml(currentWord.word)}
          </h2>
          ${this.showQuizAnswer ? `
            <h3 style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700; color: var(--accent-orange); margin-top: 1rem;">
              ${escapeHtml(currentWord.translation)}
            </h3>
            <p style="font-size: 0.85rem; color: #6F767E; font-style: italic; margin-top: 0.5rem;">
              "${escapeHtml(currentWord.contextSentence)}"
            </p>
          ` : `
            <span style="font-size: 0.85rem; color: #9A9FA5;">Tarjimasini ko'rish uchun bosing</span>
          `}
        </div>

        <div style="display: flex; justify-content: center; gap: 0.75rem;">
          <button class="clean-btn" id="prevCardBtn" ${this.quizIndex === 0 ? 'disabled' : ''}>Oldingi</button>
          <button class="clean-btn" id="flipCardBtn">${this.showQuizAnswer ? 'Yashirish' : 'Javob'}</button>
          <button class="card-continue-btn" id="nextCardBtn">Keyingisi</button>
        </div>
      </div>
    `;
  }

  private bindEvents(savedWords: SavedWord[]): void {
    this.bindBackdropClose('vocabModalBackdrop');

    this.container.querySelector('#closeVocabModalBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#toggleQuizBtn')?.addEventListener('click', () => {
      this.isQuizMode = !this.isQuizMode;
      this.render();
    });

    const pronounceBtns = this.container.querySelectorAll('.clean-btn[data-word]');
    pronounceBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const w = (e.currentTarget as HTMLElement).dataset.word;
        if (w) speechService.speakWord(w);
      });
    });

    const deleteBtns = this.container.querySelectorAll('.clean-btn[data-delete-id]');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.deleteId;
        if (id) {
          storageService.removeSavedWord(id);
          this.render();
        }
      });
    });

    this.container.querySelector('#flashcardElement')?.addEventListener('click', () => {
      this.showQuizAnswer = !this.showQuizAnswer;
      this.render();
    });

    this.container.querySelector('#flipCardBtn')?.addEventListener('click', () => {
      this.showQuizAnswer = !this.showQuizAnswer;
      this.render();
    });

    this.container.querySelector('#nextCardBtn')?.addEventListener('click', () => {
      if (this.quizIndex < savedWords.length) {
        this.quizIndex++;
        this.showQuizAnswer = false;
        soundEffects.playCorrectWord();
        this.render();
      }
    });

    this.container.querySelector('#prevCardBtn')?.addEventListener('click', () => {
      if (this.quizIndex > 0) {
        this.quizIndex--;
        this.showQuizAnswer = false;
        this.render();
      }
    });

    this.container.querySelector('#restartQuizBtn')?.addEventListener('click', () => {
      this.quizIndex = 0;
      this.showQuizAnswer = false;
      this.render();
    });
  }
}
