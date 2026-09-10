import { Scene } from '../types';
import { storageService } from '../services/storageService';
import { i18n } from '../services/i18nService';
import { searchByWord, DialogueMatch } from '../services/searchService';
import { escapeHtml, sanitizeHtml } from '../utils/sanitize';

export class LevelSelector {
  private container: HTMLElement;
  private selectedCategory: string = 'all';
  private searchQuery: string = '';
  private onSelectSceneCallback: ((scene: Scene, sentenceIndex?: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onSelectScene: (scene: Scene, sentenceIndex?: number) => void;
    onOpenProfile?: () => void;
  }): void {
    this.onSelectSceneCallback = callbacks.onSelectScene;
  }

  public setOnSelectScene(callback: (scene: Scene, sentenceIndex?: number) => void): void {
    this.onSelectSceneCallback = callback;
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query;
    const allScenes = storageService.getAllScenes();
    this.updateFilteredGrid(allScenes);
  }

  public renderSkeleton(): void {
    import('./SkeletonLoader').then(({ SkeletonLoader }) => {
      this.container.innerHTML = SkeletonLoader.getDashboardSkeletonHtml();
    });
  }

  public render(): void {
    const allScenes = storageService.getAllScenes();
    const stats = storageService.getStats();
    const t = i18n.t();

    const filteredScenes = allScenes.filter(scene => {
      const matchesCategory = this.selectedCategory === 'all' || scene.category.toLowerCase() === this.selectedCategory.toLowerCase();
      const matchesSearch = this.searchQuery === '' ||
        scene.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        scene.movieName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        scene.dialogues.some(d => d.text.toLowerCase().includes(this.searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });

    const wordSearchResults = this.searchQuery ? searchByWord(this.searchQuery) : null;
    const heroScene = allScenes[0];

    this.container.innerHTML = `
      <div class="catalog-dashboard-container">
        <!-- 1. Featured Cinematic Hero Card (Item 2) -->
        ${heroScene ? `
          <div class="featured-hero-banner" id="heroBannerCard" data-scene-id="${heroScene.id}">
            <div class="hero-banner-backdrop" style="background-image: url('${heroScene.coverImage || '/logo-full.png'}');"></div>
            <div class="hero-banner-content">
              <div class="hero-banner-left">
                <div class="hero-badge-row">
                  <span class="hero-category-tag"><i class="ph ph-sparkle-fill"></i> ${t.featuredLesson}</span>
                  <span class="hero-difficulty-tag">A1 - Beginner</span>
                </div>
                <h2 class="hero-banner-title">${heroScene.title}</h2>
                <p class="hero-banner-sub">${heroScene.movieName}</p>
                <p class="hero-banner-desc">
                  ${heroScene.category === 'Cartoon' ? t.appTagline : heroScene.movieName}
                </p>

                <div class="hero-meta-row">
                  <div class="hero-meta-item"><i class="ph ph-clock"></i> <span>${heroScene.duration}</span></div>
                  <div class="hero-meta-item"><i class="ph ph-chats-circle"></i> <span>${heroScene.dialogues.length} ${t.dialoguesCount}</span></div>
                  <div class="hero-meta-item"><i class="ph ph-star-fill" style="color: #FEE580;"></i> <span>4.9 (Listening)</span></div>
                </div>

                <div class="hero-action-row">
                  <button class="hero-primary-btn glow-cta-btn" id="heroStartBtn">
                    <span class="glow-effect-track" aria-hidden="true"></span>
                    <span class="btn-text-content">
                      <i class="ph ph-play-fill"></i>
                      <span>${stats.completedScenes.includes(heroScene.id) ? t.replay : t.startPractice}</span>
                    </span>
                    <svg class="btn-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                  <div class="hero-progress-pill">
                    <span>Progress: ${stats.completedScenes.includes(heroScene.id) ? '100%' : '35%'}</span>
                  </div>
                </div>
              </div>

              <div class="hero-banner-right" id="heroPreviewPoster">
                <div class="hero-poster-wrapper">
                  <img src="${heroScene.coverImage || '/logo-full.png'}" alt="${heroScene.title}" class="hero-poster-img" />
                  <div class="hero-poster-play-overlay">
                    <div class="hero-play-circle"><i class="ph ph-play-fill"></i></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- 2. Category Filters & 3-Column Grid (Item 4) -->
        <div class="catalog-section-header">
          <div class="catalog-section-title-wrap">
            <h3 class="catalog-section-heading">${t.library}</h3>
            <span class="catalog-section-count">${filteredScenes.length} ${t.scenesCount}</span>
          </div>

          <div class="catalog-header-actions-cluster">
            <!-- Category Pills with Sliding Glider -->
            <div class="category-pills-filter" id="categoryFilters">
              <div class="category-pill-glider" id="categoryPillGlider"></div>
              <button class="category-pill ${this.selectedCategory === 'all' ? 'active' : ''}" data-category="all">${t.allCategories}</button>
              <button class="category-pill ${this.selectedCategory === 'cartoon' ? 'active' : ''}" data-category="cartoon">${t.cartoons}</button>
              <button class="category-pill ${this.selectedCategory === 'cinema' ? 'active' : ''}" data-category="cinema">${t.cinema}</button>
              <button class="category-pill ${this.selectedCategory === 'daily life' ? 'active' : ''}" data-category="daily life">${t.dailyLife}</button>
            </div>
          </div>
        </div>

        <!-- Word Search Dialogue Matches (Shown when searching by word) -->
        <div id="catalogWordResultsContainer">
          ${wordSearchResults ? this.renderWordDialogueMatchesHtml(wordSearchResults.dialogueMatches) : ''}
        </div>

        <!-- 3-Column Modern Cinema Grid -->
        <div class="cinema-courses-grid">
          ${this.renderCoursesGridHtml(filteredScenes, stats)}
        </div>
      </div>
    `;

    this.bindEvents(allScenes);

    // Initialize glider position smoothly after DOM layout
    requestAnimationFrame(() => {
      this.updateGliderPosition(false);
    });
  }

  private renderCourseSkeletonCards(count: number = 6): string {
    return Array.from({ length: count }).map(() => `
      <div class="cinema-course-card app-skeleton-card">
        <div class="cinema-card-poster-area app-skeleton-box" style="aspect-ratio: 16/9; width: 100%; border-radius: 12px 12px 0 0;"></div>
        <div class="cinema-card-body" style="padding: 1.1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
            <div class="app-skeleton-box" style="width: 80px; height: 16px; border-radius: 9999px;"></div>
            <div class="app-skeleton-box" style="width: 65px; height: 16px; border-radius: 9999px;"></div>
          </div>
          <div class="app-skeleton-box" style="width: 85%; height: 20px; margin-bottom: 0.5rem;"></div>
          <div class="app-skeleton-box" style="width: 50%; height: 14px; margin-bottom: 1rem;"></div>
          <div class="app-skeleton-box" style="width: 100%; height: 6px; border-radius: 9999px; margin-bottom: 1.25rem;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="app-skeleton-box" style="width: 70px; height: 14px;"></div>
            <div class="app-skeleton-box" style="width: 90px; height: 32px; border-radius: 8px;"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  private renderCoursesGridHtml(scenes: Scene[], stats: any): string {
    if (scenes.length === 0) {
      return `
        <div class="clean-empty-box" style="grid-column: 1 / -1;">
          <h3>Darslar topilmadi</h3>
          <p>Ushbu kategoriya bo'yicha hozircha darslar mavjud emas.</p>
        </div>
      `;
    }

    return scenes.map((scene) => {
      const isCompleted = stats.completedScenes.includes(scene.id);
      const poster = scene.coverImage || '/logo-full.png';
      return `
        <div class="cinema-course-card" data-scene-id="${escapeHtml(scene.id)}">
          <div class="cinema-card-poster-area">
            <img src="${poster}" alt="${escapeHtml(scene.title)}" class="cinema-card-poster-img" />
            <div class="cinema-poster-badges">
              <span class="badge-pill category">${escapeHtml(scene.category)}</span>
              <span class="badge-pill duration">${escapeHtml(scene.duration)}</span>
            </div>
            <div class="cinema-poster-hover-overlay">
              <div class="cinema-hover-play"><i class="ph ph-play-fill"></i></div>
            </div>
          </div>

          <div class="cinema-card-body">
            <div class="cinema-card-meta-top">
              <span class="cinema-difficulty-badge">${scene.difficulty === 'beginner' ? 'A1 - Boshlovchi' : 'A2 - O\'rta'}</span>
              <span class="cinema-replika-count">${scene.dialogues.length} ta replika</span>
            </div>

            <h4 class="cinema-card-title">${escapeHtml(scene.title)}</h4>
            <p class="cinema-card-sub">${escapeHtml(scene.movieName)}</p>

            <div class="cinema-card-progress-wrap">
              <div class="card-progress-bar">
                <div class="card-progress-fill" style="width: ${isCompleted ? '100%' : '35%'}"></div>
              </div>
            </div>

            <!-- Community High Scores: TOP 3 indicator under video card -->
            ${this.renderCardHighScoresSnippet(scene.id)}

            <div class="cinema-card-footer">
              <span class="cinema-card-accent-tag">${escapeHtml(scene.accent)} Talaffuz</span>
              <button class="cinema-card-btn glow-cta-btn">
                <span class="glow-effect-track" aria-hidden="true"></span>
                <span class="btn-text-content">
                  <span>${isCompleted ? 'Takrorlash' : 'Boshlash'}</span>
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
    }).join('');
  }

  private renderCardHighScoresSnippet(sceneId: string): string {
    const top3 = storageService.getSceneHighScores(sceneId);
    if (top3.length === 0) {
      return `
        <div class="card-highscores-snippet empty">
          <i class="ph ph-trophy"></i>
          <span>Hali rekord o'rnatilmagan</span>
        </div>
      `;
    }

    const leader = top3[0];
    return `
      <div class="card-highscores-snippet">
        <div class="card-hs-podium-avatars">
          ${top3.map((rec, i) => `
            <span class="card-hs-avatar rank-${i + 1}" title="#${i + 1} ${escapeHtml(rec.userName)} (${rec.accuracy}%, ${rec.wpm} wpm)">
              ${escapeHtml(rec.userName.charAt(0).toUpperCase())}
            </span>
          `).join('')}
        </div>
        <div class="card-hs-text">
          <span class="card-hs-badge">🥇 #${1} ${escapeHtml(leader.userName)}</span>
          <span class="card-hs-score">${leader.accuracy}% • ${leader.wpm} wpm</span>
        </div>
      </div>
    `;
  }

  private handleResize = () => {
    this.updateGliderPosition(false);
  };

  private updateGliderPosition(animate: boolean = true): void {
    const glider = this.container.querySelector('#categoryPillGlider') as HTMLElement;
    const activeBtn = this.container.querySelector('#categoryFilters .category-pill.active') as HTMLElement;

    if (!glider || !activeBtn) return;

    if (!animate) {
      glider.style.transition = 'none';
    } else {
      glider.style.transition = 'transform 0.36s cubic-bezier(0.16, 1, 0.3, 1), width 0.36s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
    }

    const left = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;

    glider.style.transform = `translateX(${left}px)`;
    glider.style.width = `${width}px`;
    glider.style.opacity = '1';

    if (!animate) {
      void glider.offsetWidth;
      glider.style.transition = '';
    }
  }

  private renderWordDialogueMatchesHtml(matches: DialogueMatch[]): string {
    const t = i18n.t();
    if (matches.length === 0) {
      return `
        <div class="word-search-catalog-panel">
          <div class="word-search-empty-state">
            <i class="ph ph-magnifying-glass"></i>
            <span>"${escapeHtml(this.searchQuery)}" ${t.noDialoguesFound}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="word-search-catalog-panel">
        <div class="word-search-catalog-header">
          <div class="word-search-title-left">
            <div class="word-search-header-icon"><i class="ph ph-chats-circle"></i></div>
            <div>
              <h3 class="word-search-title">"${escapeHtml(this.searchQuery)}" ${t.searchWordTitle}</h3>
              <p class="word-search-sub">Kino va multfilmlarda ushbu so‘z aytilgan aniq joyidan darsni boshlang</p>
            </div>
          </div>
          <span class="word-search-count-pill">${matches.length} ${t.foundDialoguesCount}</span>
        </div>

        <div class="word-search-cards-grid">
          ${matches.slice(0, 8).map(m => `
            <div class="word-search-quote-card" data-scene-id="${escapeHtml(m.scene.id)}" data-dialogue-idx="${m.dialogueIndex}">
              <div class="quote-card-meta">
                <div class="quote-movie-badge">
                  <i class="ph ph-film-strip"></i>
                  <span>${escapeHtml(m.scene.title)}</span>
                </div>
                <span class="quote-time-pill">${m.dialogue.startTime}s</span>
              </div>
              <p class="quote-dialogue-line">
                <strong class="quote-char-name">${escapeHtml(m.dialogue.character)}:</strong>
                <span class="quote-sentence">"${sanitizeHtml(m.highlightedText)}"</span>
              </p>
              ${m.dialogue.uzbekTranslation ? `
                <p class="quote-translation-line">${sanitizeHtml(m.highlightedTranslation)}</p>
              ` : ''}
              <div class="quote-card-footer">
                <button class="quote-listen-btn">
                  <i class="ph ph-play-fill"></i>
                  <span>${t.jumpToDialogue}</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private updateFilteredGrid(allScenes: Scene[]): void {
    const grid = this.container.querySelector('.cinema-courses-grid') as HTMLElement;
    const countEl = this.container.querySelector('.catalog-section-count') as HTMLElement;
    const wordResultsContainer = this.container.querySelector('#catalogWordResultsContainer') as HTMLElement;
    if (!grid) return;

    // Show skeleton cards during transition
    grid.innerHTML = this.renderCourseSkeletonCards(6);
    grid.classList.add('filter-animating');

    setTimeout(() => {
      const stats = storageService.getStats();
      const filteredScenes = allScenes.filter(scene => {
        const matchesCategory = this.selectedCategory === 'all' || scene.category.toLowerCase() === this.selectedCategory.toLowerCase();
        const matchesSearch = this.searchQuery === '' ||
          scene.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          scene.movieName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          scene.dialogues.some(d => d.text.toLowerCase().includes(this.searchQuery.toLowerCase()));

        return matchesCategory && matchesSearch;
      });

      if (countEl) {
        countEl.textContent = `${filteredScenes.length} ta dars mavjud`;
      }

      if (wordResultsContainer) {
        const wordResults = this.searchQuery ? searchByWord(this.searchQuery) : null;
        wordResultsContainer.innerHTML = wordResults ? this.renderWordDialogueMatchesHtml(wordResults.dialogueMatches) : '';
      }

      grid.innerHTML = this.renderCoursesGridHtml(filteredScenes, stats);
      this.bindGridCardEvents(allScenes);

      requestAnimationFrame(() => {
        grid.classList.remove('filter-animating');
      });
    }, 120);
  }

  private bindGridCardEvents(allScenes: Scene[]): void {
    const sceneCards = this.container.querySelectorAll('.cinema-course-card');
    sceneCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const sceneId = (e.currentTarget as HTMLElement).dataset.sceneId;
        const targetScene = allScenes.find(s => s.id === sceneId);
        if (targetScene && this.onSelectSceneCallback) {
          this.onSelectSceneCallback(targetScene, 0);
        }
      });
    });

    const quoteCards = this.container.querySelectorAll('.word-search-quote-card');
    quoteCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const sceneId = (e.currentTarget as HTMLElement).dataset.sceneId;
        const dialogueIdx = parseInt((e.currentTarget as HTMLElement).dataset.dialogueIdx || '0', 10);
        const targetScene = allScenes.find(s => s.id === sceneId);
        if (targetScene && this.onSelectSceneCallback) {
          this.onSelectSceneCallback(targetScene, dialogueIdx);
        }
      });
    });
  }

  private bindEvents(allScenes: Scene[]): void {
    // Category filter pills with smooth gliding transition
    const categoryBtns = this.container.querySelectorAll('#categoryFilters .category-pill');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const clicked = e.currentTarget as HTMLElement;
        const newCat = clicked.dataset.category || 'all';
        if (this.selectedCategory === newCat) return;

        this.selectedCategory = newCat;
        categoryBtns.forEach(b => b.classList.remove('active'));
        clicked.classList.add('active');

        this.updateGliderPosition(true);
        this.updateFilteredGrid(allScenes);
      });
    });

    window.removeEventListener('resize', this.handleResize);
    window.addEventListener('resize', this.handleResize);

    // Hero banner click
    const heroBtn = this.container.querySelector('#heroStartBtn');
    const heroPoster = this.container.querySelector('#heroPreviewPoster');
    const launchHero = () => {
      if (allScenes[0] && this.onSelectSceneCallback) {
        this.onSelectSceneCallback(allScenes[0]);
      }
    };
    heroBtn?.addEventListener('click', launchHero);
    heroPoster?.addEventListener('click', launchHero);

    // Bind cards in grid
    this.bindGridCardEvents(allScenes);
  }
}
