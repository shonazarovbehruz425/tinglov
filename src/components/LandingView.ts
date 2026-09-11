import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { Scene } from '../types/index';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';

export interface LandingViewCallbacks {
  onOpenDashboard: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenPractice: (sceneId: string) => void;
}

export class LandingView {
  private container: HTMLElement;
  private callbacks: LandingViewCallbacks | null = null;
  private isDemoAudioPlaying: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: LandingViewCallbacks): void {
    this.callbacks = callbacks;
  }

  public render(): void {
    const isAuth = apiService.isAuthenticated();
    const currentUser = apiService.getCurrentUser();
    const allScenes = storageService.getAllScenes();

    const displayName = currentUser?.full_name || currentUser?.username || 'Foydalanuvchi';
    const safeDisplayName = escapeHtml(displayName);
    const userInitial = escapeHtml((displayName[0] || 'F').toUpperCase());
    const userName = safeDisplayName;

    // Real "continue learning" hero: lastPositions'dagi eng oldinda turgan dars
    const stats = storageService.getStats();
    const lastPositions = stats.lastPositions || {};
    let continueScene: Scene | null = null;
    let continueIndex = 0;
    let continuePct = 0;
    for (const scene of allScenes) {
      const pos = lastPositions[scene.id];
      if (typeof pos === 'number' && scene.dialogues.length > 0) {
        const pct = Math.min(100, Math.round(((pos + 1) / scene.dialogues.length) * 100));
        if (!continueScene || pct > continuePct) {
          continueScene = scene;
          continueIndex = pos;
          continuePct = stats.completedScenes.includes(scene.id) ? 100 : pct;
        }
      }
    }

    const continueCardHtml = continueScene ? `
      <div class="landing-continue-card" role="region" aria-label="Davom etayotgan dars">
        <div class="landing-continue-left">
          <div class="landing-continue-glow"></div>
          <span class="landing-continue-kicker"><i class="ph ph-lightning-fill"></i> Davom etish</span>
          <h3 class="landing-continue-title">${escapeHtml(continueScene.title)}</h3>
          <p class="landing-continue-sub">${escapeHtml(continueScene.movieName)} • Replika ${continueIndex + 1}/${continueScene.dialogues.length}</p>
        </div>
        <div class="landing-continue-center">
          <div class="landing-continue-progress-meta">
            <span class="landing-continue-pct-text">${continuePct}% yakunlangan</span>
            <span class="landing-continue-remaining">${continueScene.dialogues.length - (continueIndex + 1)} replika qoldi</span>
          </div>
          <div class="landing-continue-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${continuePct}" aria-label="${escapeHtml(continueScene.title)} progress">
            <div class="landing-continue-progress-fill" style="width: ${continuePct}%"></div>
          </div>
        </div>
        <div class="landing-continue-right">
          <button class="landing-btn landing-btn-primary landing-continue-action-btn" data-continue-scene-id="${escapeHtml(continueScene.id)}">
            <i class="ph ph-play-fill" aria-hidden="true"></i> Davom etish
          </button>
        </div>
      </div>
    ` : '';

    // Cinema Marquee Ribbon items (popular blockbusters)
    const marqueeMovies = [
      {
        title: "Wednesday's Secret",
        movieName: "Wednesday",
        difficulty: "A2",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
        sceneId: allScenes[0]?.id
      },
      {
        title: "Do Not Go Gentle",
        movieName: "Interstellar",
        difficulty: "B2",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
        sceneId: allScenes[1]?.id
      },
      {
        title: "Platform 9 ¾",
        movieName: "Harry Potter",
        difficulty: "B1",
        accent: "British",
        flag: "🇬🇧",
        poster: "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?auto=format&fit=crop&w=600&q=80",
        sceneId: allScenes[2]?.id
      },
      {
        title: "Whatever It Takes",
        movieName: "Avengers: Endgame",
        difficulty: "B1",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80",
        sceneId: allScenes[3]?.id
      },
      {
        title: "Can You Hear The Music",
        movieName: "Oppenheimer",
        difficulty: "C1",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
        sceneId: allScenes[4]?.id
      },
      {
        title: "The Upside Down",
        movieName: "Stranger Things",
        difficulty: "B1",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80"
      },
      {
        title: "Inner Peace",
        movieName: "Kung Fu Panda",
        difficulty: "A2",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80"
      },
      {
        title: "By Order Of The Peaky",
        movieName: "Peaky Blinders",
        difficulty: "B2",
        accent: "British",
        flag: "🇬🇧",
        poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80"
      },
      {
        title: "Dream Within A Dream",
        movieName: "Inception",
        difficulty: "B2",
        accent: "American",
        flag: "🇺🇸",
        poster: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80"
      }
    ];

    const marqueeHtml = [...marqueeMovies, ...marqueeMovies].map((m) => `
      <div class="marquee-card" data-scene-id="${escapeHtml(m.sceneId || '')}" role="button" tabindex="0" aria-label="${escapeHtml(m.movieName)} darsi">
        <div class="marquee-card-img-wrap">
          <img src="${m.poster}" alt="${escapeHtml(m.movieName)}" class="marquee-card-img" loading="lazy" />
          <div class="marquee-card-badge-row">
            <span class="marquee-pill-level level-${m.difficulty.toLowerCase()}">${m.difficulty}</span>
            <span class="marquee-pill-accent">${m.flag} ${m.accent === 'British' ? 'GB' : 'US'}</span>
          </div>
          <div class="marquee-card-play-overlay">
            <i class="ph ph-play-fill"></i>
          </div>
        </div>
        <div class="marquee-card-meta">
          <h4 class="marquee-card-movie">${escapeHtml(m.movieName)}</h4>
          <p class="marquee-card-title">${escapeHtml(m.title)}</p>
        </div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="landing-page">
        <!-- Ambient Glowing Background Orbs -->
        <div class="landing-ambient-bg" aria-hidden="true">
          <div class="ambient-orb orb-1"></div>
          <div class="ambient-orb orb-2"></div>
          <div class="ambient-orb orb-3"></div>
          <div class="cyber-grid-overlay"></div>
        </div>

        <!-- Sticky Navigation -->
        <nav class="landing-navbar" role="navigation" aria-label="Asosiy navigatsiya">
          <div class="landing-nav-inner">
            <div class="landing-brand" id="landingNavBrandBtn" role="button" tabindex="0" aria-label="Tinglov bosh sahifasiga qaytish">
              <div class="brand-logo-glow-wrap">
                <img src="/logo.png" alt="Tinglov Logo" class="landing-logo-img" />
              </div>
              <div class="landing-logo-text-group">
                <span class="landing-logo-title">Ting<span>lov</span></span>
                <span class="landing-domain-badge">PRO</span>
              </div>
            </div>

            <div class="landing-nav-links">
              <a href="#features" class="landing-nav-link"><i class="ph ph-sparkle"></i> Imkoniyatlar</a>
              <a href="#how-it-works" class="landing-nav-link"><i class="ph ph-steps"></i> Metodika</a>
              <a href="#comparison" class="landing-nav-link"><i class="ph ph-scales"></i> Nega Tinglov?</a>
              <a href="#catalog" class="landing-nav-link"><i class="ph ph-film-slate"></i> Filmlar</a>
              <a href="#faq" class="landing-nav-link"><i class="ph ph-question"></i> FAQ</a>
            </div>

            <div class="landing-nav-actions">
              ${isAuth ? `
                <div class="landing-user-preview">
                  <div class="landing-user-avatar">${userInitial}</div>
                  <span class="landing-user-name">${userName}</span>
                </div>
                <button class="landing-btn landing-btn-primary" id="landingNavDashboardBtn">
                  <i class="ph ph-squares-four-fill"></i> Dashboard
                </button>
              ` : `
                <button class="landing-btn landing-btn-ghost" id="landingNavLoginBtn">
                  <i class="ph ph-sign-in"></i> Kirish
                </button>
                <button class="landing-btn landing-btn-primary" id="landingNavRegisterBtn">
                  <i class="ph ph-rocket-launch-fill"></i> Bepul boshlash
                </button>
              `}
            </div>
          </div>
        </nav>

        <!-- Hero Section -->
        <header class="landing-hero">
          <div class="landing-hero-content">
            <!-- Top Announcement Pill -->
            <div class="landing-badge-pill">
              <span class="badge-pulsing-dot"></span>
              <span class="badge-flame">✨</span>
              <span>Kino orqali ingliz tilini eshitib tushunishning #1 interaktiv platformasi</span>
            </div>

            <h1 class="landing-hero-title">
              Filmlarni subtitrsiz tushunishni <br class="hero-br" />
              <span class="text-gradient-cinema">10x tezlashtiring</span>
            </h1>

            <p class="landing-hero-subtitle">
              Zerikarli qoidalar va darsliklarni unuting. Sevimli qahramonlaringiz tili orqali <strong>harfma-harf jonli diktant</strong>, <strong>AI Shadowing (talaffuz tahlili)</strong> va <strong>bir bosishda lug'at</strong> bilan quloqni haqiqiy nutqqa o'rgating.
            </p>

            <div class="landing-hero-cta-row">
              ${isAuth ? `
                <button class="landing-btn-large landing-btn-pulse" id="landingHeroDashboardBtn">
                  <i class="ph-fill ph-play-circle"></i> Boshqaruv paneliga o'tish
                  <span class="btn-flare"></span>
                </button>
              ` : `
                <button class="landing-btn-large landing-btn-pulse" id="landingHeroRegisterBtn">
                  <i class="ph-fill ph-rocket-launch"></i> Bepul mashq qilishni boshlash
                  <span class="btn-flare"></span>
                </button>
                <button class="landing-btn-large landing-btn-secondary" id="landingHeroLoginBtn">
                  <i class="ph-fill ph-film-slate"></i> Platformaga kirish
                </button>
              `}
            </div>

            <!-- Trust / Stats Bar -->
            <div class="landing-stats-pills">
              <div class="landing-stat-item">
                <span class="stat-num">100+</span>
                <span class="stat-label"><i class="ph-fill ph-film-strip"></i> Cinema lavhalari</span>
              </div>
              <div class="landing-stat-divider"></div>
              <div class="landing-stat-item">
                <span class="stat-num">10,000+</span>
                <span class="stat-label"><i class="ph-fill ph-chat-circle-text"></i> Real dialog iborasi</span>
              </div>
              <div class="landing-stat-divider"></div>
              <div class="landing-stat-item">
                <span class="stat-num">98%</span>
                <span class="stat-label"><i class="ph-fill ph-trend-up"></i> Eshitish tezligi o'sgan</span>
              </div>
              <div class="landing-stat-divider"></div>
              <div class="landing-stat-item">
                <span class="stat-num">0 so'm</span>
                <span class="stat-label"><i class="ph-fill ph-sparkle"></i> Bepul boshlash</span>
              </div>
            </div>

            <!-- Interactive Live Cinema Mockup (Real Interactive Simulator) -->
            <div class="landing-mockup-wrapper">
              <div class="mockup-floating-badge badge-top-left">
                <i class="ph-fill ph-waveform"></i> Real-time Audio Diktant
              </div>
              <div class="mockup-floating-badge badge-top-right">
                <i class="ph-fill ph-microphone-stage"></i> 98% AI Talaffuz Baholash
              </div>
              <div class="mockup-floating-badge badge-bottom-right">
                <i class="ph-fill ph-star"></i> +35 XP Topshiriq yakuni
              </div>

              <div class="landing-mockup-window">
                <div class="landing-mockup-topbar">
                  <div class="mockup-dots">
                    <span class="mockup-dot red"></span>
                    <span class="mockup-dot yellow"></span>
                    <span class="mockup-dot green"></span>
                  </div>
                  <div class="mockup-title-bar">
                    <i class="ph ph-film-slate"></i> Wednesday Addams — The Addams Family (A2-B1 Listening)
                  </div>
                  <!-- Mode Switcher Tabs inside Mockup -->
                  <div class="mockup-mode-tabs" role="tablist">
                    <button class="mockup-mode-tab active" data-mockup-mode="dictation" role="tab" aria-selected="true">
                      <i class="ph ph-keyboard"></i> Diktant
                    </button>
                    <button class="mockup-mode-tab" data-mockup-mode="shadowing" role="tab" aria-selected="false">
                      <i class="ph ph-microphone"></i> AI Shadowing
                    </button>
                    <button class="mockup-mode-tab" data-mockup-mode="vocab" role="tab" aria-selected="false">
                      <i class="ph ph-translate"></i> Lug'at
                    </button>
                  </div>
                </div>

                <div class="landing-mockup-body">
                  <!-- Left: Cinema Player Preview -->
                  <div class="mockup-player-side">
                    <div class="mockup-video-overlay">
                      <div class="mockup-speaker-badge">
                        <span class="speaker-pulse"></span>
                        <i class="ph ph-user-sound"></i> Wednesday Addams (00:14)
                      </div>
                      <div class="mockup-subtitle-box">
                        <p class="mockup-en-text">"I find social media to be a <span class="highlight-word" data-word="soul-sucking">soul-sucking</span> void..."</p>
                        <p class="mockup-uz-text">"Men ijtimoiy tarmoqlarni qalbni so'ruvchi bo'shliq deb bilaman..."</p>
                      </div>
                    </div>

                    <div class="mockup-player-controls-strip">
                      <button class="mockup-play-audio-btn" id="heroMockupPlayAudioBtn" aria-label="Audioni eshitish">
                        <i class="ph ph-play-fill" id="heroPlayIcon"></i>
                        <span id="heroPlayText">Audioni eshitish (0.75x)</span>
                      </button>
                      <div class="mockup-soundwave-bars" id="heroSoundwaveBars" aria-hidden="true">
                        <span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span>
                      </div>
                    </div>
                  </div>

                  <!-- Right: Interactive Dynamic Workstation -->
                  <div class="mockup-dictation-side">
                    <!-- Tab 1: Dictation Typing View -->
                    <div class="mockup-view-panel" id="mockupPanelDictation">
                      <div class="mockup-card-header">
                        <span class="mockup-badge"><i class="ph ph-keyboard"></i> Harfma-harf jonli diktant:</span>
                        <span class="mockup-speed"><i class="ph ph-gauge"></i> 0.75x Qulay</span>
                      </div>

                      <div class="mockup-words-stream" id="heroWordsStream">
                        <span class="mockup-word done">I</span>
                        <span class="mockup-word done">find</span>
                        <span class="mockup-word done">social</span>
                        <span class="mockup-word done">media</span>
                        <span class="mockup-word done">to</span>
                        <span class="mockup-word done">be</span>
                        <span class="mockup-word done">a</span>
                        <span class="mockup-word active" id="heroActiveWord">soul-sucking<span class="mockup-cursor"></span></span>
                        <span class="mockup-word pending" id="heroPendingWord">void</span>
                      </div>

                      <!-- Interactive Dictation Input Field -->
                      <div class="mockup-interactive-test-row">
                        <div class="mockup-input-wrapper">
                          <input type="text" class="mockup-test-input" id="heroTestInput" placeholder="Eshitgan so'zingizni yozing..." autocomplete="off" spellcheck="false" />
                          <button class="mockup-input-check-btn" id="heroTestInputBtn" title="Kiritish">
                            <i class="ph ph-arrow-right"></i>
                          </button>
                        </div>
                        <span class="mockup-feedback-chip" id="heroTestFeedback">
                          <i class="ph ph-info"></i> Klaviaturada yozing yoki so'zni tanlang
                        </span>
                      </div>

                      <div class="mockup-reward-row">
                        <div class="mockup-metric accuracy">
                          <i class="ph ph-target"></i> 98% Aniqlik
                        </div>
                        <div class="mockup-metric wpm">
                          <i class="ph ph-lightning"></i> 48 WPM
                        </div>
                        <div class="mockup-metric xp" id="heroMetricXp">
                          <i class="ph ph-star-fill"></i> +35 XP
                        </div>
                      </div>
                    </div>

                    <!-- Tab 2: AI Shadowing View -->
                    <div class="mockup-view-panel" id="mockupPanelShadowing" style="display: none;">
                      <div class="mockup-card-header">
                        <span class="mockup-badge"><i class="ph ph-microphone-stage"></i> Ovoz to'lqinlarini taqqoslash</span>
                        <span class="mockup-speed accent-green"><i class="ph ph-check-circle"></i> Mos kelish: 96%</span>
                      </div>

                      <div class="shadowing-waveform-container">
                        <div class="waveform-lane">
                          <span class="lane-label">Aktyor ovozi:</span>
                          <div class="lane-bars actor-bars">
                            <span class="wb" style="height: 40%"></span><span class="wb" style="height: 70%"></span><span class="wb" style="height: 95%"></span><span class="wb" style="height: 60%"></span><span class="wb" style="height: 80%"></span><span class="wb" style="height: 50%"></span><span class="wb" style="height: 30%"></span>
                          </div>
                        </div>
                        <div class="waveform-lane">
                          <span class="lane-label">Sizning ovozingiz:</span>
                          <div class="lane-bars user-bars">
                            <span class="wb match" style="height: 38%"></span><span class="wb match" style="height: 68%"></span><span class="wb match" style="height: 92%"></span><span class="wb match" style="height: 64%"></span><span class="wb match" style="height: 78%"></span><span class="wb match" style="height: 48%"></span><span class="wb match" style="height: 32%"></span>
                          </div>
                        </div>
                      </div>

                      <div class="shadowing-verdict-box">
                        <div class="verdict-icon"><i class="ph ph-check-circle-fill"></i></div>
                        <div class="verdict-meta">
                          <strong>A'lo darajadagi intonatsiya!</strong>
                          <p>Urg'u 'soul-sucking' so'ziga to'g'ri qo'yildi. Native speakerga 96% o'xshashlik.</p>
                        </div>
                      </div>
                    </div>

                    <!-- Tab 3: Vocab Popover View -->
                    <div class="mockup-view-panel" id="mockupPanelVocab" style="display: none;">
                      <div class="mockup-card-header">
                        <span class="mockup-badge"><i class="ph ph-bookmark-simple"></i> Bir bosishda tarjima & fleshkarta</span>
                        <span class="mockup-speed"><i class="ph ph-translate"></i> O'zbekcha</span>
                      </div>

                      <div class="mockup-vocab-card-preview">
                        <div class="vocab-preview-top">
                          <h4 class="vocab-preview-word">soul-sucking</h4>
                          <span class="vocab-preview-phonetic">/ˈsoʊlˌsʌk.ɪŋ/</span>
                          <span class="vocab-pos-badge">sifat (adj)</span>
                        </div>
                        <p class="vocab-preview-uz">Qalbni so'ruvchi, odamni behuda charchatadigan, bo'shliqqa tortuvchi</p>
                        <p class="vocab-preview-ex">"I find social media to be a <u>soul-sucking</u> void."</p>
                        <div class="vocab-preview-actions">
                          <button class="vocab-save-preview-btn"><i class="ph ph-bookmark-simple-fill"></i> Shaxsiy lug'atga saqlangan</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Cinema Marquee Reel Section (Infinite Continuous Stream) -->
        <section class="landing-marquee-section" aria-label="Ommabop filmlar lentasi">
          <div class="marquee-header">
            <span class="marquee-header-pill"><i class="ph-fill ph-film-slate"></i> KUTUBXONAMIZDAGI SARA KINOLAR</span>
            <h3 class="marquee-header-title">Sevimli aktyorlaringiz talaffuzida o'rganing</h3>
          </div>
          <div class="marquee-track-wrapper">
            <div class="marquee-track">
              ${marqueeHtml}
            </div>
          </div>
        </section>

        <!-- Interactive Feature Showcase (Deep-Dive Tabs) -->
        <section class="landing-section" id="features">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-sparkle-fill"></i> Inqilobiy Metodika</div>
            <h2 class="landing-section-title">Ingliz tili quloqqa qanday singadi?</h2>
            <p class="landing-section-desc">
              Kino va seriallar yordamida eshitib tushunishni o'stirish uchun maxsus ishlab chiqilgan 4 bosqichli chuqur mashg'ulot tizimi.
            </p>
          </div>

          <!-- Feature Tab Navigation -->
          <div class="feature-tabs-nav" role="tablist">
            <button class="feature-tab-btn active" data-feature-tab="dictation" role="tab" aria-selected="true">
              <i class="ph ph-keyboard"></i>
              <span>Harfma-harf Diktant</span>
            </button>
            <button class="feature-tab-btn" data-feature-tab="shadowing" role="tab" aria-selected="false">
              <i class="ph ph-microphone-stage"></i>
              <span>AI Shadowing</span>
            </button>
            <button class="feature-tab-btn" data-feature-tab="vocab" role="tab" aria-selected="false">
              <i class="ph ph-bookmark-simple"></i>
              <span>1-Bosishda Lug'at</span>
            </button>
            <button class="feature-tab-btn" data-feature-tab="speed" role="tab" aria-selected="false">
              <i class="ph ph-gauge"></i>
              <span>Sekinlashtirish & Aksent</span>
            </button>
          </div>

          <!-- Feature Tab Panels -->
          <div class="feature-tab-content-wrap">
            <!-- Panel 1: Dictation -->
            <div class="feature-tab-panel active" id="featurePanel-dictation">
              <div class="feature-showcase-grid">
                <div class="feature-showcase-info">
                  <div class="feature-number-pill">01 / Diktant Metodikasi</div>
                  <h3 class="feature-showcase-title">Quloqni har bir tovushni ajratishga majbur qiling</h3>
                  <p class="feature-showcase-desc">
                    Oddiy kinoni tomosha qilganda inson miyasi ko'pincha so'zlarni o'tkazib yuboradi. Harfma-harf diktantda esa siz har bir replikani to'liq terib chiqmaguningizcha keyingi sahnaga o'tmaysiz. Bu orqali <strong>chala eshitish sindromi</strong> butunlay yo'qoladi.
                  </p>
                  <ul class="feature-perks-list">
                    <li><i class="ph ph-check-circle-fill"></i> Real vaqtda harflar to'g'riligini tekshirish</li>
                    <li><i class="ph ph-check-circle-fill"></i> Qiyin birikmalar (wanna, gonna, could've) bo'yicha maxsus mikro-trening</li>
                    <li><i class="ph ph-check-circle-fill"></i> Qulay tezkor klaviatura tugmalari (Space: qayta tinglash, Tab: maslahat)</li>
                  </ul>
                </div>
                <div class="feature-showcase-card">
                  <div class="f-card-glow orange"></div>
                  <div class="f-card-inner">
                    <div class="f-card-chip"><i class="ph ph-waveform"></i> Jonli tekshiruv</div>
                    <div class="f-dictation-sample">
                      <div class="f-audio-bar">
                        <i class="ph ph-speaker-high"></i>
                        <span>"I'm gonna make him an offer he can't refuse."</span>
                      </div>
                      <div class="f-letters-row">
                        <span class="f-char correct">I</span>
                        <span class="f-char correct">'</span>
                        <span class="f-char correct">m</span>
                        <span class="f-space"> </span>
                        <span class="f-char correct">g</span>
                        <span class="f-char correct">o</span>
                        <span class="f-char correct">n</span>
                        <span class="f-char correct">n</span>
                        <span class="f-char correct">a</span>
                        <span class="f-space"> </span>
                        <span class="f-char active">m<span class="f-cursor"></span></span>
                        <span class="f-char pending">a</span>
                        <span class="f-char pending">k</span>
                        <span class="f-char pending">e</span>
                      </div>
                      <div class="f-card-footer-stats">
                        <span><i class="ph ph-fire-fill"></i> 14 ta to'g'ri ketma-ketlik</span>
                        <span class="xp-badge">+20 XP</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Panel 2: Shadowing -->
            <div class="feature-tab-panel" id="featurePanel-shadowing">
              <div class="feature-showcase-grid">
                <div class="feature-showcase-info">
                  <div class="feature-number-pill">02 / AI Shadowing</div>
                  <h3 class="feature-showcase-title">Aktyor bilan birga gapiring, AI baholaydi</h3>
                  <p class="feature-showcase-desc">
                    Eshitish qobiliyati talaffuz bilan chambarchas bog'liq. O'zingiz to'g'ri aytishni o'rgangan so'zni eshitganda zumda ilg'ab olasiz. Sun'iy intellekt mikrofonga aytgan har bir so'zingizni aktyor ovozi bilan qiyoslaydi.
                  </p>
                  <ul class="feature-perks-list">
                    <li><i class="ph ph-check-circle-fill"></i> Intonatsiya, urg'u va tovushlar ravonligi bo'yicha foizli baho</li>
                    <li><i class="ph ph-check-circle-fill"></i> Noto'g'ri aytilgan so'zlarni qizil rangda ko'rsatish</li>
                    <li><i class="ph ph-check-circle-fill"></i> Xavfsiz: ovozingiz faqat brauzerda qayta ishlanadi</li>
                  </ul>
                </div>
                <div class="feature-showcase-card">
                  <div class="f-card-glow purple"></div>
                  <div class="f-card-inner">
                    <div class="f-card-chip purple"><i class="ph ph-microphone-stage-fill"></i> AI Voice Comparator</div>
                    <div class="f-shadowing-sample">
                      <div class="f-voice-circle">
                        <i class="ph ph-microphone"></i>
                        <span class="voice-ripple r1"></span>
                        <span class="voice-ripple r2"></span>
                      </div>
                      <div class="f-score-counter">
                        <span class="f-big-score">96%</span>
                        <span class="f-score-label">Aktyor bilan o'xshashlik</span>
                      </div>
                      <div class="f-feedback-tags">
                        <span class="f-tag good"><i class="ph ph-check"></i> Urg'u: A'lo</span>
                        <span class="f-tag good"><i class="ph ph-check"></i> Ravonlik: 98%</span>
                        <span class="f-tag tip"><i class="ph ph-lightbulb"></i> 'void' unlisini cho'zing</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Panel 3: Vocab -->
            <div class="feature-tab-panel" id="featurePanel-vocab">
              <div class="feature-showcase-grid">
                <div class="feature-showcase-info">
                  <div class="feature-number-pill">03 / Kontekstual Lug'at</div>
                  <h3 class="feature-showcase-title">Notanish so'zlarni film ichida eslab qoling</h3>
                  <p class="feature-showcase-desc">
                    Lug'atdan qidirishga vaqt sarflamang. Film subtitridagi har qanday so'zni bitta bosish orqali o'zbekcha tarjimasi, kontekstdagi ma'nosi va ovozli talaffuzini ko'ring hamda fleshkartalaringizga bir zumda qo'shing.
                  </p>
                  <ul class="feature-perks-list">
                    <li><i class="ph ph-check-circle-fill"></i> So'zlarning kinodagi jonli kontekstida berilishi</li>
                    <li><i class="ph ph-check-circle-fill"></i> Intervalli takrorlash (Spaced Repetition) tizimiga integratsiya</li>
                    <li><i class="ph ph-check-circle-fill"></i> Istalgan qurilmadan kirilganda sinxronlash</li>
                  </ul>
                </div>
                <div class="feature-showcase-card">
                  <div class="f-card-glow blue"></div>
                  <div class="f-card-inner">
                    <div class="f-card-chip blue"><i class="ph ph-bookmark-simple-fill"></i> 1-Klik Lug'at</div>
                    <div class="f-vocab-card-sample">
                      <div class="vocab-bubble-header">
                        <span class="v-word">inevitable</span>
                        <span class="v-trans">/ɪnˈev.ə.tə.bəl/</span>
                      </div>
                      <p class="v-meaning">Muqarrar, qochib qutulib bo'lmaydigan, albatta yuz beradigan</p>
                      <div class="v-context-box">
                        <i class="ph ph-quotes"></i> "I am inevitable." — Thanos (Avengers)
                      </div>
                      <button class="v-add-btn"><i class="ph ph-check-bold"></i> Fleshkartaga qo'shildi</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Panel 4: Speed -->
            <div class="feature-tab-panel" id="featurePanel-speed">
              <div class="feature-showcase-grid">
                <div class="feature-showcase-info">
                  <div class="feature-number-pill">04 / Tezlik & Aksent</div>
                  <h3 class="feature-showcase-title">Tez aytilgan replikalarni ohangi buzilmasdan sekinlashtiring</h3>
                  <p class="feature-showcase-desc">
                    Aktyorlar juda tez gapirganda, 0.5x yoki 0.75x sekinlashtirish funksiyasi ovoz sifatini va balandligini (pitch) saqlagan holda sekinlashtiradi. Shuningdek Amerika va Britaniya aksentlari bo'yicha alohida filtrlash imkoniyati mavjud.
                  </p>
                  <ul class="feature-perks-list">
                    <li><i class="ph ph-check-circle-fill"></i> Tabiiy pitch bilan 0.5x, 0.75x va 1.0x sekinlashtirish</li>
                    <li><i class="ph ph-check-circle-fill"></i> 🇺🇸 Amerika va 🇬🇧 Britaniya aksentlarini alohida ajratish</li>
                    <li><i class="ph ph-check-circle-fill"></i> Har bir qahramonning nutq tempiga moslashuvchan pleyer</li>
                  </ul>
                </div>
                <div class="feature-showcase-card">
                  <div class="f-card-glow green"></div>
                  <div class="f-card-inner">
                    <div class="f-card-chip green"><i class="ph ph-gauge-fill"></i> Dynamic Pitch Preserver</div>
                    <div class="f-speed-sample">
                      <div class="speed-selector-row">
                        <span class="speed-opt">0.5x</span>
                        <span class="speed-opt active">0.75x</span>
                        <span class="speed-opt">1.0x</span>
                      </div>
                      <div class="accent-selector-row">
                        <span class="accent-opt active">🇺🇸 American (Natural)</span>
                        <span class="accent-opt">🇬🇧 British (RP)</span>
                      </div>
                      <div class="speed-wave-visual">
                        <span class="wave-line"></span>
                      </div>
                      <p class="speed-caption">Ovoz tembri tabiiy saqlanadi, robotik jarang yo'q</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- "Nega Tinglov?" Comparison Matrix Section -->
        <section class="landing-section" id="comparison">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-scales-fill"></i> Farqni his eting</div>
            <h2 class="landing-section-title">Nega an'anaviy usullar listeningda ish bermaydi?</h2>
            <p class="landing-section-desc">
              Kitoblardagi sun'iy audio yozuvlar va haqiqiy kino tili o'rtasidagi tafovutni Tinglov qanday hal qilishini ko'ring.
            </p>
          </div>

          <div class="comparison-grid">
            <!-- Left: Old traditional way -->
            <div class="comparison-card old-way">
              <div class="comp-card-badge red">
                <i class="ph ph-x-circle-fill"></i> An'anaviy usul
              </div>
              <h3 class="comp-card-title">Zerikarli darsliklar va sun'iy audiolarni eshitish</h3>
              <ul class="comp-list">
                <li><i class="ph ph-x"></i> <strong>Sun'iy, o'ta sekin diktor tili:</strong> Hayotda va kinoda hech kim bunday gapirmaydi</li>
                <li><i class="ph ph-x"></i> <strong>Passiv tinglash:</strong> Eshitib o'tirasiz, ammo miya so'zlarni tahlil qilmay chalg'iydi</li>
                <li><i class="ph ph-x"></i> <strong>Bir xil qoliplar:</strong> Qiziqish tez so'nadi va 2 haftada tashlab yuboriladi</li>
                <li><i class="ph ph-x"></i> <strong>Talaffuz nazoratsiz:</strong> So'zni to'g'ri aytyapsizmi yoki yo'q — hech kim tekshirmaydi</li>
              </ul>
            </div>

            <!-- Right: The Tinglov way -->
            <div class="comparison-card new-way">
              <div class="comp-card-badge green">
                <i class="ph ph-sparkle-fill"></i> Tinglov usuli
              </div>
              <h3 class="comp-card-title">Sevimli aktyorlar orqali faol harfma-harf diktant</h3>
              <ul class="comp-list">
                <li><i class="ph ph-check-circle-fill"></i> <strong>Haqiqiy jonli nutq:</strong> Wednesday, Interstellar, Marvel aktyorlarining tabiiy talaffuzi</li>
                <li><i class="ph ph-check-circle-fill"></i> <strong>Faol qatnashuv:</strong> Har bir so'zni o'zingiz yozasiz, quloq 100% diqqatda bo'ladi</li>
                <li><i class="ph ph-check-circle-fill"></i> <strong>O'yinlashtirilgan odat:</strong> Kunlik Streak, XP va do'stlar bellashuvi bilan zavq olasiz</li>
                <li><i class="ph ph-check-circle-fill"></i> <strong>AI Ovoz tahlili:</strong> Sun'iy intellekt talaffuz va intonatsiyangizni bevosita to'g'rilaydi</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- How It Works Section -->
        <section class="landing-section landing-how-section" id="how-it-works">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-steps-fill"></i> 3 Oddiy qadam</div>
            <h2 class="landing-section-title">Tinglov qanday ishlaydi?</h2>
            <p class="landing-section-desc">
              Kuniga atigi 15 daqiqa ajratib, 1 oyda filmlarni subtitrsiz tushunish darajasiga chiqing.
            </p>
          </div>

          <div class="landing-steps-container">
            <div class="landing-step-item">
              <div class="step-number">01</div>
              <div class="step-content">
                <div class="step-icon"><i class="ph ph-film-strip-fill"></i></div>
                <h3 class="step-title">Film va darajangizni tanlang</h3>
                <p class="step-desc">
                  Boshlang'ich (A1) darajadan ilg'or (C1) darajagacha — o'zingizga qiziq bo'lgan kino janrini yoki multfilmni tanlang.
                </p>
              </div>
            </div>

            <div class="landing-step-arrow"><i class="ph ph-arrow-right"></i></div>

            <div class="landing-step-item">
              <div class="step-number">02</div>
              <div class="step-content">
                <div class="step-icon"><i class="ph ph-headphones-fill"></i></div>
                <h3 class="step-title">Eshiting va diktantni yozing</h3>
                <p class="step-desc">
                  Aktyor gapirgan har bir so'zni klaviaturada tering. Xato qilsangiz, tizim to'g'ri talaffuzni qayta eshittiradi.
                </p>
              </div>
            </div>

            <div class="landing-step-arrow"><i class="ph ph-arrow-right"></i></div>

            <div class="landing-step-item">
              <div class="step-number">03</div>
              <div class="step-content">
                <div class="step-icon"><i class="ph ph-chart-line-up-fill"></i></div>
                <h3 class="step-title">AI bilan gapiring va o'sing</h3>
                <p class="step-desc">
                  Shadowing rejimida o'z ovozingizni sinang, yangi iboralarni lug'atga saqlang va doimiy o'sishni kuzatib boring.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Movie Catalog Showcase Section with Level Filter -->
        <section class="landing-section" id="catalog">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-television-fill"></i> Katta Kutubxona</div>
            <h2 class="landing-section-title">Kutubxonamizdagi sara filmlar</h2>
            <p class="landing-section-desc">
              O'zingizga mos darajadagi filmni tanlang va listeningni darhol boshlang.
            </p>
          </div>

          <!-- Catalog Filter Bar -->
          <div class="catalog-filters-bar" role="tablist">
            <button class="catalog-filter-btn active" data-filter="ALL" role="tab" aria-selected="true">Barchasi</button>
            <button class="catalog-filter-btn" data-filter="A1" role="tab" aria-selected="false">A1 (Boshlang'ich)</button>
            <button class="catalog-filter-btn" data-filter="A2" role="tab" aria-selected="false">A2 (Elementar)</button>
            <button class="catalog-filter-btn" data-filter="B1" role="tab" aria-selected="false">B1 (O'rta)</button>
            <button class="catalog-filter-btn" data-filter="B2" role="tab" aria-selected="false">B2 (Ilg'or-o'rta)</button>
            <button class="catalog-filter-btn" data-filter="C1" role="tab" aria-selected="false">C1 (Ekspert)</button>
          </div>

          ${continueCardHtml ? `
          <div class="landing-continue-wrapper">
            ${continueCardHtml}
          </div>
          ` : ''}

          <div class="landing-catalog-grid" id="landingCatalogGrid">
            ${allScenes.slice(0, 9).map((scene: Scene) => {
              const rawPoster = scene.coverImage || '/logo.png';
              const poster = sanitizeUrl(rawPoster) || '/logo.png';
              const safeTitle = escapeHtml(scene.title);
              const safeMovieName = escapeHtml(scene.movieName);
              const safeDifficulty = escapeHtml(scene.difficulty);
              const safeDuration = escapeHtml(scene.duration);
              const pos = lastPositions[scene.id];
              const isDone = stats.completedScenes.includes(scene.id);
              const realPct = isDone ? 100
                : (typeof pos === 'number' && scene.dialogues.length > 0
                  ? Math.min(100, Math.round(((pos + 1) / scene.dialogues.length) * 100))
                  : 0);
              const flag = scene.accent === 'British' ? '🇬🇧' : '🇺🇸';
              const accentLabel = scene.accent === 'British' ? 'British' : 'American';

              return `
                <div class="landing-movie-card" data-scene-id="${escapeHtml(scene.id)}" data-difficulty="${safeDifficulty.toUpperCase()}">
                  <div class="movie-card-thumb-wrap">
                    <img src="${poster}" alt="${safeTitle} posteri" class="movie-card-thumb" loading="lazy" />
                    <div class="movie-card-badges">
                      <span class="movie-level-badge level-${safeDifficulty.toLowerCase()}">${safeDifficulty}</span>
                      <span class="movie-accent-badge">${flag} ${accentLabel}</span>
                    </div>
                    <div class="movie-card-play-hover" aria-hidden="true">
                      <div class="play-hover-circle">
                        <i class="ph ph-play-fill"></i>
                      </div>
                    </div>
                  </div>
                  <div class="movie-card-meta">
                    <div class="movie-card-category-line">
                      <span class="movie-series-name">${safeMovieName}</span>
                      <span class="movie-rating-badge"><i class="ph-fill ph-star"></i> 4.9</span>
                    </div>
                    <h4 class="movie-card-title" title="${safeTitle}">${safeTitle}</h4>
                    <div class="movie-card-info">
                      <span><i class="ph ph-chat-circle-dots" aria-hidden="true"></i> ${scene.dialogues.length} ta dialog</span>
                      <span><i class="ph ph-clock" aria-hidden="true"></i> ${safeDuration}</span>
                    </div>
                    <div class="landing-movie-card-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${realPct}" aria-label="${safeTitle} progress">
                      <div class="landing-movie-card-progress-fill" style="width: ${realPct}%"></div>
                    </div>
                    <div class="movie-card-bottom-row">
                      <span class="landing-card-progress-caption">${realPct > 0 ? `${realPct}% yakunlangan` : 'Boshlanmagan'}</span>
                      <button class="movie-card-btn" data-scene-id="${escapeHtml(scene.id)}" aria-label="${safeTitle} darsini mashq qilish">
                        <i class="ph ph-play-fill" aria-hidden="true"></i> ${realPct > 0 ? 'Davom etish' : 'Boshlash'}
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="landing-catalog-cta">
            <button class="landing-btn-large landing-btn-secondary" id="landingCatalogAllBtn">
              <i class="ph ph-squares-four"></i> Barcha 100+ lavhalarni ko'rish (Dashboard)
            </button>
          </div>
        </section>

        <!-- FAQ Section -->
        <section class="landing-section" id="faq">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-question-fill"></i> FAQ</div>
            <h2 class="landing-section-title">Ko'p beriladigan savollar</h2>
            <p class="landing-section-desc">
              Platforma haqida eng muhim savollarga ochiq javoblar.
            </p>
          </div>

          <div class="landing-faq-accordion">
            <div class="faq-item active">
              <button class="faq-question" aria-expanded="true">
                <span><i class="ph ph-check-circle"></i> Tinglov orqali ingliz tilini o'rganish qanchalik samarali?</span>
                <i class="ph ph-caret-down faq-caret" aria-hidden="true"></i>
              </button>
              <div class="faq-answer">
                <p>
                  An'anaviy usullarda o'quvchilar asosan grammatika qoidalarini yodlashadi, ammo haqiqiy filmlarni ko'rganda tez aytilgan so'zlarni ajrata olishmaydi. Tinglov harfma-harf diktant va AI Shadowing orqali bevosita quloqni haqiqiy amerika va britaniya aktyorlari talaffuziga o'rgatadi. Bu esa listening tezligini 10 barobar oshiradi.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" aria-expanded="false">
                <span><i class="ph ph-gift"></i> Platformadan foydalanish bepulmi?</span>
                <i class="ph ph-caret-down faq-caret" aria-hidden="true"></i>
              </button>
              <div class="faq-answer">
                <p>
                  Ha! Tinglov platformasida ro'yxatdan o'tish va asosiy kino darslaridan foydalanish mutlaqo bepul. Istalgan vaqtda kirib, o'z listeningingizni bepul sinab ko'rishingiz mumkin.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" aria-expanded="false">
                <span><i class="ph ph-student"></i> Boshlang'ich (A1-A2) darajadagilar ham foydalana oladimi?</span>
                <i class="ph ph-caret-down faq-caret" aria-hidden="true"></i>
              </button>
              <div class="faq-answer">
                <p>
                  Albatta! Kutubxonamizda oson animatsion filmlar, multfilmlar va sekin talaffuz qilingan A1-A2 darajasidagi sahnalar alohida ajratilgan. Shuningdek, 0.5x sekinlashtirish va o'zbekcha parallel tarjima yordamida boshlang'ich o'quvchilar ham qiynalmasdan o'rganishadi.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" aria-expanded="false">
                <span><i class="ph ph-device-mobile"></i> Smartfon yoki planshetda ham ishlaydimi?</span>
                <i class="ph ph-caret-down faq-caret" aria-hidden="true"></i>
              </button>
              <div class="faq-answer">
                <p>
                  Ha, Tinglov barcha zamonaviy qurilmalarga (iOS, Android, planshet va kompyuter) moslashtirilgan. Kompyuterda klaviatura orqali qulay yozishingiz, smartfonda esa istalgan joyda mashq qilishingiz mumkin.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" aria-expanded="false">
                <span><i class="ph ph-rocket-launch"></i> Qanday qilib mashq qilishni boshlayman?</span>
                <i class="ph ph-caret-down faq-caret" aria-hidden="true"></i>
              </button>
              <div class="faq-answer">
                <p>
                  "Bepul boshlash" tugmasini bosing, Google hisobingiz yoki elektron pochtangiz orqali 10 soniyada ro'yxatdan o'ting va birinchi kinongizni tanlab diktantni bajaring!
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Final Cinematic Conversion Banner -->
        <section class="landing-cta-banner">
          <div class="cta-banner-inner">
            <div class="cta-banner-glow-mesh"></div>
            <div class="cta-banner-badge"><i class="ph-fill ph-lightning"></i> Listeningingizni yangi bosqichga olib chiqing</div>
            <h2 class="cta-banner-title">Ingliz tilida filmlarni subtitrsiz tushunishni bugunoq boshlang!</h2>
            <p class="cta-banner-desc">
              Minglab o'quvchilar safiga qo'shiling va bugunoq birinchi kino darsingizni muvaffaqiyatli yakunlang. Mutlaqo bepul.
            </p>
            <div class="cta-banner-actions">
              ${isAuth ? `
                <button class="landing-btn-large landing-btn-pulse" id="landingBottomDashboardBtn">
                  <i class="ph ph-squares-four-fill"></i> Dashboardga kirish
                </button>
              ` : `
                <button class="landing-btn-large landing-btn-pulse" id="landingBottomRegisterBtn">
                  <i class="ph ph-rocket-launch-fill"></i> Hoziroq bepul ro'yxatdan o'tish
                </button>
              `}
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="landing-footer">
          <div class="landing-footer-inner">
            <div class="footer-brand-col">
              <div class="landing-brand">
                <div class="brand-logo-glow-wrap">
                  <img src="/logo.png" alt="Tinglov Logo" class="landing-logo-img" />
                </div>
                <div class="landing-logo-text-group">
                  <span class="landing-logo-title">Ting<span>lov</span></span>
                  <span class="landing-domain-badge">PRO</span>
                </div>
              </div>
              <p class="footer-brand-desc">
                Kino va seriallar orqali ingliz tilini eshitib tushunishni o'rgatuvchi zamonaviy interaktiv listening platformasi.
              </p>
              <div class="footer-socials">
                <a href="https://t.me/tinglov" target="_blank" rel="noopener" class="social-link" title="Telegram" aria-label="Telegram kanalimiz"><i class="ph ph-telegram-logo" aria-hidden="true"></i></a>
                <a href="https://instagram.com" target="_blank" rel="noopener" class="social-link" title="Instagram" aria-label="Instagram sahifamiz"><i class="ph ph-instagram-logo" aria-hidden="true"></i></a>
                <a href="https://youtube.com" target="_blank" rel="noopener" class="social-link" title="YouTube" aria-label="YouTube kanalimiz"><i class="ph ph-youtube-logo" aria-hidden="true"></i></a>
              </div>
            </div>

            <div class="footer-nav-col">
              <h4 class="footer-col-title">Platforma</h4>
              <button class="footer-link-btn" id="footerLinkDashboard">Dashboard</button>
              <button class="footer-link-btn" id="footerLinkLibrary">Kutubxona</button>
              <button class="footer-link-btn" id="footerLinkProfile">Profil</button>
              <button class="footer-link-btn" id="footerLinkSettings">Sozlamalar</button>
            </div>

            <div class="footer-nav-col">
              <h4 class="footer-col-title">Bo'limlar</h4>
              <a href="#features" class="footer-link-anchor">Imkoniyatlar</a>
              <a href="#how-it-works" class="footer-link-anchor">Metodika</a>
              <a href="#comparison" class="footer-link-anchor">Nega Tinglov?</a>
              <a href="#catalog" class="footer-link-anchor">Filmlar</a>
              <a href="#faq" class="footer-link-anchor">Savol-javob</a>
            </div>

            <div class="footer-nav-col">
              <h4 class="footer-col-title">Qonuniy</h4>
              <span class="footer-link-static">Foydalanish shartlari</span>
              <span class="footer-link-static">Maxfiylik siyosati</span>
              <span class="footer-link-static">Mualliflik huquqi</span>
            </div>
          </div>

          <div class="landing-footer-bottom">
            <p>&copy; 2026 Tinglov (tinglov.me). Barcha huquqlar himoyalangan.</p>
            <p class="footer-author-note">Made with ❤️ for English learners in Uzbekistan</p>
          </div>
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Brand click: scroll to top
    this.container.querySelector('#landingNavBrandBtn')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Navigation buttons
    this.container.querySelector('#landingNavDashboardBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });

    this.container.querySelector('#landingNavLoginBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenLogin();
    });

    this.container.querySelector('#landingNavRegisterBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenRegister();
    });

    // Hero buttons
    this.container.querySelector('#landingHeroDashboardBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });

    this.container.querySelector('#landingHeroRegisterBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenRegister();
    });

    this.container.querySelector('#landingHeroLoginBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenLogin();
    });

    // Catalog button
    this.container.querySelector('#landingCatalogAllBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });

    // Movie cards
    const movieCards = this.container.querySelectorAll<HTMLElement>('.landing-movie-card');
    movieCards.forEach((card) => {
      card.addEventListener('click', () => {
        const sceneId = card.dataset.sceneId;
        if (sceneId) {
          this.callbacks?.onOpenPractice(sceneId);
        } else {
          this.callbacks?.onOpenDashboard();
        }
      });
    });

    // Marquee movie cards
    this.container.querySelectorAll<HTMLElement>('.marquee-card').forEach((mCard) => {
      mCard.addEventListener('click', () => {
        const sceneId = mCard.dataset.sceneId;
        if (sceneId) {
          this.callbacks?.onOpenPractice(sceneId);
        } else {
          this.callbacks?.onOpenDashboard();
        }
      });
    });

    // Continue-learning hero card (real progress from lastPositions)
    this.container.querySelectorAll<HTMLElement>('[data-continue-scene-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = btn.dataset.continueSceneId;
        if (sceneId) {
          this.callbacks?.onOpenPractice(sceneId);
        }
      });
    });

    // Catalog Filter Buttons
    const filterBtns = this.container.querySelectorAll<HTMLButtonElement>('.catalog-filter-btn');
    filterBtns.forEach((fBtn) => {
      fBtn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        fBtn.classList.add('active');
        fBtn.setAttribute('aria-selected', 'true');

        const selectedFilter = fBtn.dataset.filter || 'ALL';
        movieCards.forEach((card) => {
          const cardDiff = (card.dataset.difficulty || '').toUpperCase();
          if (selectedFilter === 'ALL' || cardDiff === selectedFilter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Mockup Mode Tabs (Dictation, AI Shadowing, Vocab)
    const mockupModeTabs = this.container.querySelectorAll<HTMLButtonElement>('.mockup-mode-tab');
    mockupModeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        mockupModeTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        const mode = tab.dataset.mockupMode;
        const pDict = this.container.querySelector<HTMLElement>('#mockupPanelDictation');
        const pShad = this.container.querySelector<HTMLElement>('#mockupPanelShadowing');
        const pVoc = this.container.querySelector<HTMLElement>('#mockupPanelVocab');

        if (pDict) pDict.style.display = mode === 'dictation' ? 'block' : 'none';
        if (pShad) pShad.style.display = mode === 'shadowing' ? 'block' : 'none';
        if (pVoc) pVoc.style.display = mode === 'vocab' ? 'block' : 'none';
      });
    });

    // Hero Interactive Audio Button (plays sample via Web Speech or AudioContext tone)
    const playAudioBtn = this.container.querySelector<HTMLButtonElement>('#heroMockupPlayAudioBtn');
    playAudioBtn?.addEventListener('click', () => {
      this.playHeroAudioSample();
    });

    // Hero Interactive Dictation Field
    const heroInput = this.container.querySelector<HTMLInputElement>('#heroTestInput');
    const heroInputBtn = this.container.querySelector<HTMLButtonElement>('#heroTestInputBtn');
    const heroActiveWord = this.container.querySelector<HTMLElement>('#heroActiveWord');
    const heroPendingWord = this.container.querySelector<HTMLElement>('#heroPendingWord');
    const heroFeedback = this.container.querySelector<HTMLElement>('#heroTestFeedback');
    const heroXp = this.container.querySelector<HTMLElement>('#heroMetricXp');

    const handleWordSubmit = () => {
      if (!heroInput) return;
      const val = heroInput.value.trim().toLowerCase();
      if (val === 'void' || val === 'soul-sucking') {
        if (heroPendingWord) {
          heroPendingWord.classList.remove('pending');
          heroPendingWord.classList.add('done');
        }
        if (heroActiveWord) {
          heroActiveWord.classList.remove('active');
          heroActiveWord.classList.add('done');
          heroActiveWord.innerHTML = 'soul-sucking';
        }
        if (heroFeedback) {
          heroFeedback.innerHTML = '<i class="ph ph-check-circle-fill accent-green"></i> Ajoyib! 100% to\'g\'ri!';
          heroFeedback.classList.add('feedback-success');
        }
        if (heroXp) {
          heroXp.innerHTML = '<i class="ph ph-star-fill"></i> +50 XP (Dars yakunlandi)';
          heroXp.classList.add('xp-pulse');
        }
        heroInput.value = '';
        heroInput.placeholder = "Zo'r natija! Bepul boshlash uchun yuqoridagi tugmani bosing";
      } else if (val.length > 0) {
        if (heroFeedback) {
          heroFeedback.innerHTML = '<i class="ph ph-warning-circle-fill"></i> Deyarli to\'g\'ri! Qayta eshitib ko\'ring';
        }
      }
    };

    heroInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleWordSubmit();
      }
    });
    heroInputBtn?.addEventListener('click', () => {
      handleWordSubmit();
    });

    // Feature Deep-Dive Tabs
    const featureTabBtns = this.container.querySelectorAll<HTMLButtonElement>('.feature-tab-btn');
    featureTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        featureTabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const tabKey = btn.dataset.featureTab;
        const allPanels = this.container.querySelectorAll<HTMLElement>('.feature-tab-panel');
        allPanels.forEach(p => p.classList.remove('active'));

        const targetPanel = this.container.querySelector<HTMLElement>(`#featurePanel-${tabKey}`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });

    // FAQ Accordion toggles (keeps aria-expanded in sync for SR users)
    const faqItems = this.container.querySelectorAll<HTMLElement>('.faq-item');
    faqItems.forEach((item) => {
      const questionBtn = item.querySelector<HTMLElement>('.faq-question');
      questionBtn?.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(f => {
          f.classList.remove('active');
          f.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
        });
        if (!isActive) {
          item.classList.add('active');
          questionBtn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Bottom banner actions
    this.container.querySelector('#landingBottomDashboardBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });

    this.container.querySelector('#landingBottomRegisterBtn')?.addEventListener('click', () => {
      this.callbacks?.onOpenRegister();
    });

    // Footer links
    this.container.querySelector('#footerLinkDashboard')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });
    this.container.querySelector('#footerLinkLibrary')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });
    this.container.querySelector('#footerLinkProfile')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });
    this.container.querySelector('#footerLinkSettings')?.addEventListener('click', () => {
      this.callbacks?.onOpenDashboard();
    });

    // Smooth scroll for nav anchors
    this.container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId && targetId !== '#') {
          const targetEl = this.container.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  /**
   * Plays the sample sentence in the hero interactive mockup.
   * Leverages browser speechSynthesis if available with fallback to animated soundwaves.
   */
  private playHeroAudioSample(): void {
    const playBtn = this.container.querySelector<HTMLButtonElement>('#heroMockupPlayAudioBtn');
    const playIcon = this.container.querySelector<HTMLElement>('#heroPlayIcon');
    const playText = this.container.querySelector<HTMLElement>('#heroPlayText');
    const soundwaves = this.container.querySelector<HTMLElement>('#heroSoundwaveBars');

    if (this.isDemoAudioPlaying) return;
    this.isDemoAudioPlaying = true;

    if (playIcon) {
      playIcon.className = 'ph ph-speaker-high';
    }
    if (playText) {
      playText.textContent = 'Tinglanmoqda...';
    }
    if (soundwaves) {
      soundwaves.classList.add('playing');
    }

    const resetState = () => {
      this.isDemoAudioPlaying = false;
      if (playIcon) {
        playIcon.className = 'ph ph-play-fill';
      }
      if (playText) {
        playText.textContent = 'Audioni eshitish (0.75x)';
      }
      if (soundwaves) {
        soundwaves.classList.remove('playing');
      }
    };

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("I find social media to be a soul-sucking void.");
        utterance.lang = 'en-US';
        utterance.rate = 0.82;
        utterance.pitch = 0.95;
        utterance.onend = () => resetState();
        utterance.onerror = () => resetState();
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(resetState, 2500);
      }
    } catch {
      setTimeout(resetState, 2500);
    }
  }
}
