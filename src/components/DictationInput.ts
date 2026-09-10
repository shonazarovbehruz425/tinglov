import { DialogueSentence, DictationFeedback, Scene } from '../types';
import { evaluateDictation, getNextHint, splitIntoWords } from '../utils/stringDiff';
import { soundEffects } from '../services/soundEffects';
import { i18n } from '../services/i18nService';
import { escapeHtml } from '../utils/sanitize';

export class DictationInput {
  private container: HTMLElement;
  private currentScene: Scene | null = null;
  private currentSentence: DialogueSentence | null = null;
  private sentenceIndex: number = 0;
  private userInput: string = '';
  private startTime: number = 0;
  private isCompleted: boolean = false;
  private hintsUsed: number = 0;
  private subtitleMode: 'both' | 'en' | 'uz' | 'off' = 'both';
  private isSubtitleRevealed: boolean = false;
  private onCompleteCallback: ((accuracy: number, wpm: number, hintsUsed: number) => void) | null = null;
  private onHintCallback: (() => void) | null = null;
  private onRevealCallback: (() => void) | null = null;
  private onSkipCallback: (() => void) | null = null;
  private onShadowingCallback: (() => void) | null = null;
  private onSelectDialogueCallback: ((index: number) => void) | null = null;
  private onReplayRequestCallback: (() => void) | null = null;
  private onSlowDownRequestCallback: (() => void) | null = null;
  private onSubtitleModeChangeCallback: ((mode: 'both' | 'en' | 'uz' | 'off') => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onComplete: (accuracy: number, wpm: number, hintsUsed: number) => void;
    onHint: () => void;
    onReveal: () => void;
    onSkip: () => void;
    onShadowing: () => void;
    onSelectDialogue?: (index: number) => void;
    onReplayRequest?: () => void;
    onSlowDownRequest?: () => void;
    onSubtitleModeChange?: (mode: 'both' | 'en' | 'uz' | 'off') => void;
  }): void {
    this.onCompleteCallback = callbacks.onComplete;
    this.onHintCallback = callbacks.onHint;
    this.onRevealCallback = callbacks.onReveal;
    this.onSkipCallback = callbacks.onSkip;
    this.onShadowingCallback = callbacks.onShadowing;
    this.onSelectDialogueCallback = callbacks.onSelectDialogue || null;
    this.onReplayRequestCallback = callbacks.onReplayRequest || null;
    this.onSlowDownRequestCallback = callbacks.onSlowDownRequest || null;
    this.onSubtitleModeChangeCallback = callbacks.onSubtitleModeChange || null;
  }

  public setSceneAndSentence(scene: Scene, sentence: DialogueSentence, index: number): void {
    this.currentScene = scene;
    this.currentSentence = sentence;
    this.sentenceIndex = index;
    this.userInput = '';
    this.previousInput = '';
    this.startTime = Date.now();
    this.isCompleted = false;
    this.isSubtitleRevealed = false;
    this.hintsUsed = 0;
    this.render();
  }

  public setSubtitleMode(mode: 'both' | 'en' | 'uz' | 'off'): void {
    this.subtitleMode = mode;
    this.updateSubtitleDisplay();
    this.onSubtitleModeChangeCallback?.(mode);
  }

  public getSubtitleMode(): 'both' | 'en' | 'uz' | 'off' {
    return this.subtitleMode;
  }

  public setSubtitleRevealed(revealed: boolean): void {
    this.isSubtitleRevealed = revealed;
    this.updateSubtitleDisplay();
  }

  public getSubtitleRevealed(): boolean {
    return this.isSubtitleRevealed;
  }

  public toggleSubtitleMode(): 'both' | 'en' | 'uz' | 'off' {
    const modes: Array<'both' | 'en' | 'uz' | 'off'> = ['both', 'en', 'uz', 'off'];
    const curIdx = modes.indexOf(this.subtitleMode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    this.setSubtitleMode(nextMode);
    return nextMode;
  }

  public updateSubtitleDisplay(): void {
    const card = this.container.querySelector<HTMLElement>('#bilingualSubtitlesCard');
    if (!card || !this.currentSentence) return;

    const t = i18n.t();
    const isRevealed = this.isSubtitleRevealed;
    const mode = this.subtitleMode;

    card.className = `bilingual-subtitles-card ${isRevealed ? 'is-revealed' : 'is-locked'} mode-${mode}`;

    // Update status badge
    const statusWrap = card.querySelector<HTMLElement>('.subtitles-status-wrapper');
    if (statusWrap) {
      statusWrap.innerHTML = isRevealed
        ? `<span class="subtitles-status-pill success"><i class="ph ph-check-circle-fill"></i> ${t.subtitlesUnlocked}</span>`
        : `<span class="subtitles-status-pill pending"><i class="ph ph-lock-key"></i> ${t.subtitlesLocked}</span>`;
    }

    // Update active mode buttons
    const modeBtns = card.querySelectorAll<HTMLElement>('.sub-mode-btn');
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subMode === mode);
    });

    // Update body content
    const body = card.querySelector<HTMLElement>('.subtitles-body');
    if (body) {
      body.innerHTML = this.renderSubtitlesBodyHtml();
    }
  }

  private renderSubtitlesBodyHtml(): string {
    if (!this.currentSentence) return '';
    if (this.subtitleMode === 'off') {
      return `
        <div class="subtitles-disabled-notice">
          <i class="ph ph-eye-slash"></i>
          <span>Subtitrlar yashirilgan. Yoqish uchun yuqoridagi <strong>EN + UZ</strong> tugmasini bosing yoki <kbd>Alt</kbd>+<kbd>C</kbd> bosing.</span>
        </div>
      `;
    }
    if (!this.isSubtitleRevealed) {
      return '';
    }

    return `
      <div class="subtitles-parallel-lines">
        ${(this.subtitleMode === 'both' || this.subtitleMode === 'en') ? `
          <div class="sub-parallel-row en-row">
            <span class="sub-lang-badge en">EN</span>
            <div class="sub-line-content">
              <span class="sub-speaker-name">${escapeHtml(this.currentSentence.character)}:</span>
              <span class="sub-text-en">${escapeHtml(this.currentSentence.text)}</span>
            </div>
          </div>
        ` : ''}

        ${(this.subtitleMode === 'both' || this.subtitleMode === 'uz') ? `
          <div class="sub-parallel-row uz-row">
            <span class="sub-lang-badge uz">UZ</span>
            <div class="sub-line-content">
              <span class="sub-text-uz">${escapeHtml(i18n.getSentenceTranslation(this.currentSentence))}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  public focusInput(): void {
    const textarea = this.container.querySelector<HTMLInputElement>('#dictationInput');
    textarea?.focus();
  }

  public triggerHint(): void {
    if (!this.currentSentence || this.isCompleted) return;

    const hint = getNextHint(this.userInput, this.currentSentence.text);
    if (hint) {
      soundEffects.playHint();
      this.hintsUsed++;

      const userWords = splitIntoWords(this.userInput);
      userWords[hint.index] = hint.hintWord;
      this.userInput = userWords.join(' ') + ' ';

      this.updateInputDisplay();
      this.onHintCallback?.();
    }
  }

  public triggerReveal(): void {
    if (!this.currentSentence || this.isCompleted) return;
    this.hintsUsed += 3;
    this.userInput = this.currentSentence.text;
    this.isSubtitleRevealed = true;
    this.updateInputDisplay();
    this.updateSubtitleDisplay();
    this.onRevealCallback?.();
  }

  private previousInput: string = '';

  private handleInput(value: string): void {
    const isAddingChar = value.length > this.previousInput.length;
    this.userInput = value;
    if (!this.currentSentence) return;

    const feedback = evaluateDictation(this.userInput, this.currentSentence.text);
    this.renderWordChips(feedback);
    this.updateStatsPreview(feedback);

    // Audio & Haptic feedback on each keystroke
    if (isAddingChar) {
      const cleanTarget = this.currentSentence.text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '');
      const cleanUser = this.userInput.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '');

      // Check if current prefix is matching
      if (cleanTarget.startsWith(cleanUser)) {
        // Correct letter click sound
        soundEffects.playCorrectLetterClick();
        soundEffects.triggerHaptic(15);
      } else {
        // Wrong letter: buzz and vibration
        soundEffects.triggerErrorFeedback();
        this.triggerShakeInput();
      }
    }

    this.previousInput = value;

    if (feedback.isComplete && !this.isCompleted) {
      this.isCompleted = true;
      this.isSubtitleRevealed = true;
      this.updateSubtitleDisplay();
      soundEffects.playSentenceComplete();
      soundEffects.triggerHaptic([50, 60, 100]);

      const timeMinutes = Math.max(0.1, (Date.now() - this.startTime) / 60000);
      const wordsCount = splitIntoWords(this.currentSentence.text).length;
      const wpm = Math.round(wordsCount / timeMinutes);

      setTimeout(() => {
        this.onCompleteCallback?.(feedback.accuracy, wpm, this.hintsUsed);
      }, 1000);
    }
  }

  private triggerShakeInput(): void {
    const textarea = this.container.querySelector<HTMLElement>('#dictationInput');
    if (textarea) {
      textarea.classList.remove('input-shake-error');
      void textarea.offsetWidth; // trigger reflow
      textarea.classList.add('input-shake-error');
    }
  }

  private render(): void {
    if (!this.currentSentence || !this.currentScene) return;

    const targetWords = splitIntoWords(this.currentSentence.text);
    const numStr = (this.sentenceIndex + 1).toString().padStart(2, '0');
    const t = i18n.t();

    this.container.innerHTML = `
      <div class="practice-sidebar-column">
        <!-- Interactive Dictation Input Card (Image 1 Right Top) -->
        <div class="dictation-input-panel">
          <div class="dictation-card-heading">
            <h4>${numStr}. ${t.listenAndType}</h4>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-orange);">
              ${targetWords.length} ${t.wordsCountLabel}
            </span>
          </div>

          <!-- Clean Word Slots -->
          <div class="word-slots-row" id="wordSlotsRow">
            ${targetWords.map((_, i) => `
              <div class="clean-word-slot" id="slot-${i}">
                <span>${i + 1}.</span>
                <span>___</span>
              </div>
            `).join('')}
          </div>

          <!-- Typing Textarea -->
          <textarea
            id="dictationInput"
            class="dictation-big-textarea"
            placeholder="${t.typePlaceholder} (masalan: ${this.currentSentence.text.slice(0, 5)}...)"
            rows="2"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          ></textarea>

          <!-- Metrics and Action Buttons -->
          <div class="dictation-controls-cluster">
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;" id="liveMetricsText">
              ${t.accuracyLive} <strong style="color: var(--text-heading);" id="liveAccVal">0%</strong>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
              <!-- Shadowing Mode Button (Temporarily hidden) -->
              <!-- <button class="clean-btn shadowing-trigger-pill" id="dictationShadowingBtn" title="${t.shadowingBtn}">
                <i class="ph ph-microphone"></i> ${t.shadowingBtn}
              </button> -->
              <button class="clean-btn hint" id="dictationHintBtn" title="${t.hintBtn} (Alt+H)">
                <i class="ph ph-lightbulb"></i> ${t.hintBtn}
              </button>
              <button class="clean-btn" id="dictationRevealBtn" title="${t.revealBtn}">
                <i class="ph ph-eye"></i> ${t.revealBtn}
              </button>
              <button class="clean-btn" id="dictationClearBtn" title="${t.clearBtn}">
                <i class="ph ph-trash"></i>
              </button>
              <button class="clean-btn" id="dictationSkipBtn" title="${t.nextReplica}">
                <i class="ph ph-caret-right"></i>
              </button>
            </div>
          </div>

          <!-- Bilingual Subtitles Card (Parallel Subtitrlar Image 1 Moved Here) -->
          <div class="bilingual-subtitles-card ${this.isSubtitleRevealed ? 'is-revealed' : 'is-locked'} mode-${this.subtitleMode}" id="bilingualSubtitlesCard">
            <div class="subtitles-card-header">
              <div class="subtitles-header-left">
                <div class="subtitles-header-icon"><i class="ph ph-subtitles"></i></div>
                <div class="subtitles-title-group">
                  <span class="subtitles-header-title">${t.bilingualSubtitles}</span>
                  <div class="subtitles-status-wrapper">
                    ${this.isSubtitleRevealed ? `
                      <span class="subtitles-status-pill success"><i class="ph ph-check-circle-fill"></i> ${t.subtitlesUnlocked}</span>
                    ` : `
                      <span class="subtitles-status-pill pending"><i class="ph ph-lock-key"></i> ${t.subtitlesLocked}</span>
                    `}
                  </div>
                </div>
              </div>

              <!-- Mode Switcher: Both | EN | UZ | Off -->
              <div class="subtitles-toggle-controls">
                <button class="sub-mode-btn ${this.subtitleMode === 'both' ? 'active' : ''}" data-sub-mode="both" title="Inglizcha va O‘zbekcha parallel">
                  <span>EN + UZ</span>
                </button>
                <button class="sub-mode-btn ${this.subtitleMode === 'en' ? 'active' : ''}" data-sub-mode="en" title="Faqat Inglizcha">
                  <span>EN</span>
                </button>
                <button class="sub-mode-btn ${this.subtitleMode === 'uz' ? 'active' : ''}" data-sub-mode="uz" title="Faqat O‘zbekcha">
                  <span>UZ</span>
                </button>
                <button class="sub-mode-btn ${this.subtitleMode === 'off' ? 'active' : ''}" data-sub-mode="off" title="${t.subtitlesHide}">
                  <i class="ph ph-eye-slash"></i>
                </button>
              </div>
            </div>

            <div class="subtitles-body">
              ${this.renderSubtitlesBodyHtml()}
            </div>
          </div>

          <!-- Hotkeys helper strip (Mouse-free typing) -->
          <div class="dictation-hotkeys-strip">
            <span class="hotkey-pill" title="${t.hotkeyReplay}"><kbd>Tab</kbd> ${t.hotkeyReplay}</span>
            <span class="hotkey-pill" title="${t.hotkeySlow}"><kbd>Ctrl+Space</kbd> ${t.hotkeySlow}</span>
            <span class="hotkey-pill" title="${t.hotkeyHint}"><kbd>Alt+H</kbd> ${t.hotkeyHint}</span>
            <span class="hotkey-pill" title="Subtitrni ko‘rsatish / almashtirish"><kbd>Alt+C</kbd> Subtitr</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.focusInput();
  }

  private updateInputDisplay(): void {
    const textarea = this.container.querySelector<HTMLInputElement>('#dictationInput');
    if (textarea) {
      textarea.value = this.userInput;
      this.handleInput(this.userInput);
      textarea.focus();
    }
  }

  private renderWordChips(feedback: DictationFeedback): void {
    if (!this.currentSentence) return;
    const targetWords = splitIntoWords(this.currentSentence.text);

    targetWords.forEach((expectedWord, i) => {
      const slot = this.container.querySelector(`#slot-${i}`);
      if (!slot) return;

      const token = feedback.userTokens[i];
      if (!token || token.status === 'missing') {
        slot.className = 'clean-word-slot';
        slot.innerHTML = `<span>${i + 1}.</span><span>___</span>`;
      } else if (token.status === 'correct') {
        slot.className = 'clean-word-slot correct';
        slot.innerHTML = `<span>✓</span><span>${escapeHtml(expectedWord)}</span>`;
      } else {
        slot.className = 'clean-word-slot incorrect';
        slot.innerHTML = `<span>✗</span><span>${escapeHtml(token.word)}</span>`;
      }
    });
  }

  private updateStatsPreview(feedback: DictationFeedback): void {
    const accVal = this.container.querySelector('#liveAccVal');
    if (accVal) {
      accVal.textContent = `${feedback.accuracy}%`;
    }
  }

  private bindEvents(): void {
    const textarea = this.container.querySelector<HTMLInputElement>('#dictationInput');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.handleInput(val);
      });

      textarea.addEventListener('keydown', (e) => {
        // Tab: replay dialogue without blurring textarea
        if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          this.onReplayRequestCallback?.();
        } else if (e.ctrlKey && e.code === 'Space') {
          // Ctrl+Space: slow down playback
          e.preventDefault();
          this.onSlowDownRequestCallback?.();
        }
      });
    }

    this.container.querySelector('#dictationShadowingBtn')?.addEventListener('click', () => {
      this.onShadowingCallback?.();
    });

    this.container.querySelector('#dictationHintBtn')?.addEventListener('click', () => {
      this.triggerHint();
    });

    this.container.querySelector('#dictationRevealBtn')?.addEventListener('click', () => {
      this.triggerReveal();
    });

    this.container.querySelector('#dictationClearBtn')?.addEventListener('click', () => {
      this.userInput = '';
      this.updateInputDisplay();
    });

    this.container.querySelector('#dictationSkipBtn')?.addEventListener('click', () => {
      this.onSkipCallback?.();
    });

    const rows = this.container.querySelectorAll('.curriculum-lesson-row');
    rows.forEach(row => {
      row.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.dialogueIdx || '0', 10);
        this.onSelectDialogueCallback?.(idx);
      });
    });

    const subModeBtns = this.container.querySelectorAll<HTMLElement>('.sub-mode-btn');
    subModeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        soundEffects.playKeyClick();
        const mode = (e.currentTarget as HTMLElement).dataset.subMode as 'both' | 'en' | 'uz' | 'off';
        if (mode) {
          this.setSubtitleMode(mode);
        }
      });
    });
  }
}
