import { storageService } from '../services/storageService';
import { i18n } from '../services/i18nService';

export class ProfileView {
  private container: HTMLElement;
  private onBackToLibraryCallback: (() => void) | null = null;
  private onOpenSettingsCallback: (() => void) | null = null;
  private onOpenVocabCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onBackToLibrary: () => void;
    onOpenSettings: () => void;
    onOpenVocab: () => void;
  }): void {
    this.onBackToLibraryCallback = callbacks.onBackToLibrary;
    this.onOpenSettingsCallback = callbacks.onOpenSettings;
    this.onOpenVocabCallback = callbacks.onOpenVocab;
  }

  public render(): void {
    const stats = storageService.getStats();
    const t = i18n.t();

    const accuracy = stats.totalWordsTyped > 0
      ? Math.round((stats.correctWordsTyped / stats.totalWordsTyped) * 100)
      : 100;

    const avgWpm = stats.wpmHistory.length > 0
      ? Math.round(stats.wpmHistory.reduce((a, b) => a + b, 0) / stats.wpmHistory.length)
      : 0;

    const currentLevel = stats.level;
    const currentLevelBaseXP = Math.pow(currentLevel - 1, 2) * 100;
    const nextLevelXP = Math.pow(currentLevel, 2) * 100;
    const xpIntoLevel = Math.max(0, stats.xp - currentLevelBaseXP);
    const xpNeededForLevel = Math.max(1, nextLevelXP - currentLevelBaseXP);
    const progressPct = Math.min(100, Math.max(5, Math.round((xpIntoLevel / xpNeededForLevel) * 100)));

    const userName = stats.userName || 'Foydalanuvchi';
    const userHandle = stats.userHandle || '@til_organuvchi';
    const avatarInitial = userName.charAt(0).toUpperCase() || 'U';

    this.container.innerHTML = `
      <div class="dedicated-page-layout">
        <!-- Top Breadcrumb & Navigation -->
        <div class="page-top-nav-bar">
          <button class="page-back-btn" id="profileBackToLibBtn">
            <i class="ph ph-arrow-left"></i>
            <span>${t.backToLibrary}</span>
          </button>
          <div class="page-title-badge">
            <i class="ph ph-user-circle"></i>
            <span>${t.viewProfile}</span>
          </div>
          <button class="page-action-link-btn" id="profileGoToSettingsBtn">
            <i class="ph ph-gear-six"></i>
            <span>${t.manageAccount}</span>
          </button>
        </div>

        <!-- Hero Profile Header Card -->
        <div class="profile-page-hero-card">
          <div class="profile-page-avatar-wrap">
            <div class="profile-page-avatar-large">
              ${avatarInitial}
            </div>
            <div class="profile-online-badge"></div>
          </div>

          <div class="profile-page-meta">
            <div class="profile-page-name-row">
              <h1 class="profile-page-title">${userName}</h1>
              <span class="profile-page-level-chip">
                <i class="ph ph-crown-simple"></i> ${t.userLevel} ${currentLevel}
              </span>
            </div>
            <p class="profile-page-handle">${userHandle}</p>
            <p class="profile-page-bio">
              Tinglov orqali filmlar va multfilmlarni eshitib ingliz tilini o‘rganmoqda.
            </p>
          </div>

          <div class="profile-page-quick-actions">
            <button class="card-continue-btn" id="profileEditBtn" style="padding: 0.6rem 1.25rem;">
              <i class="ph ph-gear-six"></i> ${t.manageAccount}
            </button>
            <button class="clean-btn" id="profileOpenVocabBtn" style="padding: 0.6rem 1.25rem;">
              <i class="ph ph-bookmark-simple"></i> ${t.vocab} (${stats.savedWords.length})
            </button>
          </div>
        </div>

        <!-- Level XP Progress Block -->
        <div class="profile-page-progress-card">
          <div class="profile-level-top">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span class="profile-level-badge">${t.userLevel} ${currentLevel}</span>
              <span style="font-size: 1rem; font-weight: 700; color: var(--text-heading);">Listening Master</span>
            </div>
            <span style="font-size: 1.1rem; font-weight: 800; color: var(--accent-orange);">${stats.xp} XP</span>
          </div>
          <div class="card-progress-bar" style="height: 10px; margin: 0.85rem 0 0.5rem; background: rgba(255, 255, 255, 0.08);">
            <div class="card-progress-fill" style="width: ${progressPct}%; background: linear-gradient(90deg, #FF7A00, #FFA844);"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">
            <span>${t.userLevel} ${currentLevel} (${stats.xp} XP)</span>
            <span>${t.nextLevelXP} ${Math.max(0, nextLevelXP - stats.xp)} XP</span>
            <span>${t.userLevel} ${currentLevel + 1} (${nextLevelXP} XP)</span>
          </div>
        </div>

        <!-- 6 Core Metrics Grid -->
        <div class="profile-page-stats-section">
          <h3 class="section-title-clean">${t.statsTitle}</h3>
          <div class="profile-stats-grid">
            <div class="profile-stat-tile">
              <div class="profile-stat-icon streak"><i class="ph ph-fire"></i></div>
              <span class="profile-stat-num">${stats.streak} ${t.dayStreak}</span>
              <span class="profile-stat-label">${t.streakDays}</span>
            </div>

            <div class="profile-stat-tile">
              <div class="profile-stat-icon accuracy"><i class="ph ph-target"></i></div>
              <span class="profile-stat-num">${accuracy}%</span>
              <span class="profile-stat-label">${t.avgAccuracy}</span>
            </div>

            <div class="profile-stat-tile">
              <div class="profile-stat-icon speed"><i class="ph ph-lightning"></i></div>
              <span class="profile-stat-num">${avgWpm} WPM</span>
              <span class="profile-stat-label">${t.typingSpeed}</span>
            </div>

            <div class="profile-stat-tile">
              <div class="profile-stat-icon words"><i class="ph ph-keyboard"></i></div>
              <span class="profile-stat-num">${stats.totalWordsTyped}</span>
              <span class="profile-stat-label">${t.wordsTyped}</span>
            </div>

            <div class="profile-stat-tile">
              <div class="profile-stat-icon lessons"><i class="ph ph-film-slate"></i></div>
              <span class="profile-stat-num">${stats.completedScenes.length}</span>
              <span class="profile-stat-label">${t.completedScenes}</span>
            </div>

            <div class="profile-stat-tile">
              <div class="profile-stat-icon vocab"><i class="ph ph-bookmark-simple"></i></div>
              <span class="profile-stat-num">${stats.savedWords.length}</span>
              <span class="profile-stat-label">${t.savedWordsCount}</span>
            </div>
          </div>
        </div>

        <!-- Achievement Badges Showcase -->
        <div class="profile-page-badges-section">
          <h3 class="section-title-clean">Yutuqlar va Nishonlar</h3>
          <div class="badges-showcase-grid">
            <div class="achievement-badge-card ${stats.streak >= 1 ? 'unlocked' : 'locked'}">
              <div class="badge-icon-wrap"><i class="ph ph-fire-simple"></i></div>
              <div class="badge-content">
                <h4>Ilk Streak</h4>
                <p>Ketma-ket 1 kun dars qilish</p>
              </div>
            </div>

            <div class="achievement-badge-card ${stats.completedScenes.length >= 1 ? 'unlocked' : 'locked'}">
              <div class="badge-icon-wrap"><i class="ph ph-film-strip"></i></div>
              <div class="badge-content">
                <h4>Kino Ishqibozi</h4>
                <p>Kamida 1 ta lavhani to‘liq yakunlash</p>
              </div>
            </div>

            <div class="achievement-badge-card ${stats.totalWordsTyped >= 50 ? 'unlocked' : 'locked'}">
              <div class="badge-icon-wrap"><i class="ph ph-lightning"></i></div>
              <div class="badge-content">
                <h4>Tezkor Kotib</h4>
                <p>50 ta so‘zni eshitib yozish</p>
              </div>
            </div>

            <div class="achievement-badge-card ${stats.savedWords.length >= 5 ? 'unlocked' : 'locked'}">
              <div class="badge-icon-wrap"><i class="ph ph-bookmark-simple"></i></div>
              <div class="badge-content">
                <h4>Lug‘at Boyi</h4>
                <p>Lug‘atga 5 ta yangi so‘z qo‘shish</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#profileBackToLibBtn')?.addEventListener('click', () => {
      this.onBackToLibraryCallback?.();
    });

    this.container.querySelector('#profileGoToSettingsBtn')?.addEventListener('click', () => {
      this.onOpenSettingsCallback?.();
    });

    this.container.querySelector('#profileEditBtn')?.addEventListener('click', () => {
      this.onOpenSettingsCallback?.();
    });

    this.container.querySelector('#profileOpenVocabBtn')?.addEventListener('click', () => {
      this.onOpenVocabCallback?.();
    });
  }
}
