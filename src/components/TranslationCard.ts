import { DialogueSentence, Scene } from '../types';
import { storageService } from '../services/storageService';
import { speechService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';

export class TranslationCard {
  private container: HTMLElement;
  private currentSentence: DialogueSentence | null = null;
  private currentScene: Scene | null = null;
  private isExpanded: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public update(scene: Scene, sentence: DialogueSentence): void {
    this.currentScene = scene;
    this.currentSentence = sentence;
    this.render();
  }

  private render(): void {
    if (!this.currentSentence || !this.currentScene) return;

    const words = Object.keys(this.currentSentence.wordDictionary);

    this.container.innerHTML = `
      <div class="translation-card-wrapper">
        <!-- Main Translation Banner -->
        <div class="translation-banner">
          <div class="translation-header">
            <div class="translation-title">
              <span class="flag-icon">🇺🇿</span>
              <h4>O'zbekcha Tarjimasi</h4>
            </div>
            <button class="toggle-expand-btn" id="toggleExpandBtn">
              <i class="ph ph-translate"></i> ${this.isExpanded ? 'Yashirish' : 'Lug\'at & Tahlil'}
            </button>
          </div>

          <div class="uzbek-text">
            "${this.currentSentence.uzbekTranslation}"
          </div>
          ${this.currentSentence.russianTranslation ? `
            <div class="russian-subtext">
              <span class="flag-icon">🇷🇺</span> ${this.currentSentence.russianTranslation}
            </div>
          ` : ''}
        </div>

        <!-- Interactive Vocabulary Gloss Section -->
        <div class="vocabulary-gloss-section ${this.isExpanded ? 'expanded' : ''}" id="glossSection">
          <h5 class="section-subtitle">
            <i class="ph ph-books"></i> So'zlar ustiga bosing va ma'nosini o'rganing:
          </h5>

          <div class="words-gloss-chips">
            ${words.length > 0 ? words.map(wordKey => {
              const wordObj = this.currentSentence!.wordDictionary[wordKey];
              const isSaved = storageService.isWordSaved(wordKey);
              return `
                <button class="gloss-word-chip ${isSaved ? 'saved' : ''}" data-word="${wordKey}">
                  <span class="chip-main">${wordObj.word}</span>
                  <span class="chip-trans">${wordObj.translation}</span>
                  ${isSaved ? '<i class="ph ph-bookmark-simple chip-star"></i>' : ''}
                </button>
              `;
            }).join('') : '<p class="no-words-hint">Ushbu replikadagi so\'zlar oddiy va tushunarli.</p>'}
          </div>

          <!-- Active Word Detail Inspector Modal/Drawer -->
          <div class="active-word-inspector" id="activeWordInspector" style="display: none;">
            <!-- Populated via selectWord -->
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private selectWord(wordKey: string): void {
    if (!this.currentSentence || !this.currentSentence.wordDictionary[wordKey]) return;
    const wordInfo = this.currentSentence.wordDictionary[wordKey];

    const inspector = this.container.querySelector('#activeWordInspector') as HTMLElement;
    if (!inspector) return;

    const isSaved = storageService.isWordSaved(wordInfo.word);

    inspector.style.display = 'block';
    inspector.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <div class="word-title-group">
            <span class="inspector-word">${wordInfo.word}</span>
            ${wordInfo.phonetics ? `<span class="inspector-phonetics">${wordInfo.phonetics}</span>` : ''}
            ${wordInfo.partOfSpeech ? `<span class="inspector-pos">${wordInfo.partOfSpeech}</span>` : ''}
          </div>
          <button class="pronounce-word-btn" id="pronounceWordBtn" title="Talaffuzni eshitish">
            <i class="ph ph-speaker-high"></i> Tinglash
          </button>
        </div>

        <div class="inspector-body">
          <div class="meaning-row">
            <span class="meaning-label">🇺🇿 O'zbekcha ma'nosi:</span>
            <span class="meaning-val">${wordInfo.translation}</span>
          </div>
          <div class="definition-row">
            <span class="def-label">📖 Ta'rif:</span>
            <span class="def-val">${wordInfo.definition}</span>
          </div>
        </div>

        <div class="inspector-footer">
          <button class="save-word-btn ${isSaved ? 'saved' : ''}" id="saveWordActionBtn">
            <i class="ph ph-${isSaved ? 'check-circle' : 'bookmark-simple'}"></i>
            ${isSaved ? 'Lug\'atingizda saqlangan' : 'Lug\'atimga saqlash (+10 XP)'}
          </button>
          <button class="close-inspector-btn" id="closeInspectorBtn">
            <i class="ph ph-x"></i> Yopish
          </button>
        </div>
      </div>
    `;

    inspector.querySelector('#pronounceWordBtn')?.addEventListener('click', () => {
      speechService.speakWord(wordInfo.word);
    });

    inspector.querySelector('#saveWordActionBtn')?.addEventListener('click', () => {
      if (!isSaved) {
        storageService.saveWord({
          id: `saved-${Date.now()}-${wordInfo.word}`,
          word: wordInfo.word,
          translation: wordInfo.translation,
          contextSentence: this.currentSentence!.text,
          movieName: this.currentScene!.movieName,
          addedAt: Date.now()
        });
        storageService.addXP(10);
        soundEffects.playCorrectWord();
        this.selectWord(wordKey); // re-render inspector with saved status
      }
    });

    inspector.querySelector('#closeInspectorBtn')?.addEventListener('click', () => {
      inspector.style.display = 'none';
    });
  }

  private bindEvents(): void {
    const toggleBtn = this.container.querySelector('#toggleExpandBtn');
    const glossSection = this.container.querySelector('#glossSection');

    toggleBtn?.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      if (this.isExpanded) {
        glossSection?.classList.add('expanded');
        toggleBtn.innerHTML = '<i class="ph ph-caret-up"></i> Kamroq ko\'rish';
      } else {
        glossSection?.classList.remove('expanded');
        toggleBtn.innerHTML = '<i class="ph ph-translate"></i> Lug\'at & Tahlil';
      }
    });

    const chips = this.container.querySelectorAll('.gloss-word-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const wordKey = (e.currentTarget as HTMLElement).dataset.word;
        if (wordKey) {
          this.selectWord(wordKey);
        }
      });
    });
  }
}
