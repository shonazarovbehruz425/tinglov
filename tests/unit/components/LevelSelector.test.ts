import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LevelSelector } from '@/components/LevelSelector';
import { storageService } from '@/services/storageService';
import { Scene } from '@/types';

const mockScenes: Scene[] = [
  {
    id: 's1',
    title: 'Finding Nemo',
    movieName: 'Finding Nemo',
    coverEmoji: '🐟',
    category: 'Cartoon',
    difficulty: 'beginner',
    duration: '2:00',
    accent: 'American',
    dialogues: [{ id: 'd1', character: 'Marlin', text: 'Where is my son?', uzbekTranslation: 'O‘g‘lim qayerda?', startTime: 0, endTime: 2 }],
  },
  {
    id: 's2',
    title: 'Harry Potter',
    movieName: 'Harry Potter',
    coverEmoji: '⚡',
    category: 'Cinema',
    difficulty: 'intermediate',
    duration: '3:00',
    accent: 'British',
    dialogues: [{ id: 'd2', character: 'Harry', text: 'Expecto patronum', uzbekTranslation: 'Kutilmagan himoya', startTime: 0, endTime: 3 }],
  },
  {
    id: 's3',
    title: 'Sherlock Holmes',
    movieName: 'Sherlock',
    coverEmoji: '🔍',
    category: 'Cinema',
    difficulty: 'advanced',
    duration: '4:00',
    accent: 'British',
    dialogues: [{ id: 'd3', character: 'Sherlock', text: 'Elementary, my dear Watson', uzbekTranslation: 'Oddiy narsa, qadrdonim Vatson', startTime: 0, endTime: 4 }],
  },
];

describe('LevelSelector filter toolbar', () => {
  let container: HTMLElement;
  let selector: LevelSelector;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(storageService, 'getAllScenes').mockReturnValue(mockScenes);
    vi.spyOn(storageService, 'getStats').mockReturnValue({
      xp: 100,
      level: 2,
      streak: 3,
      lastActiveDate: '2026-01-01',
      completedScenes: ['s1'],
      totalWordsTyped: 50,
      correctWordsTyped: 48,
      wpmHistory: [60],
      savedWords: [],
      userName: 'TestUser',
      userHandle: '@test',
      lastPositions: {},
    });
    vi.spyOn(storageService, 'getSceneHighScores').mockReturnValue([]);

    container = document.createElement('div');
    document.body.appendChild(container);
    selector = new LevelSelector(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders Daraja and Talaffuz filter toolbar and clear filters button', () => {
    selector.render();
    const toolbar = container.querySelector('.catalog-filters-toolbar');
    expect(toolbar).not.toBeNull();

    const diffPills = container.querySelectorAll('#levelDifficultyFilters .filter-btn-pill');
    expect(diffPills.length).toBe(4);

    const accentPills = container.querySelectorAll('#levelAccentFilters .filter-btn-pill');
    expect(accentPills.length).toBe(2);

    const clearBtn = container.querySelector('#clearAllFiltersBtn');
    expect(clearBtn).not.toBeNull();
  });

  it('filters scenes by difficulty', async () => {
    vi.useFakeTimers();
    selector.render();
    const beginnerBtn = container.querySelector('#levelDifficultyFilters [data-difficulty="beginner"]') as HTMLElement;
    expect(beginnerBtn).not.toBeNull();

    beginnerBtn.click();
    vi.advanceTimersByTime(200);

    const cards = container.querySelectorAll('.cinema-courses-grid .cinema-course-card');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-scene-id')).toBe('s1');
    vi.useRealTimers();
  });

  it('filters scenes by accent', async () => {
    vi.useFakeTimers();
    selector.render();

    const britishBtn = container.querySelector('#levelAccentFilters [data-accent="British"]') as HTMLElement;
    expect(britishBtn).not.toBeNull();

    britishBtn.click();
    vi.advanceTimersByTime(200);

    const cards = container.querySelectorAll('.cinema-courses-grid .cinema-course-card');
    expect(cards.length).toBe(2);
    vi.useRealTimers();
  });

  it('toggles accent filter off when clicking the active accent button again', async () => {
    vi.useFakeTimers();
    selector.render();

    const britishBtn = container.querySelector('#levelAccentFilters [data-accent="British"]') as HTMLElement;
    britishBtn.click();
    vi.advanceTimersByTime(200);
    expect(britishBtn.classList.contains('active')).toBe(true);

    // Click again to deactivate
    britishBtn.click();
    vi.advanceTimersByTime(200);
    expect(britishBtn.classList.contains('active')).toBe(false);

    const cards = container.querySelectorAll('.cinema-courses-grid .cinema-course-card');
    expect(cards.length).toBe(3);
    vi.useRealTimers();
  });

  it('resets all filters when clear button is clicked', async () => {
    vi.useFakeTimers();
    selector.render();

    const advancedBtn = container.querySelector('#levelDifficultyFilters [data-difficulty="advanced"]') as HTMLElement;
    advancedBtn.click();
    vi.advanceTimersByTime(200);
    expect(container.querySelectorAll('.cinema-courses-grid .cinema-course-card').length).toBe(1);

    const clearBtn = container.querySelector('#clearAllFiltersBtn') as HTMLElement;
    clearBtn.click();
    vi.advanceTimersByTime(200);

    const allBtn = container.querySelector('#levelDifficultyFilters [data-difficulty="all"]');
    expect(allBtn?.classList.contains('active')).toBe(true);

    const cards = container.querySelectorAll('.cinema-courses-grid .cinema-course-card');
    expect(cards.length).toBe(3);
    vi.useRealTimers();
  });

  it('renders modern empty state when no scenes match and resets filters properly', async () => {
    vi.useFakeTimers();
    selector.render();

    // Search for non-existent scene
    selector.setSearchQuery('NonExistentSceneXYZ999');
    vi.advanceTimersByTime(200);

    // Empty state card should be rendered
    const emptyCard = container.querySelector('.catalog-empty-card');
    expect(emptyCard).not.toBeNull();
    expect(container.querySelector('#emptyStateYouTubeImportBtn')).toBeNull();
    expect(container.querySelector('#emptyStateAddBtn')).toBeNull();

    const emptyResetBtn = container.querySelector('#emptyStateResetFiltersBtn') as HTMLElement;
    expect(emptyResetBtn).not.toBeNull();

    // Click empty state reset button
    emptyResetBtn.click();
    vi.advanceTimersByTime(200);

    const cards = container.querySelectorAll('.cinema-courses-grid .cinema-course-card');
    expect(cards.length).toBe(3);
    vi.useRealTimers();
  });
});
