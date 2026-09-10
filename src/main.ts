import './style.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import '@phosphor-icons/web/fill';
import { Scene, DialogueSentence, ChallengePayload } from './types';
import { storageService } from './services/storageService';
import { speechService } from './services/speechService';
import { videoStreamService } from './services/videoStreamService';
import { StatsHeader } from './components/StatsHeader';
import { LevelSelector } from './components/LevelSelector';
import { AnimatedStage } from './components/AnimatedStage';
import { DictationInput } from './components/DictationInput';
import { VocabularyModal } from './components/VocabularyModal';
import { CustomSceneModal } from './components/CustomSceneModal';
import { YouTubeImportModal } from './components/YouTubeImportModal';
import { CompletionModal } from './components/CompletionModal';
import { ProfileModal } from './components/ProfileModal';
import { ShadowingModal } from './components/ShadowingModal';
import { FriendChallengeModal } from './components/FriendChallengeModal';
import { AuthModal } from './components/AuthModal';
import { AuthView } from './components/AuthView';
import { apiService } from './services/apiService';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { LandingView } from './components/LandingView';
import { AdminView } from './components/AdminView';
import { onboardingStepper } from './components/OnboardingStepper';
import { initCursorGlow } from './utils/cursorGlow';
import { isValidYouTubeVideoId } from './utils/sanitize';

type AppViewMode = 'landing' | 'library' | 'practice' | 'profile' | 'settings' | 'auth' | 'admin';

class MovieListenApp {
  private currentScene: Scene | null = null;
  private currentSentenceIndex: number = 0;
  private currentView: AppViewMode = 'landing';
  private sessionAccuracies: number[] = [];
  private sessionWpms: number[] = [];
  private sceneStartTime: number = Date.now();

  // UI Components
  private statsHeader!: StatsHeader;
  private levelSelector!: LevelSelector;
  private animatedStage!: AnimatedStage;
  private dictationInput!: DictationInput;
  private profileView!: ProfileView;
  private settingsView!: SettingsView;
  private authView!: AuthView;
  private landingView!: LandingView;
  private adminView!: AdminView;
  private vocabModal!: VocabularyModal;
  private customSceneModal!: CustomSceneModal;
  private youtubeImportModal!: YouTubeImportModal;
  private completionModal!: CompletionModal;
  private profileModal!: ProfileModal;
  private shadowingModal!: ShadowingModal;
  private friendChallengeModal!: FriendChallengeModal;
  private authModal!: AuthModal;

  constructor() {
    this.initDOM();
    this.initComponents();
    this.bindKeyboardShortcuts();
    this.initRouter();

    // Initialize cursor-position tracking glow for CTA buttons
    initCursorGlow();

    // Automatically introduce key buttons to first-time visitors once logged in
    setTimeout(() => {
      if (apiService.isAuthenticated() && onboardingStepper.shouldAutoOpen()) {
        onboardingStepper.open(1);
      }
    }, 450);

    // Register PWA Service Worker for complete offline support
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Service worker registration skipped/handled gracefully
        });
      });
    }
  }

  private initDOM(): void {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div id="statsHeaderContainer"></div>

      <main class="app-main-content">
        <div id="landingViewContainer" class="view-section" style="display: none;"></div>
        <div id="libraryViewContainer" class="view-section"></div>

        <div id="practiceViewContainer" class="view-section" style="display: none;">
          <div class="practice-main-grid">
            <!-- Left: Cinema Player and Description (Matching Image 1 Left) -->
            <div id="animatedStageContainer"></div>

            <!-- Right: Interactive Dictation & Curriculum (Matching Image 1 Right) -->
            <div id="dictationInputContainer"></div>
          </div>
        </div>

        <div id="profileViewContainer" class="view-section" style="display: none;"></div>
        <div id="settingsViewContainer" class="view-section" style="display: none;"></div>
        <div id="authViewContainer" class="view-section" style="display: none;"></div>
        <div id="adminViewContainer" class="view-section" style="display: none;"></div>
      </main>

      <!-- Modals Container -->
      <div id="vocabModalContainer"></div>
      <div id="customSceneModalContainer"></div>
      <div id="youtubeModalContainer"></div>
      <div id="completionModalContainer"></div>
      <div id="profileModalContainer"></div>
      <div id="shadowingModalContainer"></div>
      <div id="challengeModalContainer"></div>
      <div id="authModalContainer"></div>
    `;
  }

  private initComponents(): void {
    const landingContainer = document.getElementById('landingViewContainer')!;
    const headerContainer = document.getElementById('statsHeaderContainer')!;
    const libraryContainer = document.getElementById('libraryViewContainer')!;
    const stageContainer = document.getElementById('animatedStageContainer')!;
    const dictationContainer = document.getElementById('dictationInputContainer')!;
    const profileViewContainer = document.getElementById('profileViewContainer')!;
    const settingsViewContainer = document.getElementById('settingsViewContainer')!;
    const authViewContainer = document.getElementById('authViewContainer')!;
    const vocabContainer = document.getElementById('vocabModalContainer')!;
    const customContainer = document.getElementById('customSceneModalContainer')!;
    const youtubeContainer = document.getElementById('youtubeModalContainer')!;
    const completionContainer = document.getElementById('completionModalContainer')!;
    const profileContainer = document.getElementById('profileModalContainer')!;
    const shadowingContainer = document.getElementById('shadowingModalContainer')!;
    const authModalContainer = document.getElementById('authModalContainer')!;

    // 0. Landing View (Root tinglov.me)
    this.landingView = new LandingView(landingContainer);
    this.landingView.setCallbacks({
      onOpenDashboard: () => {
        if (this.checkAndEnforceAuth()) {
          this.showLibrary(true);
        }
      },
      onOpenLogin: () => {
        this.showAuthPage('login', true);
      },
      onOpenRegister: () => {
        this.showAuthPage('register', true);
      },
      onOpenPractice: (sceneId) => {
        if (this.checkAndEnforceAuth()) {
          const allScenes = storageService.getAllScenes();
          const targetScene = allScenes.find(s => s.id === sceneId);
          if (targetScene) {
            this.startScene(targetScene, 0, true);
          } else {
            this.showLibrary(true);
          }
        }
      }
    });

    // 1. Stats Header
    this.statsHeader = new StatsHeader(headerContainer);
    this.statsHeader.setCallbacks({
      onOpenVocab: () => this.vocabModal.open(),
      onOpenCustomScene: () => this.customSceneModal.open(),
      onOpenLibrary: () => this.showLibrary(),
      onOpenProfile: () => this.showProfilePage(),
      onOpenSettings: () => this.showSettingsPage(),
      onOpenTour: () => onboardingStepper.open(1),
      onLanguageChange: () => this.handleLanguageChanged(),
      onSelectSceneAndSentence: (scene, sentenceIndex) => {
        this.startScene(scene, sentenceIndex);
      },
      onSearchQueryChange: (query) => {
        if (this.currentView === 'library') {
          this.levelSelector.setSearchQuery(query);
        }
      },
      onOpenAuth: (tab) => {
        this.showAuthPage(tab);
      },
      onSignOut: () => {
        apiService.logout();
        this.showAuthPage('login');
      }
    });

    // 2. Level / Scene Library
    this.levelSelector = new LevelSelector(libraryContainer);
    this.levelSelector.setCallbacks({
      onSelectScene: (scene, initialIdx) => {
        if (this.checkAndEnforceAuth()) {
          this.startScene(scene, initialIdx || 0);
        }
      },
      onAddCustomScene: () => {
        if (this.checkAndEnforceAuth()) {
          this.customSceneModal.open();
        }
      },
      onOpenYouTubeImport: () => {
        if (this.checkAndEnforceAuth()) {
          this.youtubeImportModal.open();
        }
      },
      onOpenProfile: () => {
        if (this.checkAndEnforceAuth()) {
          this.showProfilePage();
        }
      }
    });

    // 3. Cinema Animated Stage
    this.animatedStage = new AnimatedStage(stageContainer);
    this.animatedStage.setCallbacks({
      onReplayRequest: () => this.playCurrentDialogue(),
      onPrevSentence: () => this.goToPrevSentence(),
      onNextSentence: () => this.goToNextSentence(),
      onSeekToSentence: (idx) => this.jumpToSentence(idx),
      onSpeedChange: (speed) => speechService.setSpeed(speed),
      onBackToLibrary: () => this.showLibrary(),
      onChallengeRequest: () => {
        if (this.currentScene) {
          const highscores = storageService.getSceneHighScores(this.currentScene.id);
          const topAccuracy = highscores.length > 0 ? highscores[0].accuracy : 98;
          const topWpm = highscores.length > 0 ? highscores[0].wpm : 55;
          this.friendChallengeModal.open(this.currentScene, topAccuracy, topWpm);
        }
      }
    });

    // 4. Dictation Input Box
    this.dictationInput = new DictationInput(dictationContainer);
    this.dictationInput.setCallbacks({
      onComplete: (accuracy, wpm, hintsUsed) => this.handleSentenceCompleted(accuracy, wpm, hintsUsed),
      onHint: () => this.statsHeader.update(),
      onReveal: () => {
        this.animatedStage.setSubtitleRevealed(true);
        this.dictationInput.setSubtitleRevealed(true);
      },
      onSkip: () => this.goToNextSentence(),
      onShadowing: () => this.openShadowingMode(),
      onSelectDialogue: (idx) => this.jumpToSentence(idx),
      onReplayRequest: () => {
        this.playCurrentDialogue();
        this.dictationInput.focusInput();
      },
      onSlowDownRequest: () => {
        const newSpeed = this.animatedStage.cycleSlowDownSpeed();
        this.showSpeedToast(newSpeed);
        this.playCurrentDialogue();
        this.dictationInput.focusInput();
      },
      onSubtitleModeChange: (mode) => {
        this.animatedStage.setSubtitleMode(mode);
      }
    });

    // 5. Dedicated Profile Page View
    this.profileView = new ProfileView(profileViewContainer);
    this.profileView.setCallbacks({
      onBackToLibrary: () => this.showLibrary(),
      onOpenSettings: () => this.showSettingsPage(),
      onOpenVocab: () => this.vocabModal.open()
    });

    // 6. Dedicated Settings Page View
    this.settingsView = new SettingsView(settingsViewContainer);
    this.settingsView.setCallbacks({
      onBackToLibrary: () => this.showLibrary(),
      onOpenProfile: () => this.showProfilePage(),
      onSettingsChanged: () => this.handleLanguageChanged(true),
      onThemeOrSoundChanged: () => this.statsHeader.update()
    });

    // 7. Vocabulary Modal
    this.vocabModal = new VocabularyModal(vocabContainer);
    this.vocabModal.setOnClose(() => this.statsHeader.update());

    // 8. Custom Scene Modal
    this.customSceneModal = new CustomSceneModal(customContainer);
    this.customSceneModal.setCallbacks({
      onClose: () => this.statsHeader.update(),
      onCreated: (newScene) => this.startScene(newScene)
    });

    // 9. YouTube Import Modal
    this.youtubeImportModal = new YouTubeImportModal(youtubeContainer);
    this.youtubeImportModal.setCallbacks({
      onClose: () => this.statsHeader.update(),
      onLessonCreated: (newScene) => this.startScene(newScene)
    });

    // 10. Completion Modal
    this.completionModal = new CompletionModal(completionContainer);
    this.completionModal.setCallbacks({
      onNextScene: () => this.loadNextSceneInLibrary(),
      onRestartScene: () => this.startScene(this.currentScene!),
      onLibrary: () => this.showLibrary(),
      onChallengeFriend: (scene, stats) => {
        this.friendChallengeModal.open(scene, stats.accuracy, stats.wpm);
      }
    });

    // 10. Shadowing Pronunciation Modal
    this.shadowingModal = new ShadowingModal(shadowingContainer);
    this.shadowingModal.setCallbacks({
      onClose: () => {
        this.dictationInput.focusInput();
      },
      onPassed: (score) => {
        const bonusXp = Math.round(score / 5);
        storageService.addXP(bonusXp);
        this.statsHeader.update();
      }
    });

    // 11. User Profile Modal
    this.profileModal = new ProfileModal(profileContainer);
    this.profileModal.setCallbacks({
      onOpenVocab: () => this.vocabModal.open(),
      onProfileUpdated: () => this.handleLanguageChanged()
    });

    // 12. Friend Challenge Modal
    const challengeContainer = document.getElementById('challengeModalContainer')!;
    this.friendChallengeModal = new FriendChallengeModal(challengeContainer);

    // 13. Dedicated Auth Page (Login & Register)
    this.authView = new AuthView(authViewContainer);
    this.authView.setOnAuthSuccess(() => {
      this.showLibrary();
      this.statsHeader.update();
    });

    // 14. Real Auth Modal (for in-app popups if needed)
    this.authModal = new AuthModal(authModalContainer);
    this.authModal.setOnAuthSuccess(() => {
      this.statsHeader.update();
      if (this.currentView === 'profile') {
        this.profileView.render();
      }
    });

    // 15. Dedicated Admin Panel View
    const adminContainer = document.getElementById('adminViewContainer')!;
    this.adminView = new AdminView(adminContainer);
    this.adminView.setCallbacks({
      onNavigateHome: () => this.showLandingPage(true),
    });

    // Warm up admin config and fetch global custom scenes from server
    apiService.fetchAdminConfig().catch(() => {});
    apiService.getPublicScenes().then((serverScenes) => {
      if (serverScenes && serverScenes.length > 0) {
        const mappedScenes: Scene[] = [];
        serverScenes.forEach((s: any) => {
          try {
            const parsedDialogues = typeof s.dialogues_json === 'string' ? JSON.parse(s.dialogues_json) : (s.dialogues || []);
            const dialogues: DialogueSentence[] = parsedDialogues.map((d: any, idx: number) => ({
              id: d.id || `line_${idx + 1}`,
              character: d.character || 'Qahramon',
              characterAvatar: '🎬',
              startTime: Number(d.startTime) || 0,
              endTime: Number(d.endTime) || (Number(d.startTime) || 0) + 3,
              text: d.text || '',
              cleanText: (d.text || '').replace(/[^\w\s]/g, '').toLowerCase().trim(),
              uzbekTranslation: d.uzbekTranslation || d.translation || '',
              wordDictionary: d.wordDictionary || {},
            }));

            mappedScenes.push({
              id: s.id,
              title: s.title,
              movieName: s.title,
              coverEmoji: '🎬',
              coverImage: s.poster_url || undefined,
              category: (s.category === 'Animation' ? 'Cartoon' : s.category === 'Anime' ? 'Anime' : 'Cinema') as any,
              difficulty: (s.difficulty?.toLowerCase() || 'intermediate') as any,
              duration: '1:30',
              accent: 'Neutral',
              videoUrl: s.video_url,
              dialogues,
            });
          } catch {
            // Ignored
          }
        });
        if (mappedScenes.length > 0) {
          storageService.mergeServerScenes(mappedScenes);
          if (this.currentView === 'library') {
            this.levelSelector.render();
          }
        }
      }
    }).catch(() => {});

    // React to auth state changes (e.g. sign out or Google OAuth sign in)
    apiService.onAuthChange((user) => {
      if (!user) {
        // If user signed out while in protected app views, return to landing page
        if (this.currentView !== 'landing' && this.currentView !== 'auth' && this.currentView !== 'admin') {
          this.showLandingPage(true);
        }
      } else {
        this.statsHeader.update();
        const hadOAuthToken = window.location.hash.includes('access_token=') || window.location.search.includes('code=');
        // Clean URL hash and search if it contains OAuth tokens
        if (window.location.hash.includes('access_token=') || window.location.hash.includes('error=')) {
          window.history.replaceState(null, '', window.location.pathname || '/dashboard');
        }
        // If user just signed in via Google/OAuth or was on auth view or landing, redirect to dashboard
        if (this.currentView === 'auth' || (hadOAuthToken && this.currentView === 'landing')) {
          this.showLibrary(true);
        }
      }
    });

    // Auto-restore session from backend HttpOnly cookie or Supabase session
    apiService.getMe().then((data) => {
      if (data) {
        this.statsHeader.update();
        if (this.currentView === 'profile') {
          this.profileView.render();
        } else if (this.currentView === 'auth') {
          this.showLibrary(true);
        }
      } else {
        // Only enforce auth if current route is protected (never kick visitors off the landing page or admin page)
        const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
        const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
        const adminPath = apiService.getAdminRoutePath();
        const adminHash = adminPath.replace(/^\//, '').toLowerCase();
        const isPublic = rawPath === '/' || rawPath === '/login' || rawPath === '/register' || rawPath === adminPath || rawHash === 'landing' || rawHash === 'login' || rawHash === 'register' || rawHash === adminHash;
        if (!isPublic && this.currentView !== 'landing' && this.currentView !== 'admin') {
          this.checkAndEnforceAuth();
        }
      }
    }).catch(() => {
      const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      const adminPath = apiService.getAdminRoutePath();
      const adminHash = adminPath.replace(/^\//, '').toLowerCase();
      const isPublic = rawPath === '/' || rawPath === '/login' || rawPath === '/register' || rawPath === adminPath || rawHash === 'landing' || rawHash === 'login' || rawHash === 'register' || rawHash === adminHash;
      if (!isPublic && this.currentView !== 'landing' && this.currentView !== 'admin' && !apiService.isAuthenticated()) {
        this.checkAndEnforceAuth();
      }
    });
  }

  private checkAndEnforceAuth(): boolean {
    if (!apiService.isAuthenticated()) {
      this.showAuthPage('login', false);
      return false;
    }
    return true;
  }

  private handleLanguageChanged(skipSettingsRender: boolean = false): void {
    this.statsHeader.update();
    if (this.currentView === 'library') {
      this.levelSelector.render();
    } else if (this.currentView === 'profile') {
      this.profileView.render();
    } else if (this.currentView === 'settings') {
      if (!skipSettingsRender) {
        this.settingsView.render();
      }
    } else if (this.currentScene) {
      this.loadCurrentSentence();
    }
  }

  private initRouter(): void {
    window.addEventListener('popstate', () => {
      this.routeCurrentUrl(false);
    });

    window.addEventListener('hashchange', () => {
      this.routeCurrentUrl(false);
    });

    // Handle initial route on startup
    this.routeCurrentUrl(false);
  }

  private routeCurrentUrl(pushHistory: boolean = false): void {
    // 0. Clean up OAuth hash (#access_token=...) from address bar so URL is always clean!
    if (window.location.hash.includes('access_token=') || window.location.hash.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname || '/');
    }

    // Handle OAuth error params if returned by Supabase or Google (e.g. bad_oauth_state)
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('error') || searchParams.has('error_description') || searchParams.has('error_code')) {
      const errorMsg = searchParams.get('error_description') || searchParams.get('error') || 'Kirishda xatolik yuz berdi';
      window.history.replaceState(null, '', '/login');
      this.showAuthPage('login', false);
      setTimeout(() => {
        this.authView.showAlert(`Google orqali kirishda xatolik: ${decodeURIComponent(errorMsg).replace(/\+/g, ' ')}`, 'error');
      }, 150);
      return;
    }

    const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();

    // 0. Dynamic Admin Route Check (configured via Render.com env: ADMIN_PATH or VITE_ADMIN_PATH)
    const adminPath = apiService.getAdminRoutePath();
    const normalizedAdminPath = adminPath.startsWith('/') ? adminPath : '/' + adminPath;
    const adminHash = normalizedAdminPath.replace(/^\//, '').toLowerCase();
    if (rawPath === normalizedAdminPath || rawHash === adminHash) {
      this.showAdminPage(pushHistory);
      return;
    }

    // 1. Explicit Auth routes (/login, /register, /auth)
    if (rawPath === '/login' || rawHash === 'login' || rawPath === '/auth') {
      if (apiService.isAuthenticated()) {
        this.showLibrary(pushHistory);
        return;
      }
      this.showAuthPage('login', pushHistory);
      return;
    }
    if (rawPath === '/register' || rawHash === 'register') {
      if (apiService.isAuthenticated()) {
        this.showLibrary(pushHistory);
        return;
      }
      this.showAuthPage('register', pushHistory);
      return;
    }

    // 2. Landing Page at Root (/)
    if (rawPath === '/' && (!rawHash || rawHash === 'landing')) {
      this.showLandingPage(pushHistory);
      return;
    }

    // 3. Settings View (/settings)
    if (rawPath === '/settings' || rawHash === 'settings') {
      if (!this.checkAndEnforceAuth()) return;
      this.showSettingsPage(pushHistory);
      return;
    }

    // 4. Profile View (/profile)
    if (rawPath === '/profile' || rawHash === 'profile') {
      if (!this.checkAndEnforceAuth()) return;
      this.showProfilePage(pushHistory);
      return;
    }

    // 5. Practice View (/practice?scene=... or /practice/...)
    if (rawPath === '/practice' || rawPath.startsWith('/practice/') || rawHash.startsWith('practice')) {
      if (!this.checkAndEnforceAuth()) return;
      let sceneId = searchParams.get('scene');
      if (!sceneId && rawPath.startsWith('/practice/')) {
        sceneId = decodeURIComponent(rawPath.replace(/^\/practice\//, '').split('/')[0]);
      }
      const allScenes = storageService.getAllScenes();
      const targetScene = (sceneId ? allScenes.find(s => s.id === sceneId) : null) || allScenes[0];
      if (targetScene) {
        const challengePayload = storageService.parseChallengePayload(searchParams);
        this.startScene(targetScene, 0, pushHistory, challengePayload);
        return;
      }
    }

    // 6. Dashboard / Library View (/dashboard or /library)
    if (rawPath === '/dashboard' || rawPath === '/library' || rawHash === 'dashboard' || rawHash === 'library') {
      if (!this.checkAndEnforceAuth()) return;
      this.showLibrary(pushHistory);
      return;
    }

    // 7. Fallback:
    if (apiService.isAuthenticated()) {
      this.showLibrary(pushHistory);
    } else {
      this.showLandingPage(pushHistory);
    }
  }

  private updateUrl(url: string, title?: string): void {
    try {
      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== url) {
        window.history.pushState({ path: url }, title || '', url);
      }
      if (title) {
        document.title = title;
      }
    } catch {
      // Fallback for file:// or sandboxed environments
      try {
        window.location.hash = url;
      } catch {
        // Ignore
      }
    }
  }

  public render(): void {
    this.statsHeader.update();
    if (this.currentView === 'landing') {
      this.showLandingPage(false);
    } else if (this.currentView === 'library') {
      this.showLibrary(false);
    } else if (this.currentView === 'profile') {
      this.showProfilePage(false);
    } else if (this.currentView === 'settings') {
      this.showSettingsPage(false);
    } else if (this.currentView === 'auth') {
      this.showAuthPage('login', false);
    } else if (this.currentView === 'admin') {
      this.showAdminPage(false);
    } else if (this.currentScene) {
      this.loadCurrentSentence();
    }
  }

  private switchView(view: AppViewMode): void {
    this.currentView = view;
    speechService.stop();
    if (view !== 'practice') {
      this.animatedStage?.stopPlayback();
    }

    const landingContainer = document.getElementById('landingViewContainer');
    const libContainer = document.getElementById('libraryViewContainer');
    const practiceContainer = document.getElementById('practiceViewContainer');
    const profileContainer = document.getElementById('profileViewContainer');
    const settingsContainer = document.getElementById('settingsViewContainer');
    const authContainer = document.getElementById('authViewContainer');
    const adminContainer = document.getElementById('adminViewContainer');
    const headerContainer = document.getElementById('statsHeaderContainer');

    if (landingContainer) landingContainer.style.display = view === 'landing' ? 'block' : 'none';
    if (libContainer) libContainer.style.display = view === 'library' ? 'block' : 'none';
    if (practiceContainer) practiceContainer.style.display = view === 'practice' ? 'block' : 'none';
    if (profileContainer) profileContainer.style.display = view === 'profile' ? 'block' : 'none';
    if (settingsContainer) settingsContainer.style.display = view === 'settings' ? 'block' : 'none';
    if (authContainer) authContainer.style.display = view === 'auth' ? 'block' : 'none';
    if (adminContainer) adminContainer.style.display = view === 'admin' ? 'flex' : 'none';
    if (headerContainer) headerContainer.style.display = (view === 'practice' || view === 'auth' || view === 'landing' || view === 'admin') ? 'none' : 'block';

    document.body.classList.toggle('in-landing-mode', view === 'landing');
    document.body.classList.toggle('in-practice-mode', view === 'practice');
    document.body.classList.toggle('in-auth-mode', view === 'auth');
    document.body.classList.toggle('in-admin-mode', view === 'admin');

    if (view !== 'auth' && view !== 'landing' && view !== 'admin') {
      this.statsHeader.update();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public showAdminPage(pushHistory: boolean = true): void {
    const adminPath = apiService.getAdminRoutePath();
    this.switchView('admin');
    this.adminView.render();
    if (pushHistory) {
      this.updateUrl(adminPath, 'Tinglov — Boshqaruv Markazi (Admin)');
    } else {
      document.title = 'Tinglov — Boshqaruv Markazi (Admin)';
    }
  }

  public showLandingPage(pushHistory: boolean = true): void {
    this.switchView('landing');
    this.landingView.render();
    if (pushHistory) {
      this.updateUrl('/', 'Tinglov — Kino va Multfilm orqali Listening');
    } else {
      document.title = 'Tinglov — Kino va Multfilm orqali Listening';
    }
  }

  public showAuthPage(tab: 'login' | 'register' = 'login', pushHistory: boolean = true): void {
    this.switchView('auth');
    this.authView.render(tab);
    if (pushHistory) {
      this.updateUrl(tab === 'register' ? '/register' : '/login', `${tab === 'register' ? 'Ro‘yxatdan o‘tish' : 'Kirish'} — Tinglov`);
    } else {
      document.title = `${tab === 'register' ? 'Ro‘yxatdan o‘tish' : 'Kirish'} — Tinglov`;
    }
  }

  public showLibrary(pushHistory: boolean = true): void {
    if (!this.checkAndEnforceAuth()) return;
    this.switchView('library');
    this.levelSelector.render();
    const targetUrl = '/dashboard';
    if (pushHistory) {
      this.updateUrl(targetUrl, 'Dashboard — Tinglov');
    } else {
      document.title = 'Dashboard — Tinglov';
    }
  }

  public showProfilePage(pushHistory: boolean = true): void {
    if (!this.checkAndEnforceAuth()) return;
    this.switchView('profile');
    this.profileView.render();
    if (pushHistory) {
      this.updateUrl('/profile', 'Profil — Tinglov');
    } else {
      document.title = 'Profil — Tinglov';
    }
  }

  public showSettingsPage(pushHistory: boolean = true): void {
    if (!this.checkAndEnforceAuth()) return;
    this.switchView('settings');
    this.settingsView.render();
    if (pushHistory) {
      this.updateUrl('/settings', 'Sozlamalar — Tinglov');
    } else {
      document.title = 'Sozlamalar — Tinglov';
    }
  }

  public startScene(
    scene: Scene, 
    initialSentenceIndexOrPushHistory: number | boolean = 0, 
    pushHistory: boolean = true,
    challengePayload?: ChallengePayload | null
  ): void {
    if (!this.checkAndEnforceAuth()) return;

    let initialSentenceIndex = 0;
    let push = pushHistory;
    if (typeof initialSentenceIndexOrPushHistory === 'boolean') {
      push = initialSentenceIndexOrPushHistory;
      initialSentenceIndex = 0;
    } else {
      initialSentenceIndex = initialSentenceIndexOrPushHistory;
    }

    this.currentScene = scene;
    this.currentSentenceIndex = Math.max(0, Math.min(scene.dialogues.length - 1, initialSentenceIndex));
    this.sessionAccuracies = [];
    this.sessionWpms = [];
    this.sceneStartTime = Date.now();

    this.switchView('practice');

    // Background prefetch video from CDN / stream endpoints
    videoStreamService.prefetchSceneVideo(scene);

    // Pass incoming challenge payload if user was invited by friend
    this.animatedStage.setChallengePayload(challengePayload || null);

    if (push) {
      this.updateUrl(`/practice?scene=${encodeURIComponent(scene.id)}`, `${scene.title} — Tinglov`);
    } else {
      document.title = `${scene.title} — Tinglov`;
    }

    this.loadCurrentSentence();
  }

  private loadCurrentSentence(): void {
    if (!this.currentScene) return;
    const sentence = this.currentScene.dialogues[this.currentSentenceIndex];
    if (!sentence) {
      this.finishScene();
      return;
    }

    this.animatedStage.updateSceneAndSentence(
      this.currentScene,
      sentence,
      this.currentSentenceIndex,
      this.currentScene.dialogues.length
    );

    this.dictationInput.setSceneAndSentence(this.currentScene, sentence, this.currentSentenceIndex);

    // Auto-play current dialogue after short delay
    setTimeout(() => {
      this.playCurrentDialogue();
    }, 400);
  }

  public playCurrentDialogue(): void {
    if (!this.currentScene) return;
    const sentence = this.currentScene.dialogues[this.currentSentenceIndex];
    if (!sentence) return;

    if (isValidYouTubeVideoId(this.currentScene.youtubeVideoId) || this.currentScene.videoUrl) {
      this.animatedStage.playVideoSegment(sentence.startTime, sentence.endTime);
    } else {
      speechService.speakDialogue(
        sentence,
        this.currentScene.accent,
        (event) => {
          if (event === 'start') {
            this.animatedStage.setSpeakingState(true);
          } else if (event === 'end' || event === 'error') {
            this.animatedStage.setSpeakingState(false);
          }
        }
      );
    }
  }

  public openShadowingMode(): void {
    // Shadowing mode temporarily disabled as requested by user
  }

  private handleSentenceCompleted(accuracy: number, wpm: number, hintsUsed: number): void {
    this.sessionAccuracies.push(accuracy);
    if (wpm > 0) this.sessionWpms.push(wpm);

    // Reveal bilingual parallel subtitles on completion
    this.animatedStage.setSubtitleRevealed(true);
    this.dictationInput.setSubtitleRevealed(true);

    // Calculate XP reward
    const xpEarned = Math.max(10, Math.round(25 * (accuracy / 100) - (hintsUsed * 3)));
    storageService.addXP(xpEarned);
    this.statsHeader.update();

    if (this.currentScene) {
      const wordsCount = sentenceWordsCount(this.currentScene.dialogues[this.currentSentenceIndex]);
      storageService.recordSentenceCompleted(this.currentScene.id, wordsCount, accuracy, wpm);
    }

    // Advance to next sentence smoothly
    setTimeout(() => {
      this.goToNextSentence();
    }, 600);
  }

  private goToPrevSentence(): void {
    if (!this.currentScene) return;
    if (this.currentSentenceIndex > 0) {
      this.currentSentenceIndex--;
      this.loadCurrentSentence();
    }
  }

  private goToNextSentence(): void {
    if (!this.currentScene) return;

    if (this.currentSentenceIndex < this.currentScene.dialogues.length - 1) {
      this.currentSentenceIndex++;
      this.loadCurrentSentence();
    } else {
      this.finishScene();
    }
  }

  private jumpToSentence(index: number): void {
    if (!this.currentScene) return;
    if (index >= 0 && index < this.currentScene.dialogues.length) {
      this.currentSentenceIndex = index;
      this.loadCurrentSentence();
    }
  }

  private finishScene(): void {
    if (!this.currentScene) return;

    const avgAccuracy = this.sessionAccuracies.length > 0
      ? Math.round(this.sessionAccuracies.reduce((a, b) => a + b, 0) / this.sessionAccuracies.length)
      : 100;

    const avgWpm = this.sessionWpms.length > 0
      ? Math.round(this.sessionWpms.reduce((a, b) => a + b, 0) / this.sessionWpms.length)
      : 35;

    const totalXp = 50 + Math.round(avgAccuracy * 0.5);
    const { leveledUp, newLevel } = storageService.addXP(totalXp);
    this.statsHeader.update();

    // Record scene highscore and check rank
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - this.sceneStartTime) / 1000));
    const { isNewTopScore, rank } = storageService.recordSceneCompletionScore(
      this.currentScene.id,
      avgAccuracy,
      avgWpm,
      timeSpentSeconds
    );

    this.completionModal.show(this.currentScene, {
      accuracy: avgAccuracy,
      wpm: avgWpm,
      xpEarned: totalXp,
      leveledUp,
      newLevel,
      isNewTopScore,
      rank
    });

    // If authenticated, sync progress to backend SQLite database
    if (apiService.isAuthenticated()) {
      const stats = storageService.getStats();
      apiService.syncProgress({
        xp: stats.xp,
        streak: stats.streak,
        completedScenes: stats.completedScenes,
        wordsCount: stats.savedWords.length
      }).catch(() => {});
    }
  }

  private loadNextSceneInLibrary(): void {
    const allScenes = storageService.getAllScenes();
    if (!this.currentScene) {
      this.showLibrary();
      return;
    }

    const currentIndex = allScenes.findIndex(s => s.id === this.currentScene?.id);
    if (currentIndex >= 0 && currentIndex < allScenes.length - 1) {
      this.startScene(allScenes[currentIndex + 1]);
    } else {
      this.showLibrary();
    }
  }

  private speedToastTimeout: number | null = null;

  private showSpeedToast(speed: number): void {
    let toast = document.getElementById('speedToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'speedToast';
      toast.className = 'speed-toast-indicator';
      document.body.appendChild(toast);
    }
    const icon = speed < 1.0 ? '🐢' : '⚡';
    const label = speed < 1.0 ? `${speed}x (Sekinlashtirildi)` : '1.0x (Normal)';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-label">${label}</span>`;
    toast.classList.add('visible');
    if (this.speedToastTimeout) clearTimeout(this.speedToastTimeout);
    this.speedToastTimeout = window.setTimeout(() => {
      toast?.classList.remove('visible');
    }, 1400);
  }

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Check if any modal is active
      const isModalOpen = document.querySelector('.modal.active, .completion-modal.active, #customSceneModal.active, #vocabReviewModal.active');

      if (e.key === 'Escape') {
        this.vocabModal.close();
        this.customSceneModal.close();
        this.completionModal.hide();
        return;
      }

      // Tab: Replay current dialogue without losing typing focus!
      if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (this.currentScene && !isModalOpen) {
          e.preventDefault();
          this.playCurrentDialogue();
          this.dictationInput.focusInput();
          return;
        }
      }

      // Ctrl+Space: Slow down / Cycle playback speed (1.0x -> 0.75x -> 0.5x -> 1.0x) & replay
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        const newSpeed = this.animatedStage.cycleSlowDownSpeed();
        this.showSpeedToast(newSpeed);
        this.playCurrentDialogue();
        this.dictationInput.focusInput();
        return;
      }

      // Alt+R to also replay dialogue
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.playCurrentDialogue();
        this.dictationInput.focusInput();
        return;
      }

      // Alt+S for Shadowing Mode (Ovozli takrorlash)
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.openShadowingMode();
        return;
      }

      // Alt+H for hint
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        this.dictationInput.triggerHint();
        this.dictationInput.focusInput();
        return;
      }

      // Alt+C: Toggle / Reveal bilingual subtitles
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (!this.dictationInput.getSubtitleRevealed()) {
          this.dictationInput.setSubtitleRevealed(true);
          this.animatedStage.setSubtitleRevealed(true);
        } else {
          const newMode = this.dictationInput.toggleSubtitleMode();
          this.animatedStage.setSubtitleMode(newMode);
        }
        return;
      }

      // Alt+Left or Ctrl+Left for Previous Sentence
      if ((e.altKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goToPrevSentence();
        return;
      }

      // Alt+Right or Ctrl+Right for Next Sentence
      if ((e.altKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        this.goToNextSentence();
        return;
      }
    });
  }
}

function sentenceWordsCount(sentence: DialogueSentence): number {
  return sentence.text.trim().split(/\s+/).length;
}

// Start Application
document.addEventListener('DOMContentLoaded', () => {
  new MovieListenApp();
});
