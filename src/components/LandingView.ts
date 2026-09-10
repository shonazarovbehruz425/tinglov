import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { Scene } from '../types/index';

export interface LandingViewCallbacks {
  onOpenDashboard: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenPractice: (sceneId: string) => void;
}

export class LandingView {
  private container: HTMLElement;
  private callbacks: LandingViewCallbacks | null = null;

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
    const featuredScenes = allScenes.slice(0, 6);

    const displayName = currentUser?.full_name || currentUser?.username || 'Foydalanuvchi';
    const userInitial = displayName[0].toUpperCase();
    const userName = displayName;

    const featuredScenesHtml = featuredScenes.map((scene: Scene) => {
      const poster = scene.coverImage || '/cartoons/snow_white_poster.jpg';
      return `
        <div class="landing-movie-card" data-scene-id="${scene.id}">
          <div class="movie-card-thumb-wrap">
            <img src="${poster}" alt="${scene.title}" class="movie-card-thumb" loading="lazy" />
            <span class="movie-level-badge level-${scene.difficulty.toLowerCase()}">${scene.difficulty}</span>
            <div class="movie-card-play-hover">
              <i class="ph ph-play-fill"></i>
            </div>
          </div>
          <div class="movie-card-meta">
            <h4 class="movie-card-title">${scene.title}</h4>
            <div class="movie-card-info">
              <span><i class="ph ph-chat-circle-dots"></i> ${scene.dialogues.length} ta dialog</span>
              <span><i class="ph ph-clock"></i> ${scene.duration}</span>
            </div>
            <button class="movie-card-btn" data-scene-id="${scene.id}">
              <i class="ph ph-play"></i> Mashq qilish
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="landing-page">
        <!-- Top Navigation -->
        <nav class="landing-navbar">
          <div class="landing-nav-inner">
            <div class="landing-brand" id="landingNavBrandBtn">
              <img src="/logo.png" alt="Tinglov Logo" class="landing-logo-img" />
              <div class="landing-logo-text-group">
                <span class="landing-logo-title">Ting<span>lov</span></span>
                <span class="landing-domain-badge">.me</span>
              </div>
            </div>

            <div class="landing-nav-links">
              <a href="#features" class="landing-nav-link">Imkoniyatlar</a>
              <a href="#how-it-works" class="landing-nav-link">Qanday ishlaydi?</a>
              <a href="#catalog" class="landing-nav-link">Filmlar</a>
              <a href="#faq" class="landing-nav-link">Savollar</a>
            </div>

            <div class="landing-nav-actions">
              ${isAuth ? `
                <div class="landing-user-preview">
                  <div class="landing-user-avatar">${userInitial}</div>
                  <span class="landing-user-name">${userName}</span>
                </div>
                <button class="landing-btn landing-btn-primary" id="landingNavDashboardBtn">
                  <i class="ph ph-squares-four"></i> Dashboard
                </button>
              ` : `
                <button class="landing-btn landing-btn-ghost" id="landingNavLoginBtn">
                  <i class="ph ph-sign-in"></i> Kirish
                </button>
                <button class="landing-btn landing-btn-primary" id="landingNavRegisterBtn">
                  <i class="ph ph-user-plus"></i> Boshlash
                </button>
              `}
            </div>
          </div>
        </nav>

        <!-- Hero Section -->
        <header class="landing-hero">
          <div class="landing-hero-bg-glow glow-1"></div>
          <div class="landing-hero-bg-glow glow-2"></div>

          <div class="landing-hero-content">
            <div class="landing-badge-pill">
              <span class="badge-flame">🔥</span>
              <span>O'zbekistondagi 1-raqamli interaktiv Listening platformasi</span>
            </div>

            <h1 class="landing-hero-title">
              Kino va seriallar orqali ingliz tilini eshitib tushunishni <span class="text-gradient-orange">10x tezlashtiring</span>
            </h1>

            <p class="landing-hero-subtitle">
              Subtitrsiz filmlarni tushunish endi oson. Sevimli aktyorlaringiz nutqini jonli diktant, AI Shadowing (talaffuz tahlili) va bir bosishda lug'at bilan qiziqarli o'rganing.
            </p>

            <div class="landing-hero-cta-row">
              ${isAuth ? `
                <button class="landing-btn-large landing-btn-pulse" id="landingHeroDashboardBtn">
                  <i class="ph-fill ph-play-circle"></i> Boshqaruv paneliga o'tish
                </button>
              ` : `
                <button class="landing-btn-large landing-btn-pulse" id="landingHeroRegisterBtn">
                  <i class="ph-fill ph-rocket-launch"></i> Hoziroq bepul boshlash
                </button>
                <button class="landing-btn-large landing-btn-secondary" id="landingHeroLoginBtn">
                  <i class="ph-fill ph-film-slate"></i> Platformaga kirish
                </button>
              `}
            </div>

            <!-- Trust / Stats Badges -->
            <div class="landing-stats-pills">
              <div class="landing-stat-item">
                <span class="stat-num">100+</span>
                <span class="stat-label">Kino & serial lavhalari</span>
              </div>
              <div class="landing-stat-divider"></div>
              <div class="landing-stat-item">
                <span class="stat-num">10,000+</span>
                <span class="stat-label">Real dialog iboralari</span>
              </div>
              <div class="landing-stat-divider"></div>
              <div class="landing-stat-item">
                <span class="stat-num">98%</span>
                <span class="stat-label">Eshitish tezligi oshgan</span>
              </div>
              <div class="landing-stat-divider"></div>
              <div class="landing-stat-item">
                <span class="stat-num">0 so'm</span>
                <span class="stat-label">Bepul boshlash</span>
              </div>
            </div>

            <!-- Interactive Cinema Mockup -->
            <div class="landing-mockup-wrapper">
              <div class="landing-mockup-window">
                <div class="landing-mockup-topbar">
                  <div class="mockup-dots">
                    <span class="mockup-dot red"></span>
                    <span class="mockup-dot yellow"></span>
                    <span class="mockup-dot green"></span>
                  </div>
                  <div class="mockup-title-bar">
                    <i class="ph ph-play-fill"></i> Wednesday — The Addams Family (A2-B1 Listening)
                  </div>
                  <div class="mockup-live-badge">
                    <span class="live-dot"></span> JONLI DIKTANT
                  </div>
                </div>

                <div class="landing-mockup-body">
                  <!-- Left: Cinema player preview -->
                  <div class="mockup-player-side">
                    <div class="mockup-video-preview">
                      <div class="mockup-video-overlay">
                        <div class="mockup-speaker-badge">
                          <i class="ph ph-user-sound"></i> Wednesday Addams
                        </div>
                        <div class="mockup-subtitle-box">
                          <p class="mockup-en-text">"I find social media to be a soul-sucking void..."</p>
                          <p class="mockup-uz-text">"Men ijtimoiy tarmoqlarni qalbni so'ruvchi bo'shliq deb bilaman..."</p>
                        </div>
                      </div>
                      <div class="mockup-soundwave-bars">
                        <span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span><span class="sw-bar"></span>
                      </div>
                    </div>
                  </div>

                  <!-- Right: Dictation typing interactive look -->
                  <div class="mockup-dictation-side">
                    <div class="mockup-card-header">
                      <span class="mockup-badge"><i class="ph ph-keyboard"></i> So'zlarni eshitib yozing</span>
                      <span class="mockup-speed"><i class="ph ph-gauge"></i> 0.75x / 1.0x</span>
                    </div>

                    <div class="mockup-words-stream">
                      <span class="mockup-word done">I</span>
                      <span class="mockup-word done">find</span>
                      <span class="mockup-word done">social</span>
                      <span class="mockup-word done">media</span>
                      <span class="mockup-word done">to</span>
                      <span class="mockup-word done">be</span>
                      <span class="mockup-word done">a</span>
                      <span class="mockup-word active">soul-sucking<span class="mockup-cursor"></span></span>
                      <span class="mockup-word pending">void</span>
                    </div>

                    <div class="mockup-reward-row">
                      <div class="mockup-metric accuracy">
                        <i class="ph ph-target"></i> 98% Aniqlik
                      </div>
                      <div class="mockup-metric wpm">
                        <i class="ph ph-lightning"></i> 42 WPM
                      </div>
                      <div class="mockup-metric xp">
                        <i class="ph ph-star-fill"></i> +35 XP
                      </div>
                    </div>

                    <div class="mockup-ai-badge">
                      <i class="ph ph-microphone-stage-fill"></i> AI Shadowing: Talaffuz baholandi (A'lo)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Feature Pillars Section -->
        <section class="landing-section" id="features">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-sparkle"></i> Imkoniyatlar</div>
            <h2 class="landing-section-title">Nega aynan Tinglov bilan o'rganish kerak?</h2>
            <p class="landing-section-desc">
              Zerikarli qoidalar va darsliklarni unuting. Jonli kino va seriallar tili orqali quloqni inglizcha nutqqa o'rgatishning eng samarali metodikasi.
            </p>
          </div>

          <div class="landing-features-grid">
            <div class="landing-feature-card">
              <div class="feature-icon-box bg-orange">
                <i class="ph-fill ph-film-slate"></i>
              </div>
              <h3 class="feature-title">Haqiqiy Cinema & Seriallar</h3>
              <p class="feature-desc">
                Wednesday, Interstellar, Harry Potter, Avengers va boshqa yuzlab sevimli filmlar aktyorlari talaffuzida listening qobiliyatingizni o'stiring.
              </p>
            </div>

            <div class="landing-feature-card">
              <div class="feature-icon-box bg-blue">
                <i class="ph-fill ph-keyboard"></i>
              </div>
              <h3 class="feature-title">Interaktiv Harfma-harf Diktant</h3>
              <p class="feature-desc">
                Har bir so'zni eshitib yozasiz. Tizim xatolarni real vaqtda ko'rsatib, tovushlarni bir-biridan aniq ajratib olishni o'rgatadi.
              </p>
            </div>

            <div class="landing-feature-card">
              <div class="feature-icon-box bg-purple">
                <i class="ph-fill ph-microphone"></i>
              </div>
              <h3 class="feature-title">AI Shadowing & Talaffuz</h3>
              <p class="feature-desc">
                Mikrofonga aktyor ortidan gapirib, sun'iy intellekt orqali talaffuzingiz, urg'u va intonatsiyangizni to'g'rilab oling.
              </p>
            </div>

            <div class="landing-feature-card">
              <div class="feature-icon-box bg-green">
                <i class="ph-fill ph-timer"></i>
              </div>
              <h3 class="feature-title">0.5x va 0.75x Sekinlashtirish</h3>
              <p class="feature-desc">
                Tez aytilgan, qiyin jumlalarni bitta tugma bilan sekinlashtirib, har bir tovushni aniq eshiting va tushunib oling.
              </p>
            </div>

            <div class="landing-feature-card">
              <div class="feature-icon-box bg-yellow">
                <i class="ph-fill ph-bookmark-simple"></i>
              </div>
              <h3 class="feature-title">Bir bosishda Shaxsiy Lug'at</h3>
              <p class="feature-desc">
                Notanish so'z ustiga bosing — zumda o'zbekcha tarjimasi chiqadi va shaxsiy fleshkartalaringizga qo'shiladi.
              </p>
            </div>

            <div class="landing-feature-card">
              <div class="feature-icon-box bg-red">
                <i class="ph-fill ph-fire"></i>
              </div>
              <h3 class="feature-title">Streak, XP va Reyting</h3>
              <p class="feature-desc">
                Kunlik odat shakllantiring. Har bir to'g'ri yozilgan gap uchun XP oling, do'stlaringiz bilan bellashing va yetakchi bo'ling.
              </p>
            </div>
          </div>
        </section>

        <!-- How It Works Section -->
        <section class="landing-section landing-how-section" id="how-it-works">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-steps"></i> 3 Oddiy qadam</div>
            <h2 class="landing-section-title">Tinglov qanday ishlaydi?</h2>
            <p class="landing-section-desc">
              Kuniga atigi 15 daqiqa ajratib, 1 oyda filmlarni subtitrsiz tushunish darajasiga chiqing.
            </p>
          </div>

          <div class="landing-steps-container">
            <div class="landing-step-item">
              <div class="step-number">01</div>
              <div class="step-content">
                <div class="step-icon"><i class="ph ph-film-strip"></i></div>
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
                <div class="step-icon"><i class="ph ph-headphones"></i></div>
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
                <div class="step-icon"><i class="ph ph-chart-line-up"></i></div>
                <h3 class="step-title">AI bilan gapiring va o'sing</h3>
                <p class="step-desc">
                  Shadowing rejimida o'z ovozingizni sinang, yangi iboralarni lug'atga saqlang va doimiy o'sishni kuzatib boring.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Movie Catalog Showcase Section -->
        <section class="landing-section" id="catalog">
          <div class="landing-section-header">
            <div class="landing-chip"><i class="ph ph-television"></i> Ommabop lavhalar</div>
            <h2 class="landing-section-title">Kutubxonamizdagi sara filmlar</h2>
            <p class="landing-section-desc">
              Disney, Marvel, Warner Bros va Netflix durdonalari orqali ingliz tilini o'rganishni boshlang.
            </p>
          </div>

          <div class="landing-catalog-grid">
            ${featuredScenesHtml}
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
            <div class="landing-chip"><i class="ph ph-question"></i> FAQ</div>
            <h2 class="landing-section-title">Ko'p beriladigan savollar</h2>
            <p class="landing-section-desc">
              Platforma haqida eng muhim savollarga javoblar.
            </p>
          </div>

          <div class="landing-faq-accordion">
            <div class="faq-item active">
              <button class="faq-question">
                <span>Tinglov orqali ingliz tilini o'rganish qanchalik samarali?</span>
                <i class="ph ph-caret-down faq-caret"></i>
              </button>
              <div class="faq-answer">
                <p>
                  An'anaviy usullarda o'quvchilar asosan grammatika qoidalarini yodlashadi, ammo haqiqiy filmlarni ko'rganda tez aytilgan so'zlarni ajrata olishmaydi. Tinglov harfma-harf diktant va AI Shadowing orqali bevosita quloqni haqiqiy amerika va britaniya aktyorlari talaffuziga o'rgatadi. Bu esa listening tezligini 10 barobar oshiradi.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question">
                <span>Platformadan foydalanish bepulmi?</span>
                <i class="ph ph-caret-down faq-caret"></i>
              </button>
              <div class="faq-answer">
                <p>
                  Ha! Tinglov platformasida ro'yxatdan o'tish va asosiy kino darslaridan foydalanish mutlaqo bepul. Istalgan vaqtda kirib, o'z listeningingizni sinab ko'rishingiz mumkin.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question">
                <span>Boshlang'ich (A1-A2) darajadagilar ham foydalana oladimi?</span>
                <i class="ph ph-caret-down faq-caret"></i>
              </button>
              <div class="faq-answer">
                <p>
                  Albatta! Kutubxonamizda oson animatsion filmlar, multfilmlar va sekin talaffuz qilingan A1-A2 darajasidagi sahnalar alohida ajratilgan. Shuningdek, 0.5x sekinlashtirish va o'zbekcha parallel tarjima yordamida boshlang'ich o'quvchilar ham qiynalmasdan o'rganishadi.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question">
                <span>Smartfon yoki planshetda ham ishlaydimi?</span>
                <i class="ph ph-caret-down faq-caret"></i>
              </button>
              <div class="faq-answer">
                <p>
                  Ha, Tinglov barcha zamonaviy qurilmalarga moslashtirilgan. Kompyuterda klaviatura orqali qulay yozishingiz, smartfonda esa istalgan joyda mashq qilishingiz mumkin.
                </p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question">
                <span>Qanday qilib mashq qilishni boshlayman?</span>
                <i class="ph ph-caret-down faq-caret"></i>
              </button>
              <div class="faq-answer">
                <p>
                  "Bepul boshlash" tugmasini bosing, Google hisobingiz yoki elektron pochtangiz orqali 10 soniyada ro'yxatdan o'ting va sevimli filmingizni tanlang!
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Final Conversion Banner -->
        <section class="landing-cta-banner">
          <div class="cta-banner-glow"></div>
          <div class="cta-banner-inner">
            <div class="cta-banner-badge"><i class="ph ph-lightning-fill"></i> Tinglov bilan listeningingizni o'stiring</div>
            <h2 class="cta-banner-title">Ingliz tilida filmlarni subtitrsiz tushunishni bugunoq boshlang!</h2>
            <p class="cta-banner-desc">
              Bugunoq ro'yxatdan o'ting va birinchi kino darsingizni muvaffaqiyatli yakunlang.
            </p>
            <div class="cta-banner-actions">
              ${isAuth ? `
                <button class="landing-btn-large landing-btn-pulse" id="landingBottomDashboardBtn">
                  <i class="ph ph-squares-four"></i> Dashboardga kirish
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
                <img src="/logo.png" alt="Tinglov Logo" class="landing-logo-img" />
                <div class="landing-logo-text-group">
                  <span class="landing-logo-title">Ting<span>lov</span></span>
                  <span class="landing-domain-badge">.me</span>
                </div>
              </div>
              <p class="footer-brand-desc">
                Kino va multfilmlar orqali ingliz tilini eshitib tushunishni o'rgatuvchi zamonaviy interaktiv platforma.
              </p>
              <div class="footer-socials">
                <a href="https://t.me/tinglov" target="_blank" class="social-link" title="Telegram"><i class="ph ph-telegram-logo"></i></a>
                <a href="https://instagram.com" target="_blank" class="social-link" title="Instagram"><i class="ph ph-instagram-logo"></i></a>
                <a href="https://youtube.com" target="_blank" class="social-link" title="YouTube"><i class="ph ph-youtube-logo"></i></a>
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
              <a href="#how-it-works" class="footer-link-anchor">Qanday ishlaydi?</a>
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
            <p class="footer-author-note">Made with ❤️ for English learners</p>
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

    // Catalog buttons
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

    // FAQ Accordion toggles
    const faqItems = this.container.querySelectorAll<HTMLElement>('.faq-item');
    faqItems.forEach((item) => {
      const questionBtn = item.querySelector('.faq-question');
      questionBtn?.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(f => f.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
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
}
