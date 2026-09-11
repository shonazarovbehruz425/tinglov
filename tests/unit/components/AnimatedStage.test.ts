import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimatedStage } from '@/components/AnimatedStage';
import { Scene, DialogueSentence } from '@/types';

const mockDialogue: DialogueSentence = {
  id: 'd1',
  character: 'Character',
  text: 'Hello world this is a test',
  uzbekTranslation: 'Salom dunyo bu test',
  startTime: 10,
  endTime: 15,
  wordDictionary: {}
};

const mockScene: Scene = {
  id: 'scene-test-1',
  title: 'Test Movie Scene',
  movieName: 'Test Movie',
  category: 'Cinema',
  difficulty: 'beginner',
  duration: '1:30',
  accent: 'American',
  videoUrl: 'https://example.com/test-video.mp4',
  dialogues: [mockDialogue]
};

describe('AnimatedStage player, loop, and play/pause control', () => {
  let container: HTMLElement;
  let stage: AnimatedStage;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    stage = new AnimatedStage(container);

    // Mock HTMLMediaElement methods in jsdom
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => {});
    window.HTMLMediaElement.prototype.load = vi.fn().mockImplementation(() => {});
  });

  afterEach(() => {
    stage.stopPlayback();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders correctly and initializes state', () => {
    stage.updateSceneAndSentence(mockScene, mockDialogue, 0, 1);
    expect(stage.getSpeakingState()).toBe(false);
    expect(stage.getSentenceCompleted()).toBe(false);

    const replayBtn = container.querySelector('#stageReplayBtn');
    expect(replayBtn).not.toBeNull();
    const videoCard = container.querySelector('.cinema-video-card');
    expect(videoCard).not.toBeNull();
  });

  it('toggles play/pause state and updates replay button icon and text', async () => {
    stage.updateSceneAndSentence(mockScene, mockDialogue, 0, 1);
    const replayBtn = container.querySelector<HTMLButtonElement>('#stageReplayBtn')!;
    const replayIcon = replayBtn.querySelector('i')!;
    const replaySpan = replayBtn.querySelector('span')!;

    // Initial state: paused / ready to play
    expect(stage.getSpeakingState()).toBe(false);
    expect(replayIcon.className).toContain('ph-play-fill');

    // Toggle to play
    stage.togglePlayPause();
    await Promise.resolve();
    expect(stage.getSpeakingState()).toBe(true);
    expect(replayIcon.className).toContain('ph-pause-fill');
    expect(replaySpan.textContent).toBe('To‘xtatish');

    // Toggle to pause
    stage.togglePlayPause();
    expect(stage.getSpeakingState()).toBe(false);
    expect(replayIcon.className).toContain('ph-play-fill');
  });

  it('clicking video card toggles play/pause', async () => {
    stage.updateSceneAndSentence(mockScene, mockDialogue, 0, 1);
    const videoCard = container.querySelector<HTMLElement>('.cinema-video-card')!;

    expect(stage.getSpeakingState()).toBe(false);
    videoCard.click();
    await Promise.resolve();
    expect(stage.getSpeakingState()).toBe(true);

    videoCard.click();
    expect(stage.getSpeakingState()).toBe(false);
  });

  it('clicking timeline track does not toggle video play/pause', () => {
    stage.updateSceneAndSentence(mockScene, mockDialogue, 0, 1);
    const timelineTrack = container.querySelector<HTMLElement>('#videoTimelineTrack')!;

    expect(stage.getSpeakingState()).toBe(false);
    timelineTrack.click();
    // Speaking state should remain false because scrubber click is excluded
    expect(stage.getSpeakingState()).toBe(false);
  });

  it('setSentenceCompleted(true) marks completion and cancels loop timers', () => {
    stage.updateSceneAndSentence(mockScene, mockDialogue, 0, 1);
    expect(stage.getSentenceCompleted()).toBe(false);

    stage.setSentenceCompleted(true);
    expect(stage.getSentenceCompleted()).toBe(true);
  });

  it('pauses playback when pausePlayback is called', async () => {
    stage.updateSceneAndSentence(mockScene, mockDialogue, 0, 1);
    stage.playVideoSegment(mockDialogue.startTime, mockDialogue.endTime);
    await Promise.resolve();
    expect(stage.getSpeakingState()).toBe(true);

    stage.pausePlayback(true);
    expect(stage.getSpeakingState()).toBe(false);
  });
});
