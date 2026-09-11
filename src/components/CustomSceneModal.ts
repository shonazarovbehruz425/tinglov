// internal
import { Scene, DialogueSentence, Difficulty } from '../types';
import { BaseModal } from './BaseModal';
import { storageService } from '../services/storageService';
import { soundEffects } from '../services/soundEffects';
import { audioVadService } from '../services/audioVadService';
import { sanitizeUrl } from '../utils/sanitize';
import { safeValidate, customSceneSchema } from '../utils/validation';

export class CustomSceneModal extends BaseModal {
  private onCloseCallback: (() => void) | null = null;
  private onCreatedCallback: ((scene: Scene) => void) | null = null;

  constructor(container: HTMLElement) {
    super(container);
  }

  public setCallbacks(callbacks: {
    onClose: () => void;
    onCreated: (scene: Scene) => void;
  }): void {
    this.onCloseCallback = callbacks.onClose;
    this.onCreatedCallback = callbacks.onCreated;
  }

  public open(): void {
    // Ignore clicks while the closing animation is still pending — the deferred
    // cleanup below would otherwise wipe a freshly rendered modal.
    if (this.isClosing) return;
    this.markOpened();
    this.enableEscapeClose();
    this.render();
  }

  protected override onAfterClose(): void {
    this.onCloseCallback?.();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="customSceneModalBackdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3>Yangi Dars yoki Lavha Qo'shish</h3>
              <p>Multfilm, kino yoki matnlarni kiritib yangi listening darsi yarating</p>
            </div>
            <button class="close-modal-round-btn" id="closeCustomModalBtn" title="Yopish"><i class="ph ph-x"></i></button>
          </div>

          <form id="customSceneForm" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Dars / Film Nomi</label>
                <input type="text" id="customMovieName" class="form-clean-input" required placeholder="Masalan: Finding Nemo" style="width: 100%;" />
              </div>
              <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Kategoriya</label>
                <select id="customCategory" class="form-clean-input" style="width: 100%;">
                  <option value="Cartoon">Multfilm</option>
                  <option value="Cinema">Kino</option>
                  <option value="Daily Life">Kundalik suhbat</option>
                </select>
              </div>
            </div>

            <!-- Video File Upload & URL Section -->
            <div style="background: var(--bg-surface-subtle); border: 1.5px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-heading); display: flex; align-items: center; gap: 0.4rem;">
                  <i class="ph ph-video" style="color: var(--accent-orange);"></i> Video Manbasi (Ixtiyoriy)
                </label>
                <span id="customVideoStatusBadge" style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Audio/Speech sintez rejimi</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; align-items: center;">
                <div>
                  <label for="customVideoFileInput" class="clean-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; padding: 0.55rem 0.85rem; font-size: 0.82rem;">
                    <i class="ph ph-upload-simple"></i>
                    <span id="customVideoUploadLabel">Kompyuterdan video yuklash...</span>
                  </label>
                  <input type="file" id="customVideoFileInput" accept="video/mp4,video/webm,video/ogg,video/*" style="display: none;" />
                </div>
                <div style="position: relative;">
                  <input type="url" id="customVideoUrlInput" class="form-clean-input" placeholder="yoki Video URL (https://...)" style="width: 100%; font-size: 0.82rem; padding: 0.5rem 0.75rem;" />
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-divider); padding-top: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-heading);">Replikalar:</h4>
                <button type="button" class="clean-btn" id="addDialogueRowBtn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                  <i class="ph ph-plus"></i> Yangi replika
                </button>
              </div>

              <div id="dialoguesListInputs" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto;">
                <div class="dialogue-row-item">
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="text" class="form-clean-input char-name-input" placeholder="Personaj nomi (masalan: Dory)" value="Dory" required style="flex: 2;" />
                    <div style="display: flex; align-items: center; gap: 0.25rem; flex: 1.5;">
                      <input type="number" step="0.1" min="0" class="form-clean-input start-time-input" placeholder="Boshlanish" value="0.0" title="Boshlanish vaqti (soniya)" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
                      <span>-</span>
                      <input type="number" step="0.1" min="0.5" class="form-clean-input end-time-input" placeholder="Tugash" value="6.0" title="Tugash vaqti (soniya)" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
                      <span style="font-size: 0.75rem; color: var(--text-secondary);">sek</span>
                    </div>
                  </div>
                  <textarea class="form-clean-input sentence-en-input" placeholder="Inglizcha replika: Just keep swimming..." required rows="2"></textarea>
                  <input type="text" class="form-clean-input sentence-uz-input" placeholder="O'zbekcha tarjimasi: Faqat suzishda davom et..." required />
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-divider); padding-top: 1rem;">
              <button type="button" class="clean-btn" id="cancelCustomSceneBtn">Bekor qilish</button>
              <button type="submit" class="card-continue-btn">Darsni Saqlash</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.bindBackdropClose('customSceneModalBackdrop');

    this.container.querySelector('#closeCustomModalBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#cancelCustomSceneBtn')?.addEventListener('click', () => this.close());

    const addBtn = this.container.querySelector('#addDialogueRowBtn');
    const listContainer = this.container.querySelector('#dialoguesListInputs');

    addBtn?.addEventListener('click', () => {
      const rowCount = listContainer?.querySelectorAll('.dialogue-row-item').length || 0;
      const defaultStart = rowCount * 6;
      const defaultEnd = (rowCount + 1) * 6;
      const newRow = document.createElement('div');
      newRow.className = 'dialogue-row-item';
      newRow.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <input type="text" class="form-clean-input char-name-input" placeholder="Personaj nomi" value="Character ${rowCount + 1}" required style="flex: 2;" />
          <div style="display: flex; align-items: center; gap: 0.25rem; flex: 1.5;">
            <input type="number" step="0.1" min="0" class="form-clean-input start-time-input" placeholder="Boshlanish" value="${defaultStart.toFixed(1)}" title="Boshlanish vaqti (soniya)" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
            <span>-</span>
            <input type="number" step="0.1" min="0.5" class="form-clean-input end-time-input" placeholder="Tugash" value="${defaultEnd.toFixed(1)}" title="Tugash vaqti (soniya)" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
            <span style="font-size: 0.75rem; color: var(--text-secondary);">sek</span>
          </div>
          <button type="button" class="clean-btn remove-row-btn" style="color: #EF4444; padding: 0.4rem;"><i class="ph ph-trash"></i></button>
        </div>
        <textarea class="form-clean-input sentence-en-input" placeholder="Inglizcha replika..." required rows="2"></textarea>
        <input type="text" class="form-clean-input sentence-uz-input" placeholder="O'zbekcha tarjimasi..." required />
      `;

      newRow.querySelector('.remove-row-btn')?.addEventListener('click', () => newRow.remove());
      listContainer?.appendChild(newRow);
    });

    const fileInput = this.container.querySelector<HTMLInputElement>('#customVideoFileInput');
    const urlInput = this.container.querySelector<HTMLInputElement>('#customVideoUrlInput');
    const uploadLabel = this.container.querySelector<HTMLElement>('#customVideoUploadLabel');
    const statusBadge = this.container.querySelector<HTMLElement>('#customVideoStatusBadge');

    let selectedVideoBlobUrl = '';

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) {
        if (selectedVideoBlobUrl) {
          URL.revokeObjectURL(selectedVideoBlobUrl);
        }
        selectedVideoBlobUrl = URL.createObjectURL(file);
        if (uploadLabel) {
          uploadLabel.textContent = `Yuklandi: ${file.name.slice(0, 20)}...`;
        }
        if (statusBadge) {
          statusBadge.textContent = '🎙️ Nutq vaqtlari tahlil qilinmoqda (musiqa filtrlanmoqda)...';
          statusBadge.style.color = '#F59E0B';
        }
        if (urlInput) {
          urlInput.value = '';
        }

        // Automatically detect where characters speak, filtering music
        try {
          const rows = listContainer?.querySelectorAll('.dialogue-row-item');
          const rowCount = rows?.length || 1;
          const segments = await audioVadService.detectSpeechSegmentsFromFile(file, rowCount);
          if (segments && segments.length > 0) {
            rows?.forEach((row, idx) => {
              if (segments[idx]) {
                const startInput = row.querySelector<HTMLInputElement>('.start-time-input');
                const endInput = row.querySelector<HTMLInputElement>('.end-time-input');
                if (startInput) startInput.value = segments[idx].startTime.toFixed(1);
                if (endInput) endInput.value = segments[idx].endTime.toFixed(1);
              }
            });
            if (statusBadge) {
              statusBadge.textContent = `✅ Nutq aniqlandi (${segments.length} ta replika vaqti ulandi)`;
              statusBadge.style.color = '#10B981';
            }
          } else if (statusBadge) {
            statusBadge.textContent = 'Video fayl tayyor (Lokal)';
            statusBadge.style.color = '#10B981';
          }
        } catch {
          if (statusBadge) {
            statusBadge.textContent = 'Video fayl tayyor (Lokal)';
            statusBadge.style.color = '#10B981';
          }
        }
      }
    });

    urlInput?.addEventListener('input', () => {
      if (urlInput.value.trim().length > 0) {
        if (selectedVideoBlobUrl) {
          URL.revokeObjectURL(selectedVideoBlobUrl);
          selectedVideoBlobUrl = '';
        }
        if (uploadLabel) {
          uploadLabel.textContent = 'Kompyuterdan video yuklash...';
        }
        if (statusBadge) {
          statusBadge.textContent = 'Video URL ulandi';
          statusBadge.style.color = '#38BDF8';
        }
      } else {
        if (!selectedVideoBlobUrl && statusBadge) {
          statusBadge.textContent = 'Audio/Speech sintez rejimi';
          statusBadge.style.color = 'var(--text-secondary)';
        }
      }
    });

    const form = this.container.querySelector('#customSceneForm') as HTMLFormElement;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();

      const rawMovieName = (form.querySelector('#customMovieName') as HTMLInputElement).value;
      const category = (form.querySelector('#customCategory') as HTMLSelectElement).value as 'Cartoon' | 'Cinema' | 'Daily Life';
      const manualUrl = urlInput?.value.trim() || '';
      const rawVideoUrl = selectedVideoBlobUrl || manualUrl || undefined;

      const dialogueRows = form.querySelectorAll('.dialogue-row-item');
      const rawDialogues = Array.from(dialogueRows).map((row, idx) => {
        const startVal = parseFloat((row.querySelector('.start-time-input') as HTMLInputElement)?.value || '');
        const endVal = parseFloat((row.querySelector('.end-time-input') as HTMLInputElement)?.value || '');
        const sTime = !isNaN(startVal) && startVal >= 0 ? startVal : idx * 6;
        const eTime = !isNaN(endVal) && endVal > sTime ? endVal : sTime + 6;

        return {
          character: ((row.querySelector('.char-name-input') as HTMLInputElement)?.value || '').trim() || `Character ${idx + 1}`,
          textEn: ((row.querySelector('.sentence-en-input') as HTMLTextAreaElement)?.value || '').trim(),
          textUz: ((row.querySelector('.sentence-uz-input') as HTMLInputElement)?.value || '').trim(),
          startTime: sTime,
          endTime: eTime,
        };
      });

      // Validate scene inputs with Zod
      const validation = safeValidate(customSceneSchema, {
        movieName: rawMovieName,
        category,
        videoUrl: rawVideoUrl,
        dialogues: rawDialogues.map(d => ({
          character: d.character,
          textEn: d.textEn,
          textUz: d.textUz,
        })),
      });

      if (!validation.success) {
        soundEffects.triggerErrorFeedback();
        alert(validation.error);
        return;
      }

      const validatedData = validation.data;
      const movieName = validatedData.movieName;
      const resolvedVideoUrl = sanitizeUrl(validatedData.videoUrl || '') || undefined;

      const dialogues: DialogueSentence[] = rawDialogues.map((d, idx) => {
        return {
          id: `custom-dialogue-${Date.now()}-${idx}`,
          character: d.character,
          characterAvatar: '🗣️',
          startTime: d.startTime,
          endTime: d.endTime,
          text: d.textEn,
          cleanText: d.textEn.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, ''),
          uzbekTranslation: d.textUz,
          wordDictionary: {}
        };
      });

      const maxEndTime = dialogues.reduce((max, d) => Math.max(max, d.endTime), 0);
      const newScene: Scene = {
        id: `custom-scene-${Date.now()}`,
        title: movieName,
        movieName,
        coverEmoji: '🎬',
        difficulty: 'beginner' as Difficulty,
        category: validatedData.category as Scene['category'],
        duration: `${Math.ceil(Math.max(maxEndTime, dialogues.length * 6) / 60)} min`,
        accent: 'American',
        videoUrl: resolvedVideoUrl,
        dialogues
      };

      storageService.saveCustomScene(newScene);
      soundEffects.playLevelUp();
      this.close();
      this.onCreatedCallback?.(newScene);
    });
  }
}
