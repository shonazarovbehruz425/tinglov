import { storageService } from '../services/storageService';
import { APP_THEME_KEY } from '../services/storageKeys';
import { soundEffects } from '../services/soundEffects';
import { i18n, AppLanguage } from '../services/i18nService';
import { searchByWord } from '../services/searchService';
import { apiService } from '../services/apiService';
import { Scene } from '../types';
import { escapeHtml, sanitizeHtml } from '../utils/sanitize';

export type AppTheme = 'light' | 'dark' | 'oled';

export class StatsHeader {
  private container: HTMLElement;
  private currentTheme: AppTheme = 'light';
  private searchDebounceTimer: number | null = null;
  private onOpenVocabCallback: (() => void) | null = null;
  private onOpenLibraryCallback: (() => void) | null = null;
  private onOpenProfileCallback: (() => void) | null = null;
  private onOpenSettingsCallback: (() => void) | null = null;
  private onOpenTourCallback: (() => void) | null = null;
  private onLanguageChangeCallback: ((lang: AppLanguage) => void) | null = null;
  private onSelectSceneAndSentenceCallback: ((scene: Scene, sentenceIndex: number) => void) | null = null;
  private onSearchQueryChangeCallback: ((query: string) => void) | null = null;
  private onOpenAuthCallback: ((tab: 'login' | 'register') => void) | null = null;
  private onSignOutCallback: (() => void) | null = null;
  private documentClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const savedTheme = (localStorage.getItem(APP_THEME_KEY) as AppTheme) || 'light';
    this.currentTheme = savedTheme;
    if (savedTheme === 'dark' || savedTheme === 'oled') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  public setCallbacks(callbacks: {
    onOpenVocab: () => void;
    onOpenLibrary: () => void;
    onOpenProfile: () => void;
    onOpenSettings?: () => void;
    onOpenTour?: () => void;
    onLanguageChange?: (lang: AppLanguage) => void;
    onSelectSceneAndSentence?: (scene: Scene, sentenceIndex: number) => void;
    onSearchQueryChange?: (query: string) => void;
    onOpenAuth?: (tab: 'login' | 'register') => void;
    onSignOut?: () => void;
  }): void {
    this.onOpenVocabCallback = callbacks.onOpenVocab;
    this.onOpenLibraryCallback = callbacks.onOpenLibrary;
    this.onOpenProfileCallback = callbacks.onOpenProfile;
    this.onOpenSettingsCallback = callbacks.onOpenSettings || null;
    this.onOpenTourCallback = callbacks.onOpenTour || null;
    this.onLanguageChangeCallback = callbacks.onLanguageChange || null;
    this.onSelectSceneAndSentenceCallback = callbacks.onSelectSceneAndSentence || null;
    this.onSearchQueryChangeCallback = callbacks.onSearchQueryChange || null;
    this.onOpenAuthCallback = callbacks.onOpenAuth || null;
    this.onSignOutCallback = callbacks.onSignOut || null;
  }

  public update(): void {
    // Re-read the theme on every update — Settings changes it via localStorage
    // and the header must not keep showing a stale theme state/icon.
    const savedTheme = (localStorage.getItem(APP_THEME_KEY) as AppTheme) || 'light';
    this.currentTheme = savedTheme;

    const stats = storageService.getStats();
    const t = i18n.t();
    const curLang = i18n.getLanguage();

    const currentUser = apiService.getCurrentUser();
    const rawName = currentUser?.full_name || currentUser?.username || stats.userName || 'Mehmon';
    const rawHandle = currentUser ? `@${currentUser.username}` : (stats.userHandle || '@mehmon');
    const safeFullName = escapeHtml(rawName);
    const safeHandle = escapeHtml(rawHandle);
    const avatarLetter = escapeHtml(rawName.charAt(0).toUpperCase() || 'M');

    this.container.innerHTML = `
      <header class="app-header">
        <!-- Left: Logo & Home -->
        <div class="header-left">
          <div class="app-logo" id="logoClickBtn" style="cursor: pointer;">
            <img src="/logo.png" alt="Tinglov Logo" class="app-logo-img" />
            <span class="logo-brand-text">Ting<span>lov</span></span>
          </div>

          <button class="nav-library-btn" id="navLibraryBtn">
            <i class="ph ph-squares-four"></i> ${t.library}
          </button>
        </div>

        <!-- Center: Search Bar with Orange Icon -->
        <div class="header-center-search" id="headerCenterSearch">
          <div class="header-search-box">
            <input
              type="text"
              class="header-search-input"
              id="topHeaderSearchInput"
              placeholder="${t.searchPlaceholder}"
              autocomplete="off"
            />
            <button class="header-search-btn" id="topHeaderSearchBtn" title="${t.searchPlaceholder}">
              <i class="ph ph-magnifying-glass"></i>
            </button>
          </div>
          <div class="header-search-dropdown" id="headerSearchDropdown"></div>
        </div>

        <!-- Right: Stats & Actions -->
        <div class="header-right">
          <!-- Combined Compact Streak & XP Pill -->
          <div class="header-combined-stat-pill" title="${stats.streak} ${t.dayStreak} va ${stats.xp} XP">
            <span class="stat-seg streak"><i class="ph ph-fire"></i> <strong>${stats.streak}</strong></span>
            <span class="stat-sep">/</span>
            <span class="stat-seg xp"><i class="ph ph-lightning"></i> <strong>${stats.xp}&nbsp;XP</strong></span>
          </div>

          <!-- Saved Words Button -->
          <button class="header-action-pill" id="openVocabBtn" title="${t.vocab}">
            <i class="ph ph-bookmark-simple"></i>
            <span>${t.vocab} (${stats.savedWords.length})</span>
          </button>


          <!-- Quick Tools (Tour, Sound & Dark Mode) Group -->
          <div class="header-tools-cluster">
            <button class="header-icon-round" id="tourGuideBtn" title="${t.tour}">
              <i class="ph ph-question"></i>
            </button>
            <button class="header-icon-round" id="soundToggleBtn" title="${t.sound}">
              <i class="ph ph-${soundEffects.isSoundEnabled() ? 'speaker-high' : 'speaker-slash'}"></i>
            </button>
            <button class="header-icon-round" id="themeToggleBtn" title="${this.currentTheme === 'oled' ? 'OLED Pure Black' : (this.currentTheme === 'dark' ? t.themeNight : t.themeDay)}">
              <i class="ph ph-${this.currentTheme === 'oled' ? 'circle-half-tilt' : (this.currentTheme === 'dark' ? 'moon' : 'sun')}" style="${this.currentTheme === 'oled' ? 'color: #A855F7;' : ''}"></i>
            </button>
          </div>

          ${!apiService.isAuthenticated() ? `
          <!-- Guest Auth Action Buttons -->
          <div class="header-auth-group">
            <button class="header-auth-btn login" id="headerLoginBtn">
              <i class="ph ph-sign-in"></i>
              <span>Kirish</span>
            </button>
            <button class="header-auth-btn register" id="headerRegisterBtn">
              <i class="ph ph-user-plus"></i>
              <span>Ro‘yxatdan o‘tish</span>
            </button>
          </div>
          ` : ''}

          <!-- User Profile Avatar with Dropdown Container -->
          <div class="user-profile-dropdown-wrapper" id="userProfileDropdownWrapper">
            <div class="user-profile-summary" id="userProfileSummary" title="${t.viewProfile}">
              <div class="user-avatar-circle" style="background: ${apiService.isAuthenticated() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'linear-gradient(135deg, #A3E635, #BEF264)'}; border: 2px solid ${apiService.isAuthenticated() ? '#818CF8' : '#84CC16'}; color: ${apiService.isAuthenticated() ? '#FFFFFF' : '#1A2E05'};">
                ${avatarLetter}
              </div>
              <div class="user-names">
                <span class="user-fullname">${safeFullName}</span>
                <span class="user-handle">${safeHandle}</span>
              </div>
              <i class="ph ph-caret-down user-dropdown-caret" id="userDropdownCaret"></i>
            </div>

            <!-- Custom User Account Dropdown -->
            <div class="user-account-dropdown-menu" id="userAccountDropdownMenu">
              <!-- Header User Info -->
              <div class="dropdown-user-header">
                <div class="dropdown-avatar-circle">
                  <div class="dropdown-avatar-inner" style="background: ${apiService.isAuthenticated() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'linear-gradient(135deg, #A3E635, #BEF264)'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;">
                    ${avatarLetter}
                  </div>
                </div>
                <div class="dropdown-user-meta">
                  <span class="dropdown-user-name">${safeFullName}</span>
                  <span class="dropdown-user-plan">${safeHandle}</span>
                </div>
              </div>

              <!-- Menu Items List -->
              <div class="dropdown-menu-items-group">
                <button class="dropdown-menu-item" id="dropdownViewProfileBtn">
                  <i class="ph ph-user"></i>
                  <span>${t.viewProfile}</span>
                </button>

                <button class="dropdown-menu-item" id="dropdownManageAccountBtn">
                  <i class="ph ph-gear-six"></i>
                  <span>${t.manageAccount}</span>
                </button>

                <button class="dropdown-menu-item" id="dropdownAffiliateBtn">
                  <i class="ph ph-share-network"></i>
                  <span>${t.affiliateProgram}</span>
                  <span class="dropdown-tag-new">${t.affiliateNew}</span>
                </button>

                <button class="dropdown-menu-item" id="dropdownCommunityBtn">
                  <i class="ph ph-discord-logo"></i>
                  <span>${t.joinCommunity}</span>
                </button>

                <!-- Language Selector Row with Flyout Options -->
                <div class="dropdown-lang-container" id="dropdownLangContainer">
                  <button class="dropdown-menu-item lang-item" id="dropdownLangTriggerBtn" type="button">
                    <div class="item-left">
                      <i class="ph ph-translate"></i>
                      <span>${t.language}</span>
                    </div>
                    <div class="item-right-value">
                      <span class="active-lang-badge">${i18n.getLanguageLabel()}</span>
                      <i class="ph ph-caret-down lang-arrow-icon" id="langArrowIcon"></i>
                    </div>
                  </button>

                  <div class="lang-options-drawer" id="langOptionsDrawer">
                    <button class="lang-choice-btn ${curLang === 'uz' ? 'active' : ''}" data-lang="uz">
                      <span>🇺🇿 O‘zbekcha</span>
                      ${curLang === 'uz' ? '<i class="ph ph-check"></i>' : ''}
                    </button>
                    <button class="lang-choice-btn ${curLang === 'en' ? 'active' : ''}" data-lang="en">
                      <span>🇬🇧 English</span>
                      ${curLang === 'en' ? '<i class="ph ph-check"></i>' : ''}
                    </button>
                    <button class="lang-choice-btn ${curLang === 'ru' ? 'active' : ''}" data-lang="ru">
                      <span>🇷🇺 Русский</span>
                      ${curLang === 'ru' ? '<i class="ph ph-check"></i>' : ''}
                    </button>
                  </div>
                </div>
              </div>

              <div class="dropdown-divider-line"></div>

              <!-- Sign Out or Log In Item -->
              <div class="dropdown-menu-items-group footer-group">
                ${apiService.isAuthenticated() ? `
                <button class="dropdown-menu-item signout" id="dropdownSignOutBtn">
                  <i class="ph ph-sign-out"></i>
                  <span>${t.signOut}</span>
                </button>
                ` : `
                <button class="dropdown-menu-item" id="dropdownSignInBtn" style="color: var(--color-primary, #6366F1);">
                  <i class="ph ph-sign-in"></i>
                  <span>Kirish / Ro‘yxatdan o‘tish</span>
                </button>
                `}
              </div>
            </div>
          </div>
        </div>
      </header>
    `;

    this.bindEvents();
  }

  private handleSearchInput(value: string): void {
    const dropdown = this.container.querySelector<HTMLElement>('#headerSearchDropdown');
    if (!dropdown) return;

    const query = value.trim();
    this.onSearchQueryChangeCallback?.(query);

    if (query.length < 2) {
      dropdown.classList.remove('show-dropdown');
      dropdown.innerHTML = '';
      return;
    }

    const results = searchByWord(query);
    const t = i18n.t();

    if (results.dialogueMatches.length === 0 && results.sceneMatches.length === 0) {
      dropdown.innerHTML = `
        <div class="search-empty-state">
          <i class="ph ph-magnifying-glass"></i>
          <span>"${escapeHtml(query)}" ${t.noDialoguesFound}</span>
        </div>
      `;
      dropdown.classList.add('show-dropdown');
      return;
    }

    // Build rich dropdown results
    dropdown.innerHTML = `
      <div class="search-dropdown-content">
        ${results.dialogueMatches.length > 0 ? `
          <div class="search-group-header">
            <i class="ph ph-chats-circle"></i>
            <span>${t.searchWordTitle} (${results.dialogueMatches.length} ${t.foundDialoguesCount}):</span>
          </div>

          <div class="search-dialogue-matches-list">
            ${results.dialogueMatches.slice(0, 8).map((match) => `
              <div class="search-dialogue-item" data-scene-id="${escapeHtml(match.scene.id)}" data-dialogue-index="${match.dialogueIndex}">
                <div class="search-item-poster">
                  <img src="${match.scene.coverImage || '/logo.png'}" alt="${escapeHtml(match.scene.title)}" />
                </div>
                <div class="search-item-info">
                  <div class="search-item-header">
                    <span class="search-item-movie">${escapeHtml(match.scene.title)}</span>
                    <span class="search-item-time">${match.dialogue.startTime}s</span>
                  </div>
                  <div class="search-item-replica">
                    <strong class="search-item-char">${escapeHtml(match.dialogue.character)}:</strong>
                    <span class="search-item-text">"${sanitizeHtml(match.highlightedText)}"</span>
                  </div>
                  ${match.dialogue.uzbekTranslation ? `
                    <div class="search-item-translation">${sanitizeHtml(match.highlightedTranslation)}</div>
                  ` : ''}
                </div>
                <button class="search-item-play-btn" title="${t.jumpToDialogue}">
                  <i class="ph ph-play-fill"></i>
                </button>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${results.sceneMatches.length > 0 ? `
          <div class="search-group-header" style="margin-top: 0.5rem;">
            <i class="ph ph-film-strip"></i>
            <span>Filmlar (${results.sceneMatches.length}):</span>
          </div>
          <div class="search-scenes-chips-row">
            ${results.sceneMatches.slice(0, 4).map((scene) => `
              <button class="search-scene-chip-btn" data-scene-id="${escapeHtml(scene.id)}">
                <i class="ph ph-play"></i>
                <span>${escapeHtml(scene.title)}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    dropdown.classList.add('show-dropdown');

    // Bind click events on dialogue items
    const dialogueItems = dropdown.querySelectorAll('.search-dialogue-item');
    dialogueItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const sceneId = target.dataset.sceneId;
        const dialogueIdx = parseInt(target.dataset.dialogueIndex || '0', 10);
        const allScenes = storageService.getAllScenes();
        const targetScene = allScenes.find(s => s.id === sceneId);
        if (targetScene) {
          dropdown.classList.remove('show-dropdown');
          const input = this.container.querySelector<HTMLInputElement>('#topHeaderSearchInput');
          if (input) input.value = '';
          this.onSelectSceneAndSentenceCallback?.(targetScene, dialogueIdx);
        }
      });
    });

    // Bind click events on scene chips
    const sceneChips = dropdown.querySelectorAll('.search-scene-chip-btn');
    sceneChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const sceneId = target.dataset.sceneId;
        const allScenes = storageService.getAllScenes();
        const targetScene = allScenes.find(s => s.id === sceneId);
        if (targetScene) {
          dropdown.classList.remove('show-dropdown');
          const input = this.container.querySelector<HTMLInputElement>('#topHeaderSearchInput');
          if (input) input.value = '';
          this.onSelectSceneAndSentenceCallback?.(targetScene, 0);
        }
      });
    });
  }

  /**
   * Binds ONE document-level click handler that closes the search and account
   * dropdowns when clicking outside. It re-queries the DOM on every click, so
   * re-renders never leak stale detached elements; earlier versions added two
   * new anonymous document listeners on every update().
   */
  private ensureDocumentClickHandler(): void {
    if (this.documentClickHandler) return;
    this.documentClickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      const searchDropdown = this.container.querySelector<HTMLElement>('#headerSearchDropdown');
      if (searchDropdown?.classList.contains('show-dropdown')
        && !this.container.querySelector('#headerCenterSearch')?.contains(target)) {
        searchDropdown.classList.remove('show-dropdown');
      }
      const accountMenu = this.container.querySelector<HTMLElement>('#userAccountDropdownMenu');
      if (accountMenu?.classList.contains('show-dropdown')
        && !this.container.querySelector('#userProfileDropdownWrapper')?.contains(target)) {
        accountMenu.classList.remove('show-dropdown');
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  private bindEvents(): void {
    // Real-time search by word
    const searchInput = this.container.querySelector<HTMLInputElement>('#topHeaderSearchInput');
    const searchDropdown = this.container.querySelector<HTMLElement>('#headerSearchDropdown');

    searchInput?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = window.setTimeout(() => {
        this.handleSearchInput(val);
      }, 120);
    });

    // Close search dropdown on click outside (single shared document handler)
    this.ensureDocumentClickHandler();

    // Escape to close search dropdown
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchDropdown?.classList.remove('show-dropdown');
      }
    });

    this.container.querySelector('#logoClickBtn')?.addEventListener('click', () => {
      this.onOpenLibraryCallback?.();
    });

    this.container.querySelector('#navLibraryBtn')?.addEventListener('click', () => {
      this.onOpenLibraryCallback?.();
    });

    this.container.querySelector('#openVocabBtn')?.addEventListener('click', () => {
      this.onOpenVocabCallback?.();
    });

    this.container.querySelector('#tourGuideBtn')?.addEventListener('click', () => {
      this.onOpenTourCallback?.();
    });

    // Toggle User Account Dropdown
    const profileSummary = this.container.querySelector('#userProfileSummary');
    const dropdownMenu = this.container.querySelector('#userAccountDropdownMenu');

    profileSummary?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu?.classList.toggle('show-dropdown');
    });

    // Close on document click (single shared handler — see ensureDocumentClickHandler)
    this.ensureDocumentClickHandler();

    // Toggle Language drawer inside dropdown
    const langTrigger = this.container.querySelector('#dropdownLangTriggerBtn');
    const langDrawer = this.container.querySelector('#langOptionsDrawer');
    const langArrow = this.container.querySelector('#langArrowIcon');

    langTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      langDrawer?.classList.toggle('open');
      langArrow?.classList.toggle('rotated');
    });

    // Select language
    const langChoices = this.container.querySelectorAll('.lang-choice-btn');
    langChoices.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedLang = (btn as HTMLElement).dataset.lang as AppLanguage;
        if (selectedLang) {
          i18n.setLanguage(selectedLang);
          this.onLanguageChangeCallback?.(selectedLang);
          this.update();
        }
      });
    });

    // Dropdown items
    this.container.querySelector('#dropdownViewProfileBtn')?.addEventListener('click', () => {
      dropdownMenu?.classList.remove('show-dropdown');
      this.onOpenProfileCallback?.();
    });

    this.container.querySelector('#dropdownManageAccountBtn')?.addEventListener('click', () => {
      dropdownMenu?.classList.remove('show-dropdown');
      this.onOpenSettingsCallback?.();
    });

    this.container.querySelector('#dropdownAffiliateBtn')?.addEventListener('click', () => {
      soundEffects.playHint();
      alert("Do‘stlaringizni taklif qiling va har bir do‘stingiz uchun +500 XP hamda 1 haftalik Pro oling!");
    });

    this.container.querySelector('#dropdownCommunityBtn')?.addEventListener('click', () => {
      window.open('https://discord.com', '_blank');
    });

    // Auth buttons for guests
    this.container.querySelector('#headerLoginBtn')?.addEventListener('click', () => {
      this.onOpenAuthCallback?.('login');
    });

    this.container.querySelector('#headerRegisterBtn')?.addEventListener('click', () => {
      this.onOpenAuthCallback?.('register');
    });

    this.container.querySelector('#dropdownSignInBtn')?.addEventListener('click', () => {
      dropdownMenu?.classList.remove('show-dropdown');
      this.onOpenAuthCallback?.('login');
    });

    this.container.querySelector('#dropdownSignOutBtn')?.addEventListener('click', async () => {
      dropdownMenu?.classList.remove('show-dropdown');
      if (confirm(i18n.t().signOutConfirm)) {
        await apiService.logout();
        storageService.resetForGuest();
        this.onSignOutCallback?.();
        this.update();
      }
    });

    const soundToggle = this.container.querySelector('#soundToggleBtn');
    soundToggle?.addEventListener('click', () => {
      const newState = !soundEffects.isSoundEnabled();
      soundEffects.setSoundEnabled(newState);
      const icon = soundToggle.querySelector('i');
      if (icon) {
        icon.className = `ph ph-${newState ? 'speaker-high' : 'speaker-slash'}`;
      }
    });

    const themeToggle = this.container.querySelector('#themeToggleBtn');
    themeToggle?.addEventListener('click', () => {
      soundEffects.playKeyClick();
      // Cycle: light -> dark -> oled -> light
      if (this.currentTheme === 'light') {
        this.currentTheme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(APP_THEME_KEY, 'dark');
      } else if (this.currentTheme === 'dark') {
        this.currentTheme = 'oled';
        document.documentElement.setAttribute('data-theme', 'oled');
        localStorage.setItem(APP_THEME_KEY, 'oled');
      } else {
        this.currentTheme = 'light';
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(APP_THEME_KEY, 'light');
      }
      this.update();
    });
  }
}
