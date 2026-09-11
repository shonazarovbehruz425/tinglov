import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminView } from '@/components/AdminView';
import { apiService, AdminSceneDto } from '@/services/apiService';

const mockScene: AdminSceneDto = {
  id: 'admin_scene_oppogoy',
  title: 'Oppogoy',
  category: 'Animation',
  difficulty: 'Beginner',
  accent: 'American',
  video_url: 'https://pub-0ac711b64c6a44a585.r2.dev/oppogoy.mp4',
  poster_url: 'https://example.com/poster.jpg',
  dialogues_json: JSON.stringify([
    { startTime: 0, endTime: 3.5, text: 'Hello Snow White', uzbekTranslation: 'Salom Oppogoy' }
  ]),
  created_at: new Date().toISOString()
};

describe('AdminView scene management & editing', () => {
  let container: HTMLElement;
  let adminView: AdminView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    adminView = new AdminView(container);

    vi.spyOn(apiService, 'adminCheckAuth').mockResolvedValue(true);
    vi.spyOn(apiService, 'adminGetStats').mockResolvedValue({
      totalUsers: 10,
      usersToday: 2,
      totalSavedWords: 5,
      totalCompletedScenes: 1,
      totalCustomScenes: 1,
      system: {
        adminPath: '/admin',
        nodeVersion: 'v20.0.0',
        uptimeSeconds: 1000,
        memoryRssMb: 50,
        memoryHeapUsedMb: 30,
        redisConfigured: false,
        csrfProtection: true,
        hstsProtection: true,
        healthEndpoint: '/health',
        keepAliveActive: true,
        renderExternalUrl: null
      }
    });
    vi.spyOn(apiService, 'adminGetUsers').mockResolvedValue([]);
    vi.spyOn(apiService, 'adminGetScenes').mockResolvedValue([mockScene]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders both edit and delete buttons on each scene card', async () => {
    await adminView.render();

    // Switch to scenes tab
    const scenesTabBtn = container.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="scenes"]')!;
    scenesTabBtn.click();
    await new Promise((r) => setTimeout(r, 120));

    const editBtn = container.querySelector<HTMLButtonElement>(`.admin-btn-edit-scene[data-scene-id="${mockScene.id}"]`);
    const delBtn = container.querySelector<HTMLButtonElement>(`.admin-btn-del-scene[data-scene-id="${mockScene.id}"]`);

    expect(editBtn).not.toBeNull();
    expect(delBtn).not.toBeNull();
    expect(editBtn?.title).toBe('Darsni tahrirlash');
  });

  it('clicking edit button opens modal in edit mode and pre-fills scene data', async () => {
    await adminView.render();

    const scenesTabBtn = container.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="scenes"]')!;
    scenesTabBtn.click();
    await new Promise((r) => setTimeout(r, 120));

    const editBtn = container.querySelector<HTMLButtonElement>(`.admin-btn-edit-scene[data-scene-id="${mockScene.id}"]`)!;
    editBtn.click();

    const modal = container.querySelector<HTMLElement>('#adminSceneModal')!;
    expect(modal.style.display).toBe('flex');

    const modalHeading = container.querySelector('#adminModalHeading')!;
    expect(modalHeading.textContent).toContain('Tahrirlash');

    const titleInput = container.querySelector<HTMLInputElement>('#newSceneTitle')!;
    expect(titleInput.value).toBe('Oppogoy');

    const categoryInput = container.querySelector<HTMLSelectElement>('#newSceneCategory')!;
    expect(categoryInput.value).toBe('Animation');

    const difficultyInput = container.querySelector<HTMLSelectElement>('#newSceneDifficulty')!;
    expect(difficultyInput.value).toBe('Beginner');

    const videoInput = container.querySelector<HTMLInputElement>('#newSceneVideoUrl')!;
    expect(videoInput.value).toBe(mockScene.video_url);

    const dialInput = container.querySelector<HTMLTextAreaElement>('#newSceneDialogues')!;
    expect(dialInput.value).toContain('Hello Snow White');
    expect(dialInput.value).toContain('Salom Oppogoy');

    const saveBtn = container.querySelector<HTMLButtonElement>('#adminSaveSceneBtn')!;
    expect(saveBtn.textContent).toContain('O‘zgarishlarni Saqlash');
  });

  it('submitting edit form calls adminUpdateScene with correct scene ID and payload', async () => {
    const updateSpy = vi.spyOn(apiService, 'adminUpdateScene').mockResolvedValue({ success: true });

    await adminView.render();
    const scenesTabBtn = container.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="scenes"]')!;
    scenesTabBtn.click();
    await new Promise((r) => setTimeout(r, 120));

    const editBtn = container.querySelector<HTMLButtonElement>(`.admin-btn-edit-scene[data-scene-id="${mockScene.id}"]`)!;
    editBtn.click();

    const titleInput = container.querySelector<HTMLInputElement>('#newSceneTitle')!;
    titleInput.value = 'Oppogoy va 7 Mittivoy';

    const form = container.querySelector<HTMLFormElement>('#adminNewSceneForm')!;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    await Promise.resolve();

    expect(updateSpy).toHaveBeenCalledWith(
      mockScene.id,
      expect.objectContaining({
        id: mockScene.id,
        title: 'Oppogoy va 7 Mittivoy',
        category: 'Animation',
        video_url: mockScene.video_url
      })
    );
  });
});
