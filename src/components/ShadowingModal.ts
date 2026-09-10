import { DialogueSentence, Scene } from '../types';
import { speechService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';
import { evaluatePronunciation, PronunciationAssessment } from '../services/pronunciationService';
import { escapeHtml } from '../utils/sanitize';

// Browser Web Speech Recognition interface polyfill
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export class ShadowingModal {
  private container: HTMLElement;
  private currentScene: Scene | null = null;
  private currentSentence: DialogueSentence | null = null;
  private sentenceIndex: number = 0;
  private recognition: any = null;
  private isListening: boolean = false;
  private recordingStartTime: number = 0;
  private transcript: string = '';
  private isSpeechSupported: boolean = false;
  private onCloseCallback: (() => void) | null = null;
  private onPassedCallback: ((score: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initSpeechRecognition();
  }

  private initSpeechRecognition(): void {
    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      this.isSpeechSupported = true;
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
      } catch {
        this.isSpeechSupported = false;
      }
    } else {
      this.isSpeechSupported = false;
    }
  }

  public setCallbacks(callbacks: {
    onClose: () => void;
    onPassed: (score: number) => void;
  }): void {
    this.onCloseCallback = callbacks.onClose;
    this.onPassedCallback = callbacks.onPassed;
  }

  public open(scene: Scene, sentence: DialogueSentence, index: number): void {
    this.currentScene = scene;
    this.currentSentence = sentence;
    this.sentenceIndex = index;
    this.transcript = '';
    this.isListening = false;
    this.render();
  }

  public close(): void {
    this.stopListening();
    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('modal-closing');
      setTimeout(() => {
        this.container.innerHTML = '';
        this.onCloseCallback?.();
      }, 240);
    } else {
      this.container.innerHTML = '';
      this.onCloseCallback?.();
    }
  }

  private startListening(): void {
    if (!this.recognition || !this.currentSentence) return;

    this.transcript = '';
    this.recordingStartTime = Date.now();
    this.isListening = true;

    // Set recognition language matching scene accent
    this.recognition.lang = this.currentScene?.accent === 'British' ? 'en-GB' : 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateMicUiState('recording');
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      this.transcript = activeText;
      this.updateLiveTranscription(activeText);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      this.updateMicUiState('idle');
      
      const errorNote = this.container.querySelector('#shadowingErrorNote');
      if (errorNote) {
        let msg = '';
        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            msg = 'Mikrofonga ruxsat berilmadi. Brauzer manzillar panelidagi qulf (yoki kamera/mikrofon) belgisini bosib, "Ruxsat berish"ni yoqing.';
            break;
          case 'no-speech':
            msg = 'Hech qanday ovoz eshitilmadi. Iltimos, mikrofonga yaqinroq kelib qayta gapiring.';
            break;
          case 'audio-capture':
            msg = 'Mikrofon topilmadi yoki boshqa ilova tomonidan band qilingan.';
            break;
          case 'network':
            msg = 'Tarmoq xatosi. Ovozni aniqlash uchun internet aloqasini tekshiring.';
            break;
          case 'aborted':
            return;
          default:
            msg = `Mikrofon xatosi: ${event.error || 'Nomaʼlum'}. Iltimos, qayta urinib ko‘ring.`;
        }
        errorNote.textContent = msg;
        (errorNote as HTMLElement).style.display = 'block';
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateMicUiState('idle');

      const durationSec = Math.max(0.8, (Date.now() - this.recordingStartTime) / 1000);
      this.finishAssessment(this.transcript, durationSec);
    };

    try {
      this.recognition.start();
    } catch {
      // In case already started, restart
      try {
        this.recognition.stop();
        setTimeout(() => this.recognition.start(), 150);
      } catch {
        this.isListening = false;
      }
    }
  }

  private stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.isListening = false;
  }

  private finishAssessment(spokenText: string, durationSec: number): void {
    if (!this.currentSentence) return;

    const assessment = evaluatePronunciation(spokenText, this.currentSentence.text, durationSec);

    // Adaptive threshold based on scene difficulty and sentence length
    let requiredThreshold = 65; // Balanced friendly default
    if (this.currentScene?.difficulty === 'advanced') {
      requiredThreshold = 75;
    } else if (this.currentScene?.difficulty === 'intermediate') {
      requiredThreshold = 68;
    } else {
      requiredThreshold = 60; // Beginner friendly
    }

    // Long sentences give more room for slight phonetic variance
    const wordCount = this.currentSentence.text.split(/\s+/).length;
    if (wordCount > 6) {
      requiredThreshold = Math.max(55, requiredThreshold - 5);
    }

    if (assessment.overallScore >= requiredThreshold) {
      soundEffects.playCorrectWord();
      this.onPassedCallback?.(assessment.overallScore);
    } else {
      soundEffects.playError();
    }

    this.renderAssessmentView(assessment);
  }

  private render(): void {
    if (!this.currentSentence || !this.currentScene) return;

    const numStr = (this.sentenceIndex + 1).toString().padStart(2, '0');

    this.container.innerHTML = `
      <div class="modal-backdrop" id="shadowingModalBackdrop">
        <div class="modal-card shadowing-modal-card">
          <!-- Header -->
          <div class="modal-header shadowing-header">
            <div class="shadowing-header-left">
              <span class="shadowing-badge-pill">
                <i class="ph ph-microphone-stage"></i> Shadowing Mode
              </span>
              <h3>AI Ovozli Takrorlash</h3>
            </div>
            <button class="close-modal-round-btn" id="closeShadowingModalBtn" title="Yopish">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body shadowing-body">
            <!-- Target Dialogue Card -->
            <div class="shadowing-target-card">
              <div class="shadowing-speaker-tag">
                <span class="avatar">${this.currentSentence.characterAvatar || '🗣️'}</span>
                <strong>${escapeHtml(this.currentSentence.character)}</strong>
                <span class="accent-badge">${escapeHtml(this.currentScene.accent)} Accent</span>
              </div>

              <div class="shadowing-target-sentence-text" id="targetSentenceText">
                ${escapeHtml(this.currentSentence.text)}
              </div>

              <div class="shadowing-target-uz-trans">
                <i class="ph ph-translate"></i> "${escapeHtml(this.currentSentence.uzbekTranslation)}"
              </div>

              <div class="shadowing-audio-action-row">
                <button class="shadowing-listen-btn" id="shadowingReplayAudioBtn">
                  <i class="ph ph-speaker-high"></i> Qahramon ovozini tinglash
                </button>
                <span class="shadowing-listen-tip">Avval diqqat bilan eshiting, so‘ng mikrofonga takrorlang</span>
              </div>
            </div>

            <!-- Dynamic Interactive Microphone & Recognition Zone -->
            <div class="shadowing-interactive-zone" id="shadowingInteractiveZone">
              ${this.renderRecordingIdleStateHtml()}
            </div>

            <div id="shadowingErrorNote" class="shadowing-error-alert" style="display: none;"></div>
          </div>

          <!-- Footer -->
          <div class="shadowing-footer-bar">
            <button class="clean-btn" id="shadowingSkipSentenceBtn">
              O‘tkazib yuborish <i class="ph ph-arrow-right"></i>
            </button>
            <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">
              ${numStr} / ${this.currentScene.dialogues.length} ta replika
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderRecordingIdleStateHtml(): string {
    if (!this.isSpeechSupported) {
      return `
        <div class="shadowing-mic-center-box" style="display: flex; flex-direction: column; gap: 0.75rem; align-items: center; max-width: 480px; margin: 0 auto; text-align: center;">
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 0.75rem 1rem; color: #EF4444; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <i class="ph ph-warning-circle" style="font-size: 1.25rem; flex-shrink: 0;"></i>
            <span>Brauzeringizda Web Speech API (ovozni aniqlash) cheklangan yoki faollashtirilmagan (masalan Firefox). Chrome, Edge yoki Safari tavsiya etiladi.</span>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0;">
            Quyida replikani o‘zingiz aytib ko‘rganingizdek yozing yoki tekshiring:
          </p>

          <div style="display: flex; width: 100%; gap: 0.5rem;">
            <input type="text" id="manualSpeechInput" class="form-clean-input" placeholder="Aytgan so‘zlaringizni kiriting..." style="flex: 1;" />
            <button type="button" class="card-continue-btn" id="manualSpeechSubmitBtn" style="padding: 0.55rem 1.15rem; font-size: 0.84rem;">
              Tekshirish
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="shadowing-mic-center-box">
        <button class="shadowing-big-mic-btn glow-cta-btn" id="shadowingToggleMicBtn" title="Gapirish uchun bosing">
          <span class="glow-effect-track" aria-hidden="true"></span>
          <span class="mic-icon-circle">
            <i class="ph ph-microphone"></i>
          </span>
          <span class="mic-cta-label">Gapirish uchun bosing</span>
        </button>

        <p class="shadowing-mic-instruction">
          Tugmani bosing va <strong>"${escapeHtml(this.currentSentence?.text || '')}"</strong> jumlasini ovoz chiqarib ayting
        </p>
      </div>
    `;
  }

  private renderAssessmentView(assessment: PronunciationAssessment): void {
    const zone = this.container.querySelector('#shadowingInteractiveZone');
    if (!zone || !this.currentSentence) return;

    const isPassed = assessment.overallScore >= 70;
    const scoreClass = isPassed ? 'score-high' : 'score-low';

    zone.innerHTML = `
      <div class="shadowing-assessment-card">
        <!-- Top Score Bar -->
        <div class="shadowing-score-summary-row">
          <div class="shadowing-score-circle ${scoreClass}">
            <span class="num">${assessment.overallScore}%</span>
            <span class="lbl">Aniqlik</span>
          </div>

          <div class="shadowing-feedback-block">
            <h4 class="shadowing-verdict ${scoreClass}">${escapeHtml(assessment.verdict)}</h4>
            <p class="shadowing-feedback-msg">${escapeHtml(assessment.feedbackUz)}</p>
          </div>
        </div>

        <!-- Word by Word Analysis -->
        <div class="shadowing-words-analysis-title">
          <span>So‘zlar tahlili:</span>
        </div>

        <div class="shadowing-words-pill-grid">
          ${assessment.words.map(w => {
            let statusIcon = '✓';
            let statusBadge = 'status-perfect';
            if (w.status === 'good') {
              statusIcon = '✓';
              statusBadge = 'status-good';
            } else if (w.status === 'imperfect') {
              statusIcon = '△';
              statusBadge = 'status-imperfect';
            } else if (w.status === 'missed') {
              statusIcon = '✗';
              statusBadge = 'status-missed';
            }

            return `
              <div class="shadowing-word-chip ${statusBadge}" title="${escapeHtml(w.tip || `${w.similarity}% aniqlik`)}">
                <span class="chip-status-icon">${statusIcon}</span>
                <span class="chip-word-text">${escapeHtml(w.expectedWord)}</span>
                <span class="chip-score-pct">${w.similarity}%</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- User Said Transcript Comparison -->
        <div class="shadowing-transcript-comparison">
          <div class="comp-label">AI eshitgan matn:</div>
          <div class="comp-text">"${escapeHtml(assessment.transcript || '(hech narsa aytilmadi)')}"</div>
        </div>

        <!-- Action Row -->
        <div class="shadowing-post-action-row">
          <button class="clean-btn" id="shadowingRetryBtn">
            <i class="ph ph-arrow-counter-clockwise"></i> Qayta urinish
          </button>
          ${isPassed ? `
            <button class="shadowing-next-btn glow-cta-btn" id="shadowingContinueBtn">
              <span class="glow-effect-track" aria-hidden="true"></span>
              <span class="btn-text-content">Keyingi jumla</span>
              <i class="ph ph-arrow-right"></i>
            </button>
          ` : `
            <button class="clean-btn subtle-text" id="shadowingContinueAnywayBtn">
              Keyingisiga o‘tish ➔
            </button>
          `}
        </div>
      </div>
    `;

    // Bind sub-actions
    this.container.querySelector('#shadowingRetryBtn')?.addEventListener('click', () => {
      const interZone = this.container.querySelector('#shadowingInteractiveZone');
      if (interZone) {
        interZone.innerHTML = this.renderRecordingIdleStateHtml();
        this.bindMicButton();
      }
    });

    this.container.querySelector('#shadowingContinueBtn')?.addEventListener('click', () => {
      this.close();
    });

    this.container.querySelector('#shadowingContinueAnywayBtn')?.addEventListener('click', () => {
      this.close();
    });
  }

  private updateMicUiState(state: 'idle' | 'recording'): void {
    const micBtn = this.container.querySelector('#shadowingToggleMicBtn');
    if (!micBtn) return;

    if (state === 'recording') {
      micBtn.classList.add('is-recording');
      const label = micBtn.querySelector('.mic-cta-label');
      if (label) label.textContent = 'Eshitilmoqda... (Gapiring)';
    } else {
      micBtn.classList.remove('is-recording');
      const label = micBtn.querySelector('.mic-cta-label');
      if (label) label.textContent = 'Gapirish uchun bosing';
    }
  }

  private updateLiveTranscription(text: string): void {
    const compText = this.container.querySelector('.shadowing-mic-instruction');
    if (compText && text) {
      compText.innerHTML = `Eshitilmoqda: <span style="color: var(--accent-orange); font-weight: 700;">"${escapeHtml(text)}"</span>`;
    }
  }

  private bindEvents(): void {
    this.container.querySelector('#shadowingModalBackdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'shadowingModalBackdrop') {
        this.close();
      }
    });

    this.container.querySelector('#closeShadowingModalBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#shadowingSkipSentenceBtn')?.addEventListener('click', () => this.close());

    this.container.querySelector('#shadowingReplayAudioBtn')?.addEventListener('click', () => {
      if (this.currentSentence && this.currentScene) {
        speechService.speakDialogue(this.currentSentence, this.currentScene.accent);
      }
    });

    this.bindMicButton();

    // Manual Speech verification fallback
    const manualBtn = this.container.querySelector('#manualSpeechSubmitBtn');
    const manualInput = this.container.querySelector<HTMLInputElement>('#manualSpeechInput');
    const submitManual = () => {
      const text = manualInput?.value.trim() || '';
      if (text) {
        this.finishAssessment(text, 2.0);
      }
    };
    manualBtn?.addEventListener('click', submitManual);
    manualInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitManual();
      }
    });
  }

  private bindMicButton(): void {
    const micBtn = this.container.querySelector('#shadowingToggleMicBtn');
    micBtn?.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
  }
}
