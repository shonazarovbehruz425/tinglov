export interface StepData {
  title: string;
  subtitle?: string;
  badge?: string;
  contentHtml: string;
}

export class OnboardingStepper {
  private overlay: HTMLElement | null = null;
  private currentStep: number = 1;
  private direction: number = 1;
  private steps: StepData[] = [];
  private onCompleteCallback: (() => void) | null = null;

  constructor() {
    this.initSteps();
  }

  private initSteps(): void {
    this.steps = [
      {
        badge: '🎬 Tinglov bilan tanishuv',
        title: 'Platformaga xush kelibsiz!',
        subtitle: 'Ingliz tilini multfilm va kinolarni eshitib yozish orqali o‘rganing',
        contentHtml: `
          <div class="stepper-visual-hero">
            <div class="stepper-hero-film-strip">
              <img src="/logo-full.png" alt="Tinglov" class="stepper-hero-thumb" style="object-fit: contain; background: rgba(0,0,0,0.4); padding: 1rem;" />
              <div class="stepper-hero-badge-float">
                <i class="ph ph-sparkle-fill"></i>
                <span>Interaktiv Listening</span>
              </div>
            </div>
            <p class="stepper-body-p">
              Tinglov orqali siz shunchaki passiv tomosha qilmaysiz. Qahramonlar aytgan har bir replikani tinglab, o‘z qo‘lingiz bilan yozib borasiz. Bu eshitish va to‘g‘ri yozish ko‘nikmangizni keskin rivojlantiradi.
            </p>
            <div class="stepper-feature-tags">
              <span class="stepper-tag"><i class="ph ph-headphones"></i> Aniq talaffuz</span>
              <span class="stepper-tag"><i class="ph ph-keyboard"></i> Diktant va WPM</span>
              <span class="stepper-tag"><i class="ph ph-translate"></i> Jonli lug‘at</span>
            </div>
          </div>
        `
      },
      {
        badge: '📌 1-qadam: Dars tanlash',
        title: 'Darsni tanlang va Boshlang',
        subtitle: 'Bosh sahifadagi qulay kategoriya filtrlari va dars kartalari',
        contentHtml: `
          <div class="stepper-highlight-box">
            <div class="stepper-demo-card">
              <div class="stepper-demo-header">
                <span class="stepper-demo-pill">Multfilmlar</span>
                <span class="stepper-demo-pill dur">0:57</span>
              </div>
              <h4 class="stepper-demo-title">Oppog‘oy va Yetti Gnom</h4>
              <p class="stepper-demo-sub">Snow White and the Seven Dwarfs</p>
              <div class="stepper-demo-action">
                <span class="stepper-demo-badge">A1 Boshlovchi</span>
                <div class="stepper-btn-spotlight">
                  <button class="stepper-mock-cta-btn glow-cta-btn">
                    <span class="glow-effect-track" aria-hidden="true"></span>
                    <span class="btn-text-content">
                      <i class="ph ph-play-fill"></i> Mashqni boshlash
                    </span>
                    <svg class="btn-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                  <div class="stepper-pointer-arrow">
                    <i class="ph ph-arrow-fat-up-fill"></i>
                    <span>Asosiy start tugmasi</span>
                  </div>
                </div>
              </div>
            </div>
            <p class="stepper-tip-text">
              <i class="ph ph-info"></i> Har qanday darsni boshlash uchun bosh sahifadagi to‘q sariq <strong>"Mashqni boshlash"</strong> tugmasini bosing.
            </p>
          </div>
        `
      },
      {
        badge: '🎧 2-qadam: Tinglash va Yozish',
        title: 'Pleyer va Diktant boshqaruvi',
        subtitle: 'Videoni qayta tinglash, sekinlashtirish va klaviatura yordamchilari',
        contentHtml: `
          <div class="stepper-controls-showcase">
            <div class="stepper-keys-grid">
              <div class="stepper-key-card">
                <kbd class="stepper-kbd">Alt</kbd> + <kbd class="stepper-kbd">S</kbd>
                <div class="stepper-key-info">
                  <strong>Shadowing (AI Ovoz)</strong>
                  <span>Mikrofonga gapirib, talaffuzni AI orqali tekshirish</span>
                </div>
              </div>
              <div class="stepper-key-card">
                <kbd class="stepper-kbd">Enter</kbd>
                <div class="stepper-key-info">
                  <strong>Tekshirish</strong>
                  <span>Yozgan so‘zlaringiz to‘g‘riligini bilish</span>
                </div>
              </div>
              <div class="stepper-key-card">
                <kbd class="stepper-kbd">Alt</kbd> + <kbd class="stepper-kbd">H</kbd>
                <div class="stepper-key-info">
                  <strong>Harfiy yordam (Hint)</strong>
                  <span>Qiyin so‘zda birinchi harfni ochish</span>
                </div>
              </div>
              <div class="stepper-key-card">
                <kbd class="stepper-kbd">0.75x</kbd>
                <div class="stepper-key-info">
                  <strong>Sekinlashtirish</strong>
                  <span>Tez aytilgan replikalarni sekin tinglash</span>
                </div>
              </div>
            </div>
            <p class="stepper-tip-text">
              <i class="ph ph-microphone"></i> Matnni yozib bo‘lgach, avtomatik <strong>Shadowing Mode</strong> ochiladi: mikrofonga gapirasiz va AI talaffuzingizni so‘zma-so‘z baholaydi!
            </p>
          </div>
        `
      },
      {
        badge: '⚡ 3-qadam: Statistika va Yutuqlar',
        title: 'Natijalar, Streak va Profil',
        subtitle: 'Har kuni 10 ta replika yozib, eshitish qobiliyatingizni 3x oshiring',
        contentHtml: `
          <div class="stepper-stats-preview-wrap">
            <div class="stepper-stats-pills-row">
              <div class="stepper-stat-pill-preview">
                <span class="icon-streak">🔥 1 kun</span>
                <span class="sep">/</span>
                <span class="icon-xp">⚡ 300 XP</span>
              </div>
              <div class="stepper-stat-pill-preview vocab">
                <i class="ph ph-bookmark-simple"></i>
                <span>Lug‘at</span>
              </div>
              <div class="stepper-stat-pill-preview profile">
                <div class="mock-avatar">F</div>
                <span>Profil</span>
              </div>
            </div>
            <div class="stepper-congrats-card">
              <div class="stepper-congrats-icon"><i class="ph ph-trophy"></i></div>
              <div>
                <strong>Siz to‘liq tayyorsiz!</strong>
                <p>Birinchi darsni boshlang va hoziroq o‘z listening mahoratingizni sinab ko‘ring.</p>
              </div>
            </div>
          </div>
        `
      }
    ];
  }

  public setOnComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
  }

  public shouldAutoOpen(): boolean {
    return localStorage.getItem('movielisten_onboarded') !== 'true';
  }

  private handleWindowResize = (): void => {
    this.adjustViewportHeight();
  };

  public open(startStep: number = 1): void {
    this.currentStep = Math.min(Math.max(1, startStep), this.steps.length);
    this.direction = 1;
    document.body.classList.add('modal-open-locked');
    document.documentElement.classList.add('modal-open-locked');
    this.render();
    window.addEventListener('resize', this.handleWindowResize);
  }

  public close(): void {
    document.body.classList.remove('modal-open-locked');
    document.documentElement.classList.remove('modal-open-locked');
    window.removeEventListener('resize', this.handleWindowResize);
    if (!this.overlay) return;
    this.overlay.classList.add('closing');
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
    }, 280);
  }

  private complete(): void {
    localStorage.setItem('movielisten_onboarded', 'true');
    this.close();
    this.onCompleteCallback?.();
  }

  private goToStep(stepNumber: number): void {
    if (stepNumber === this.currentStep || stepNumber < 1 || stepNumber > this.steps.length) return;
    this.direction = stepNumber > this.currentStep ? 1 : -1;
    this.currentStep = stepNumber;
    this.updateContent();
  }

  private render(): void {
    document.getElementById('onboardingStepperOverlay')?.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'onboardingStepperOverlay';
    this.overlay.className = 'stepper-overlay-backdrop';

    this.overlay.innerHTML = `
      <div class="stepper-modal-container" role="dialog" aria-modal="true">
        <!-- Top Header: Title / Badge & Close Button separated from indicators -->
        <div class="stepper-top-header">
          <div class="stepper-header-title-badge">
            <i class="ph ph-sparkle"></i>
            <span>Tinglov Qo‘llanma</span>
          </div>
          <button class="stepper-close-btn" id="stepperCloseBtn" title="O‘tkazib yuborish (Yopish)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Stepper Indicators Header -->
        <div class="stepper-indicators-bar" id="stepperIndicatorsBar">
          ${this.renderIndicatorsHtml()}
        </div>

        <!-- Dynamic Height Animated Content Container -->
        <div class="stepper-content-viewport" id="stepperContentViewport">
          <div class="stepper-slide-panel" id="stepperSlidePanel">
            ${this.renderCurrentStepHtml()}
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="stepper-footer-bar">
          <button class="stepper-back-btn ${this.currentStep === 1 ? 'hidden-back' : ''}" id="stepperBackBtn">
            <i class="ph ph-arrow-left"></i> Orqaga
          </button>
          
          <div class="stepper-footer-right">
            <span class="stepper-step-count-text">${this.currentStep} / ${this.steps.length}</span>
            <button class="stepper-next-btn glow-cta-btn" id="stepperNextBtn">
              <span class="glow-effect-track" aria-hidden="true"></span>
              <span class="btn-text-content">
                <span>${this.currentStep === this.steps.length ? 'Boshlash 🚀' : 'Davom etish'}</span>
              </span>
              <svg class="btn-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    requestAnimationFrame(() => {
      this.adjustViewportHeight();
    });

    this.bindEvents();
  }

  private renderIndicatorsHtml(): string {
    const total = this.steps.length;
    return this.steps.map((_, idx) => {
      const stepNum = idx + 1;
      const isComplete = this.currentStep > stepNum;
      const isActive = this.currentStep === stepNum;
      const isNotLast = idx < total - 1;

      const checkSvg = `
        <svg class="stepper-check-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      return `
        <div class="stepper-indicator-node" data-step="${stepNum}">
          <div class="stepper-circle ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
            ${isComplete ? checkSvg : `<span>${stepNum}</span>`}
          </div>
        </div>
        ${isNotLast ? `
          <div class="stepper-connector-line">
            <div class="stepper-connector-fill" style="transform: scaleX(${isComplete ? 1 : 0});"></div>
          </div>
        ` : ''}
      `;
    }).join('');
  }

  private renderCurrentStepHtml(): string {
    const step = this.steps[this.currentStep - 1];
    return `
      <div class="stepper-step-body">
        ${step.badge ? `<div class="stepper-badge-pill">${step.badge}</div>` : ''}
        <h3 class="stepper-title">${step.title}</h3>
        ${step.subtitle ? `<p class="stepper-subtitle">${step.subtitle}</p>` : ''}
        <div class="stepper-custom-content">
          ${step.contentHtml}
        </div>
      </div>
    `;
  }

  private updateContent(): void {
    if (!this.overlay) return;

    // 1. Update Indicators
    const indicatorsBar = this.overlay.querySelector('#stepperIndicatorsBar');
    if (indicatorsBar) {
      indicatorsBar.innerHTML = this.renderIndicatorsHtml();
      this.bindIndicatorClicks();
    }

    // 2. Slide transition with direction
    const oldPanel = this.overlay.querySelector('#stepperSlidePanel') as HTMLElement;

    if (oldPanel) {
      const slideOutClass = this.direction > 0 ? 'slide-exit-left' : 'slide-exit-right';
      const slideInClass = this.direction > 0 ? 'slide-enter-right' : 'slide-enter-left';

      oldPanel.className = `stepper-slide-panel ${slideOutClass}`;

      setTimeout(() => {
        oldPanel.innerHTML = this.renderCurrentStepHtml();
        oldPanel.className = `stepper-slide-panel ${slideInClass}`;
        
        const viewport = this.overlay?.querySelector('#stepperContentViewport') as HTMLElement;
        if (viewport) viewport.scrollTop = 0;

        requestAnimationFrame(() => {
          this.adjustViewportHeight();
          oldPanel.className = 'stepper-slide-panel slide-center';
        });
      }, 160);
    }

    // 3. Update Footer
    const backBtn = this.overlay.querySelector('#stepperBackBtn') as HTMLElement;
    const nextBtn = this.overlay.querySelector('#stepperNextBtn') as HTMLElement;
    const countText = this.overlay.querySelector('.stepper-step-count-text') as HTMLElement;

    if (backBtn) {
      if (this.currentStep === 1) {
        backBtn.classList.add('hidden-back');
      } else {
        backBtn.classList.remove('hidden-back');
      }
    }

    if (nextBtn) {
      const isLast = this.currentStep === this.steps.length;
      nextBtn.innerHTML = `
        <span class="glow-effect-track" aria-hidden="true"></span>
        <span class="btn-text-content">
          <span>${isLast ? 'Boshlash 🚀' : 'Davom etish'}</span>
        </span>
        <svg class="btn-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
    }

    if (countText) {
      countText.textContent = `${this.currentStep} / ${this.steps.length}`;
    }
  }

  private adjustViewportHeight(): void {
    if (!this.overlay) return;
    const viewport = this.overlay.querySelector('#stepperContentViewport') as HTMLElement;
    const panel = this.overlay.querySelector('#stepperSlidePanel') as HTMLElement;
    if (viewport && panel) {
      const availableSpace = Math.max(200, window.innerHeight - 250);
      const targetHeight = Math.min(panel.scrollHeight, availableSpace);
      viewport.style.height = `${targetHeight}px`;
      viewport.style.maxHeight = `${availableSpace}px`;
    }
  }

  private bindIndicatorClicks(): void {
    if (!this.overlay) return;
    const nodes = this.overlay.querySelectorAll('.stepper-indicator-node');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        const stepNum = parseInt((node as HTMLElement).dataset.step || '1', 10);
        this.goToStep(stepNum);
      });
    });
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    // Prevent background scrolling / wheel leakage to underlying page
    this.overlay.addEventListener('wheel', (e) => {
      const target = e.target as HTMLElement;
      const viewport = target?.closest('#stepperContentViewport') as HTMLElement | null;
      if (!viewport) {
        e.preventDefault();
        return;
      }
      const isAtTop = viewport.scrollTop <= 0 && e.deltaY < 0;
      const isAtBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1 && e.deltaY > 0;
      if (isAtTop || isAtBottom) {
        e.preventDefault();
      }
    }, { passive: false });

    this.overlay.addEventListener('touchmove', (e) => {
      const target = e.target as HTMLElement;
      const viewport = target?.closest('#stepperContentViewport');
      if (!viewport) {
        e.preventDefault();
      }
    }, { passive: false });

    this.overlay.querySelector('#stepperCloseBtn')?.addEventListener('click', () => {
      this.complete();
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.complete();
      }
    });

    this.overlay.querySelector('#stepperBackBtn')?.addEventListener('click', () => {
      if (this.currentStep > 1) {
        this.goToStep(this.currentStep - 1);
      }
    });

    this.overlay.querySelector('#stepperNextBtn')?.addEventListener('click', () => {
      if (this.currentStep < this.steps.length) {
        this.goToStep(this.currentStep + 1);
      } else {
        this.complete();
      }
    });

    this.bindIndicatorClicks();

    const handleKeydown = (e: KeyboardEvent) => {
      if (!this.overlay) {
        window.removeEventListener('keydown', handleKeydown);
        return;
      }
      if (e.key === 'Escape') {
        this.complete();
      } else if (e.key === 'ArrowRight') {
        if (this.currentStep < this.steps.length) {
          this.goToStep(this.currentStep + 1);
        } else {
          this.complete();
        }
      } else if (e.key === 'ArrowLeft' && this.currentStep > 1) {
        this.goToStep(this.currentStep - 1);
      }
    };
    window.addEventListener('keydown', handleKeydown);
  }
}

export const onboardingStepper = new OnboardingStepper();
