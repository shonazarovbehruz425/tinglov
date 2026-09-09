import './style.css';
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
import { onboardingStepper } from './components/OnboardingStepper';
import { initCursorGlow } from './utils/cursorGlow';

type AppViewMode = 'library' | 'practice' | 'profile' | 'settings' | 'auth';

class MovieListenApp {
  private currentScene: Scene | null = null;
  private currentSentenceIndex: number = 0;
  private currentView: AppViewMode = 'library';
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

    // Check and enforce mandatory authentication on startup
    this.checkAndEnforceAuth();

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

    // React to auth state changes (e.g. sign out)
    apiService.onAuthChange((user) => {
      if (!user) {
        this.showAuthPage('login');
      } else {
        this.statsHeader.update();
      }
    });

    // Auto-restore session from backend JWT if user previously logged in
    if (apiService.getToken()) {
      apiService.getMe().then((user) => {
        if (user) {
          this.statsHeader.update();
          if (this.currentView === 'profile') {
            this.profileView.render();
          }
        } else {
          // Token expired or invalid
          this.checkAndEnforceAuth();
        }
      }).catch(() => {
        if (!apiService.isAuthenticated()) {
          this.checkAndEnforceAuth();
        }
      });
    } else {
      this.checkAndEnforceAuth();
    }
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
    const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Explicit Auth routes
    if (rawPath === '/login' || rawHash === 'login' || rawPath === '/auth') {
      this.showAuthPage('login', pushHistory);
      return;
    }
    if (rawPath === '/register' || rawHash === 'register') {
      this.showAuthPage('register', pushHistory);
      return;
    }

    // 2. If not authenticated, always show dedicated auth page
    if (!apiService.isAuthenticated()) {
      this.showAuthPage('login', false);
      return;
    }

    // 3. Settings View
    if (rawPath === '/settings' || rawHash === 'settings') {
      this.showSettingsPage(pushHistory);
      return;
    }

    // 4. Profile View
    if (rawPath === '/profile' || rawHash === 'profile') {
      this.showProfilePage(pushHistory);
      return;
    }

    // 5. Practice View
    if (rawPath === '/practice' || rawPath.startsWith('/practice/') || rawHash.startsWith('practice')) {
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

    // 6. Default: Library
    this.showLibrary(pushHistory);
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
    if (this.currentView === 'library') {
      this.showLibrary(false);
    } else if (this.currentView === 'profile') {
      this.showProfilePage(false);
    } else if (this.currentView === 'settings') {
      this.showSettingsPage(false);
    } else if (this.currentView === 'auth') {
      this.showAuthPage('login', false);
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

    const libContainer = document.getElementById('libraryViewContainer');
    const practiceContainer = document.getElementById('practiceViewContainer');
    const profileContainer = document.getElementById('profileViewContainer');
    const settingsContainer = document.getElementById('settingsViewContainer');
    const authContainer = document.getElementById('authViewContainer');
    const headerContainer = document.getElementById('statsHeaderContainer');

    if (libContainer) libContainer.style.display = view === 'library' ? 'block' : 'none';
    if (practiceContainer) practiceContainer.style.display = view === 'practice' ? 'block' : 'none';
    if (profileContainer) profileContainer.style.display = view === 'profile' ? 'block' : 'none';
    if (settingsContainer) settingsContainer.style.display = view === 'settings' ? 'block' : 'none';
    if (authContainer) authContainer.style.display = view === 'auth' ? 'block' : 'none';
    if (headerContainer) headerContainer.style.display = (view === 'practice' || view === 'auth') ? 'none' : 'block';

    document.body.classList.toggle('in-practice-mode', view === 'practice');
    document.body.classList.toggle('in-auth-mode', view === 'auth');

    if (view !== 'auth') {
      this.statsHeader.update();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    this.switchView('library');
    this.levelSelector.render();
    if (pushHistory) {
      this.updateUrl('/', 'Tinglov — Kino va Multfilm orqali Listening');
    } else {
      document.title = 'Tinglov — Kino va Multfilm orqali Listening';
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

    if (this.currentScene.youtubeVideoId || this.currentScene.videoUrl) {
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
    if (!this.currentScene) return;
    const sentence = this.currentScene.dialogues[this.currentSentenceIndex];
    if (sentence) {
      this.shadowingModal.open(this.currentScene, sentence, this.currentSentenceIndex);
    }
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

    // Shadowing Mode: open AI Pronunciation modal after typing, then go to next
    if (this.currentScene) {
      const currentSent = this.currentScene.dialogues[this.currentSentenceIndex];
      if (currentSent) {
        this.shadowingModal.open(this.currentScene, currentSent, this.currentSentenceIndex);
        this.shadowingModal.setCallbacks({
          onClose: () => {
            this.goToNextSentence();
          },
          onPassed: (score) => {
            const bonusXp = Math.round(score / 5);
            storageService.addXP(bonusXp);
            this.statsHeader.update();
          }
        });
        return;
      }
    }

    this.goToNextSentence();
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
