import { Scene, Difficulty } from '../types';
import { youtubeService, YOUTUBE_PRESETS, YouTubeVideoMetadata } from '../services/youtubeService';
import { storageService } from '../services/storageService';
import { soundEffects } from '../services/soundEffects';
import { i18n } from '../services/i18nService';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';
import { safeValidate, youtubeUrlSchema } from '../utils/validation';
import { logger } from '../utils/logger';

export class YouTubeImportModal {
  private container: HTMLElement;
  private currentMetadata: YouTubeVideoMetadata | null = null;
  private isLoading: boolean = false;
  private onCloseCallback: (() => void) | null = null;
  private onLessonCreatedCallback: ((scene: Scene) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onClose: () => void;
    onLessonCreated: (scene: Scene) => void;
  }): void {
    this.onCloseCallback = callbacks.onClose;
    this.onLessonCreatedCallback = callbacks.onLessonCreated;
  }

  public open(): void {
    this.currentMetadata = null;
    this.isLoading = false;
    this.render();
  }

  public close(): void {
    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('modal-closing');
      setTimeout(() => {
        this.container.innerHTML = '';
        this.onCloseCallback?.();
      }, 260);
    } else {
      this.container.innerHTML = '';
      this.onCloseCallback?.();
    }
  }

  private render(): void {
    const t = i18n.t();

    this.container.innerHTML = `
      <div class="modal-backdrop" id="youtubeModalBackdrop">
        <div class="modal-card youtube-modal-card">
          <!-- Modal Header -->
          <div class="modal-header youtube-modal-header">
            <div class="youtube-header-title-wrap">
              <div class="youtube-badge-icon">
                <i class="ph-fill ph-youtube-logo"></i>
              </div>
              <div>
                <h3 class="modal-main-title">${t.youtubeImportTitle}</h3>
                <p class="modal-main-subtitle">${t.youtubeImportDesc}</p>
              </div>
            </div>
            <button class="close-modal-round-btn" id="closeYoutubeModalBtn" title="Yopish">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="youtube-modal-body">
            <!-- URL Input Bar -->
            <div class="youtube-input-group">
              <div class="youtube-url-input-box">
                <i class="ph ph-link-simple youtube-input-icon"></i>
                <input
                  type="text"
                  id="youtubeUrlInput"
                  class="youtube-url-field"
                  placeholder="${t.youtubeUrlPlaceholder}"
                  autocomplete="off"
                  spellcheck="false"
                />
                <button type="button" class="youtube-paste-btn" id="youtubePasteBtn" title="Clipboarddan qo'yish">
                  <i class="ph ph-clipboard-text"></i>
                  <span>${t.youtubePasteBtn}</span>
                </button>
              </div>
              <p class="youtube-input-hint">
                Qo'llab-quvvatlanadi: <code>youtube.com/watch?v=...</code>, <code>youtu.be/...</code>, Shorts yoki video ID
              </p>
            </div>

            <!-- Video Live Preview Card -->
            <div class="youtube-preview-container" id="youtubePreviewContainer" style="display: none;"></div>

            <!-- Options Grid (Difficulty & Category) -->
            <div class="youtube-options-grid">
              <div class="youtube-option-field">
                <label class="youtube-option-label">Daraja (Difficulty)</label>
                <select id="youtubeDifficulty" class="youtube-select-input">
                  <option value="beginner">Beginner (Boshlang'ich)</option>
                  <option value="intermediate" selected>Intermediate (O'rta)</option>
                  <option value="advanced">Advanced (Murakkab)</option>
                </select>
              </div>

              <div class="youtube-option-field">
                <label class="youtube-option-label">Kategoriya</label>
                <select id="youtubeCategory" class="youtube-select-input">
                  <option value="Cinema" selected>Cinema & Movies</option>
                  <option value="Cartoon">Cartoon & Animation</option>
                  <option value="Daily Life">Daily Life & Interviews</option>
                  <option value="Anime">Anime</option>
                </select>
              </div>
            </div>

            <!-- Quick Presets -->
            <div class="youtube-presets-section">
              <h4 class="youtube-presets-heading">
                <i class="ph ph-sparkle"></i> ${t.youtubePresetsTitle}
              </h4>
              <div class="youtube-presets-grid">
                ${YOUTUBE_PRESETS.map(preset => `
                  <div class="youtube-preset-chip" data-url="${preset.url}" data-difficulty="${preset.difficulty}" data-category="${preset.category}">
                    <span class="preset-emoji">${preset.coverEmoji}</span>
                    <div class="preset-info">
                      <span class="preset-title">${preset.title}</span>
                      <span class="preset-author">${preset.channel}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="modal-footer youtube-modal-footer">
            <button type="button" class="clean-btn" id="cancelYoutubeModalBtn">
              ${t.cancel}
            </button>
            <button type="button" class="hero-primary-btn glow-cta-btn" id="generateYoutubeLessonBtn">
              <span class="glow-effect-track" aria-hidden="true"></span>
              <span class="btn-text-content">
                <i class="ph ph-magic-wand"></i>
                <span id="generateBtnLabel">${t.youtubeGenerateBtn}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Backdrop click
    this.container.querySelector('#youtubeModalBackdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'youtubeModalBackdrop') {
        this.close();
      }
    });

    this.container.querySelector('#closeYoutubeModalBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#cancelYoutubeModalBtn')?.addEventListener('click', () => this.close());

    const urlInput = this.container.querySelector<HTMLInputElement>('#youtubeUrlInput');
    const pasteBtn = this.container.querySelector('#youtubePasteBtn');
    const generateBtn = this.container.querySelector<HTMLButtonElement>('#generateYoutubeLessonBtn');

    // Paste button via navigator.clipboard
    pasteBtn?.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && urlInput) {
            urlInput.value = text.trim();
            this.handleUrlChanged(text.trim());
          }
        }
      } catch {
        urlInput?.focus();
      }
    });

    // URL input typing or paste
    urlInput?.addEventListener('input', () => {
      if (urlInput) {
        this.handleUrlChanged(urlInput.value.trim());
      }
    });

    // Preset chip clicks
    const presetChips = this.container.querySelectorAll('.youtube-preset-chip');
    presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const url = (chip as HTMLElement).dataset.url || '';
        const diff = (chip as HTMLElement).dataset.difficulty || 'intermediate';
        const cat = (chip as HTMLElement).dataset.category || 'Cinema';

        if (urlInput) {
          urlInput.value = url;
        }

        const diffSelect = this.container.querySelector<HTMLSelectElement>('#youtubeDifficulty');
        const catSelect = this.container.querySelector<HTMLSelectElement>('#youtubeCategory');
        if (diffSelect) diffSelect.value = diff;
        if (catSelect) catSelect.value = cat;

        this.handleUrlChanged(url);
      });
    });

    // Generate lesson button
    generateBtn?.addEventListener('click', () => {
      this.handleGenerate();
    });
  }

  private async handleUrlChanged(rawUrl: string): Promise<void> {
    const videoId = youtubeService.extractVideoId(rawUrl);
    const previewContainer = this.container.querySelector<HTMLElement>('#youtubePreviewContainer');
    if (!previewContainer) return;

    if (!videoId) {
      previewContainer.style.display = 'none';
      previewContainer.innerHTML = '';
      this.currentMetadata = null;
      return;
    }

    // Show loading skeleton in preview
    previewContainer.style.display = 'flex';
    previewContainer.innerHTML = `
      <div class="youtube-preview-card youtube-skeleton-card">
        <div class="youtube-preview-thumb-wrap app-skeleton-box" style="background: transparent;"></div>
        <div class="youtube-preview-details" style="flex: 1;">
          <div class="app-skeleton-box" style="height: 18px; width: 85%; margin-bottom: 8px;"></div>
          <div class="app-skeleton-box" style="height: 14px; width: 50%; margin-bottom: 8px;"></div>
          <div class="app-skeleton-box" style="height: 20px; width: 120px; border-radius: 9999px;"></div>
        </div>
      </div>
    `;

    const metadata = await youtubeService.fetchVideoMetadata(videoId);
    this.currentMetadata = metadata;

    previewContainer.innerHTML = `
      <div class="youtube-preview-card">
        <div class="youtube-preview-thumb-wrap">
          <img src="${sanitizeUrl(metadata.thumbnailUrl)}" alt="${escapeHtml(metadata.title)}" class="youtube-preview-thumb" />
          <div class="youtube-preview-play-icon">
            <i class="ph-fill ph-play"></i>
          </div>
        </div>
        <div class="youtube-preview-details">
          <h4 class="youtube-preview-title">${escapeHtml(metadata.title)}</h4>
          <span class="youtube-preview-author"><i class="ph ph-user"></i> ${escapeHtml(metadata.authorName)}</span>
          <span class="youtube-preview-badge"><i class="ph ph-check-circle"></i> Diktant darsiga tayyor</span>
        </div>
      </div>
    `;
  }

  private async handleGenerate(): Promise<void> {
    if (this.isLoading) return;

    const urlInput = this.container.querySelector<HTMLInputElement>('#youtubeUrlInput');
    const rawUrl = urlInput?.value.trim() || '';

    const validation = safeValidate(youtubeUrlSchema, rawUrl);
    if (!validation.success) {
      soundEffects.triggerErrorFeedback();
      alert(validation.error);
      urlInput?.focus();
      return;
    }

    const videoId = youtubeService.extractVideoId(validation.data);
    if (!videoId) {
      soundEffects.triggerErrorFeedback();
      alert('Iltimos, to\'g\'ri YouTube video havolasini kiriting!');
      urlInput?.focus();
      return;
    }

    const generateBtn = this.container.querySelector<HTMLButtonElement>('#generateYoutubeLessonBtn');
    const btnLabel = this.container.querySelector<HTMLElement>('#generateBtnLabel');
    const t = i18n.t();

    this.isLoading = true;
    if (generateBtn) generateBtn.disabled = true;
    if (btnLabel) btnLabel.textContent = t.youtubeGenerating;

    try {
      if (!this.currentMetadata || this.currentMetadata.videoId !== videoId) {
        this.currentMetadata = await youtubeService.fetchVideoMetadata(videoId);
      }

      const diffSelect = this.container.querySelector<HTMLSelectElement>('#youtubeDifficulty');
      const catSelect = this.container.querySelector<HTMLSelectElement>('#youtubeCategory');

      const difficulty = (diffSelect?.value as Difficulty) || 'intermediate';
      const category = (catSelect?.value as 'Cartoon' | 'Cinema' | 'Anime' | 'Daily Life') || 'Cinema';

      // Construct interactive Scene with dialogues & vocabulary
      const scene = youtubeService.createSceneFromYouTube(this.currentMetadata, {
        difficulty,
        category,
        accent: 'American'
      });

      // Save to user's personal storage
      storageService.saveCustomScene(scene);
      soundEffects.playLevelUp();

      this.close();
      this.onLessonCreatedCallback?.(scene);
    } catch (err) {
      logger.error('YouTube generation error:', err);
      alert('Darsni generatsiya qilishda xatolik yuz berdi. Qayta urinib ko\'ring.');
    } finally {
      this.isLoading = false;
      if (generateBtn) generateBtn.disabled = false;
      if (btnLabel) btnLabel.textContent = t.youtubeGenerateBtn;
    }
  }
}
