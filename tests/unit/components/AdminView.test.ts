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

  it('clicking sample dialogues button populates textarea with sample lines', async () => {
    await adminView.render();
    const scenesTabBtn = container.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="scenes"]')!;
    scenesTabBtn.click();
    await new Promise((r) => setTimeout(r, 120));

    const addSceneBtn = container.querySelector<HTMLButtonElement>('#adminOpenNewSceneModalBtn')!;
    addSceneBtn.click();

    const sampleBtn = container.querySelector<HTMLButtonElement>('#adminAddSampleDialoguesBtn')!;
    const dialInput = container.querySelector<HTMLTextAreaElement>('#newSceneDialogues')!;
    expect(dialInput.value).toBe('');

    sampleBtn.click();
    expect(dialInput.value).toContain('Welcome to this English lesson');
    expect(dialInput.value).toContain('Ushbu darsga xush kelibsiz');
  });

  it('clicking auto-generate button populates dialogues for YouTube video', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    await adminView.render();
    const scenesTabBtn = container.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="scenes"]')!;
    scenesTabBtn.click();
    await new Promise((r) => setTimeout(r, 120));

    const addSceneBtn = container.querySelector<HTMLButtonElement>('#adminOpenNewSceneModalBtn')!;
    addSceneBtn.click();

    const videoInput = container.querySelector<HTMLInputElement>('#newSceneVideoUrl')!;
    const titleInput = container.querySelector<HTMLInputElement>('#newSceneTitle')!;
    const autoGenBtn = container.querySelector<HTMLButtonElement>('#adminAutoGenerateDialoguesBtn')!;
    const dialInput = container.querySelector<HTMLTextAreaElement>('#newSceneDialogues')!;

    videoInput.value = 'https://www.youtube.com/watch?v=UF8uR6Z6KLc';
    titleInput.value = 'Steve Jobs Stanford Speech';

    autoGenBtn.click();
    expect(dialInput.value).toContain('honored to be with you today');
    expect(dialInput.value.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('submitting scene with empty dialogues alerts and prevents scene creation', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const createSpy = vi.spyOn(apiService, 'adminCreateScene').mockResolvedValue({ success: true, scene: mockScene });

    await adminView.render();
    const scenesTabBtn = container.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="scenes"]')!;
    scenesTabBtn.click();
    await new Promise((r) => setTimeout(r, 120));

    const addSceneBtn = container.querySelector<HTMLButtonElement>('#adminOpenNewSceneModalBtn')!;
    addSceneBtn.click();

    const titleInput = container.querySelector<HTMLInputElement>('#newSceneTitle')!;
    const videoInput = container.querySelector<HTMLInputElement>('#newSceneVideoUrl')!;
    const dialInput = container.querySelector<HTMLTextAreaElement>('#newSceneDialogues')!;

    titleInput.value = 'Custom Video Lesson';
    videoInput.value = 'https://pub-0ac711b64c6a44a585.r2.dev/lesson.mp4';
    dialInput.value = '';

    const form = container.querySelector<HTMLFormElement>('#adminNewSceneForm')!;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    await Promise.resolve();

    expect(alertSpy).toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('clicking overview stat cards opens the corresponding detailed modal', async () => {
    vi.spyOn(apiService, 'adminGetUsers').mockResolvedValue([
      {
        id: 'u1',
        email: 'ali@example.com',
        full_name: 'Ali Valiyev',
        avatar_url: null,
        xp: 1500,
        level: 4,
        streak_days: 7,
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: 'u2',
        email: 'vali@example.com',
        full_name: 'Vali Aliyev',
        avatar_url: null,
        xp: 800,
        level: 2,
        streak_days: 3,
        last_active_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ]);

    await adminView.render();

    const modal = container.querySelector<HTMLElement>('#adminStatDetailModal')!;
    const headingEl = container.querySelector<HTMLElement>('#adminStatDetailHeading')!;
    const bodyEl = container.querySelector<HTMLElement>('#adminStatDetailBody')!;

    // 1. Users Card
    const usersCard = container.querySelector<HTMLElement>('.admin-stat-card[data-stat-type="users"]')!;
    expect(usersCard).not.toBeNull();
    usersCard.click();

    expect(modal.style.display).toBe('flex');
    expect(headingEl.textContent).toContain('Jami O‘quvchilar Tahlili');
    expect(bodyEl.textContent).toContain('Ali Valiyev');
    expect(bodyEl.textContent).toContain('O‘rtacha XP');

    // Close modal via close button
    const closeBtn = container.querySelector<HTMLButtonElement>('#adminCloseStatDetailModalBtn')!;
    closeBtn.click();
    await new Promise((r) => setTimeout(r, 280));
    expect(modal.style.display).toBe('none');

    // 2. Today Card
    const todayCard = container.querySelector<HTMLElement>('.admin-stat-card[data-stat-type="today"]')!;
    todayCard.click();
    expect(modal.style.display).toBe('flex');
    expect(headingEl.textContent).toContain('Bugun Qo‘shilganlar va Faollik');
    expect(bodyEl.textContent).toContain('Ali Valiyev');

    // 3. Words Card
    const wordsCard = container.querySelector<HTMLElement>('.admin-stat-card[data-stat-type="words"]')!;
    wordsCard.click();
    expect(modal.style.display).toBe('flex');
    expect(headingEl.textContent).toContain('O‘rganilgan Lug‘atlar va So‘z Boyligi');
    expect(bodyEl.textContent).toContain('Lug‘at Tizimi');

    // 4. Scenes Card
    const scenesCard = container.querySelector<HTMLElement>('.admin-stat-card[data-stat-type="scenes"]')!;
    scenesCard.click();
    expect(modal.style.display).toBe('flex');
    expect(headingEl.textContent).toContain('Bajarilgan Mashg‘ulotlar va Darslar');
    expect(bodyEl.textContent).toContain('Oppogoy');

    // Close via Escape key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((r) => setTimeout(r, 280));
    expect(modal.style.display).toBe('none');
  });
});
