import { storageService } from '../services/storageService';
import { i18n, AppLanguage } from '../services/i18nService';
import { escapeHtml } from '../utils/sanitize';

export class ProfileModal {
  private container: HTMLElement;
  private isEditing: boolean = false;
  private onOpenVocabCallback: (() => void) | null = null;
  private onProfileUpdatedCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onOpenVocab: () => void;
    onProfileUpdated: () => void;
  }): void {
    this.onOpenVocabCallback = callbacks.onOpenVocab;
    this.onProfileUpdatedCallback = callbacks.onProfileUpdated;
  }

  public open(): void {
    this.isEditing = false;
    this.render();
  }

  public close(): void {
    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('modal-closing');
      setTimeout(() => {
        this.container.innerHTML = '';
      }, 240);
    } else {
      this.container.innerHTML = '';
    }
  }

  private render(): void {
    const stats = storageService.getStats();
    const t = i18n.t();
    const curLang = i18n.getLanguage();

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

    const rawUserName = stats.userName || 'Foydalanuvchi';
    const rawUserHandle = stats.userHandle || '@til_organuvchi';
    const userName = escapeHtml(rawUserName);
    const userHandle = escapeHtml(rawUserHandle);
    const avatarInitial = escapeHtml(rawUserName.charAt(0).toUpperCase() || 'U');

    this.container.innerHTML = `
      <div class="modal-backdrop" id="profileModalBackdrop">
        <div class="modal-card profile-modal-card">
          <!-- Top Header Profile Banner -->
          <div class="profile-banner-header">
            <div class="profile-user-summary-row">
              <div class="profile-avatar-big">${avatarInitial}</div>
              <div class="profile-meta-info">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <h3 class="profile-display-name">${userName}</h3>
                  <button class="clean-btn icon-only" id="toggleEditProfileBtn" title="${t.editProfile}" style="padding: 0.2rem 0.45rem; font-size: 0.8rem;">
                    <i class="ph ph-pencil-simple"></i>
                  </button>
                </div>
                <span class="profile-display-handle">${userHandle}</span>
              </div>
            </div>

            <button class="close-modal-round-btn" id="closeProfileModalBtn" title="Yopish">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <!-- Edit Profile Inline Section -->
          ${this.isEditing ? `
            <form id="editProfileForm" class="profile-edit-inline-box">
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div>
                  <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${t.yourName}</label>
                  <input type="text" id="editUserNameInput" class="form-clean-input" value="${userName}" required style="width: 100%;" />
                </div>
                <div>
                  <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${t.userHandle}</label>
                  <input type="text" id="editUserHandleInput" class="form-clean-input" value="${userHandle}" required style="width: 100%;" />
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
                  <button type="button" class="clean-btn" id="cancelEditProfileBtn">${t.cancel}</button>
                  <button type="submit" class="card-continue-btn" style="padding: 0.45rem 1rem;">${t.save}</button>
                </div>
              </div>
            </form>
          ` : ''}

          <div class="modal-body" style="padding: 1.5rem 1.75rem;">
            <!-- Language Settings Section in Profile -->
            <div class="profile-language-picker-box" style="margin-bottom: 1.25rem; background: var(--bg-hover); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-heading); display: flex; align-items: center; gap: 0.4rem;">
                  <i class="ph ph-translate" style="color: var(--accent-orange);"></i> ${t.selectLanguage}:
                </span>
                <span style="font-size: 0.78rem; color: var(--accent-orange); font-weight: 800;">${i18n.getLanguageLabel()}</span>
              </div>
              <div class="lang-pills-row" style="display: flex; gap: 0.5rem;">
                <button type="button" class="lang-pill-btn ${curLang === 'uz' ? 'active' : ''}" data-lang="uz">
                  🇺🇿 O‘zbekcha
                </button>
                <button type="button" class="lang-pill-btn ${curLang === 'en' ? 'active' : ''}" data-lang="en">
                  🇬🇧 English
                </button>
                <button type="button" class="lang-pill-btn ${curLang === 'ru' ? 'active' : ''}" data-lang="ru">
                  🇷🇺 Русский
                </button>
              </div>
            </div>

            <!-- Level & XP Progress Card -->
            <div class="profile-level-card">
              <div class="profile-level-top">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="profile-level-badge">${t.userLevel} ${currentLevel}</span>
                  <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-heading);">Listening Master</span>
                </div>
                <span style="font-size: 0.88rem; font-weight: 800; color: var(--accent-orange);">${stats.xp} XP</span>
              </div>
              <div class="card-progress-bar" style="margin-bottom: 0.45rem; height: 8px;">
                <div class="card-progress-fill" style="width: ${progressPct}%; background: var(--accent-orange);"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                <span>${t.userLevel} ${currentLevel}</span>
                <span>${t.nextLevelXP} ${Math.max(0, nextLevelXP - stats.xp)} XP</span>
                <span>${t.userLevel} ${currentLevel + 1}</span>
              </div>
            </div>

            <!-- Stats 6-tile Grid -->
            <div class="profile-stats-grid">
              <!-- Tile 1: Streak -->
              <div class="profile-stat-tile">
                <div class="profile-stat-icon streak"><i class="ph ph-fire"></i></div>
                <span class="profile-stat-num">${stats.streak} ${t.dayStreak}</span>
                <span class="profile-stat-label">${t.streakDays}</span>
              </div>

              <!-- Tile 2: Accuracy -->
              <div class="profile-stat-tile">
                <div class="profile-stat-icon accuracy"><i class="ph ph-target"></i></div>
                <span class="profile-stat-num">${accuracy}%</span>
                <span class="profile-stat-label">${t.avgAccuracy}</span>
              </div>

              <!-- Tile 3: Speed WPM -->
              <div class="profile-stat-tile">
                <div class="profile-stat-icon speed"><i class="ph ph-lightning"></i></div>
                <span class="profile-stat-num">${avgWpm} WPM</span>
                <span class="profile-stat-label">${t.typingSpeed}</span>
              </div>

              <!-- Tile 4: Words Typed -->
              <div class="profile-stat-tile">
                <div class="profile-stat-icon words"><i class="ph ph-keyboard"></i></div>
                <span class="profile-stat-num">${stats.totalWordsTyped}</span>
                <span class="profile-stat-label">${t.wordsTyped}</span>
              </div>

              <!-- Tile 5: Completed Lessons -->
              <div class="profile-stat-tile">
                <div class="profile-stat-icon lessons"><i class="ph ph-film-slate"></i></div>
                <span class="profile-stat-num">${stats.completedScenes.length}</span>
                <span class="profile-stat-label">${t.completedScenes}</span>
              </div>

              <!-- Tile 6: Saved Vocabulary -->
              <div class="profile-stat-tile">
                <div class="profile-stat-icon vocab"><i class="ph ph-bookmark-simple"></i></div>
                <span class="profile-stat-num">${stats.savedWords.length}</span>
                <span class="profile-stat-label">${t.savedWordsCount}</span>
              </div>
            </div>

            <!-- Footer Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-divider);">
              <button class="clean-btn" id="profileGoToVocabBtn">
                <i class="ph ph-bookmarks"></i> ${t.vocab} (${stats.savedWords.length})
              </button>
              <button class="card-continue-btn" id="closeProfileBtn" style="padding: 0.55rem 1.25rem;">
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#profileModalBackdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'profileModalBackdrop') {
        this.close();
      }
    });

    this.container.querySelector('#closeProfileModalBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#closeProfileBtn')?.addEventListener('click', () => this.close());

    this.container.querySelector('#toggleEditProfileBtn')?.addEventListener('click', () => {
      this.isEditing = !this.isEditing;
      this.render();
    });

    this.container.querySelector('#cancelEditProfileBtn')?.addEventListener('click', () => {
      this.isEditing = false;
      this.render();
    });

    const editForm = this.container.querySelector<HTMLFormElement>('#editProfileForm');
    editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = this.container.querySelector<HTMLInputElement>('#editUserNameInput');
      const handleInput = this.container.querySelector<HTMLInputElement>('#editUserHandleInput');
      if (nameInput && handleInput) {
        storageService.updateProfile(nameInput.value, handleInput.value);
        this.isEditing = false;
        this.onProfileUpdatedCallback?.();
        this.render();
      }
    });

    this.container.querySelector('#profileGoToVocabBtn')?.addEventListener('click', () => {
      this.close();
      this.onOpenVocabCallback?.();
    });

    // Language pills selection inside Profile settings
    const langPills = this.container.querySelectorAll('.lang-pill-btn');
    langPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const lang = (e.currentTarget as HTMLElement).dataset.lang as AppLanguage;
        if (lang) {
          i18n.setLanguage(lang);
          this.onProfileUpdatedCallback?.();
          this.render();
        }
      });
    });
  }
}
