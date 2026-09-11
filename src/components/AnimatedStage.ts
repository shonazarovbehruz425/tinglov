import { DialogueSentence, Scene, ChallengePayload } from '../types';
import { speechService } from '../services/speechService';
import { videoStreamService } from '../services/videoStreamService';
import { soundEffects } from '../services/soundEffects';
import { i18n } from '../services/i18nService';
import { storageService } from '../services/storageService';
import { SUBTITLE_MODE_KEY } from '../services/storageKeys';
import { escapeHtml, isValidYouTubeVideoId, buildSecureYouTubeEmbedUrl } from '../utils/sanitize';

/**
 * Formats seconds as m:ss (e.g. 75 → "1:15"). The previous inline formatting
 * showed "0:75" once a sentence started past the 59-second mark.
 */
function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export class AnimatedStage {
  private container: HTMLElement;
  private currentScene: Scene | null = null;
  private currentSentence: DialogueSentence | null = null;
  private sentenceIndex: number = 0;
  private totalSentences: number = 0;
  private isSpeaking: boolean = false;
  private speed: number = 1.0;
  private isSubtitleRevealed: boolean = false;
  private subtitleMode: 'both' | 'en' | 'uz' | 'off' = (localStorage.getItem(SUBTITLE_MODE_KEY) as 'both' | 'en' | 'uz' | 'off') || 'both';
  private activeTab: 'description' | 'materials' | 'task' | 'highscores' = 'description';
  private onReplayRequest: (() => void) | null = null;
  private onPrevSentenceRequest: (() => void) | null = null;
  private onNextSentenceRequest: (() => void) | null = null;
  private onSeekToSentence: ((index: number) => void) | null = null;
  private onSpeedChange: ((speed: number) => void) | null = null;
  private onBackToLibrary: (() => void) | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private ytIframeElement: HTMLIFrameElement | null = null;
  private animFrameId: number | null = null;
  private isSentenceCompleted: boolean = false;
  private isManualPaused: boolean = false;
  private loopTimerId: number | null = null;
  private ytCurrentTime: number = 0;
  private challengePayload: ChallengePayload | null = null;
  private onChallengeRequest: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setCallbacks(callbacks: {
    onReplayRequest: () => void;
    onPrevSentence: () => void;
    onNextSentence: () => void;
    onSeekToSentence: (index: number) => void;
    onSpeedChange: (speed: number) => void;
    onBackToLibrary: () => void;
    onChallengeRequest?: () => void;
  }): void {
    this.onReplayRequest = callbacks.onReplayRequest;
    this.onPrevSentenceRequest = callbacks.onPrevSentence;
    this.onNextSentenceRequest = callbacks.onNextSentence;
    this.onSeekToSentence = callbacks.onSeekToSentence;
    this.onSpeedChange = callbacks.onSpeedChange;
    this.onBackToLibrary = callbacks.onBackToLibrary;
    this.onChallengeRequest = callbacks.onChallengeRequest || null;
  }

  public setChallengePayload(payload: ChallengePayload | null): void {
    this.challengePayload = payload;
  }

  public updateSceneAndSentence(
    scene: Scene,
    sentence: DialogueSentence,
    sentenceIndex: number,
    totalSentences: number
  ): void {
    this.currentScene = scene;
    this.currentSentence = sentence;
    this.sentenceIndex = sentenceIndex;
    this.totalSentences = totalSentences;
    this.isSubtitleRevealed = false;
    this.isSentenceCompleted = false;
    this.isManualPaused = false;
    this.clearLoopTimer();
    this.stopVideoTracking();
    this.render();
  }

  private getTotalDuration(): number {
    if (!this.currentScene) return 60;

    // 1. If HTML5 video is loaded and has a valid numeric duration
    if (this.videoElement && !isNaN(this.videoElement.duration) && this.videoElement.duration > 0) {
      return this.videoElement.duration;
    }

    // 2. Parse from scene duration string if available (e.g. "1:45" or "2 min")
    if (this.currentScene.duration) {
      const parts = this.currentScene.duration.split(':');
      if (parts.length === 2) {
        const mins = parseFloat(parts[0]);
        const secs = parseFloat(parts[1]);
        if (!isNaN(mins) && !isNaN(secs)) {
          return (mins * 60) + secs;
        }
      } else if (this.currentScene.duration.includes('min')) {
        const mins = parseFloat(this.currentScene.duration);
        if (!isNaN(mins) && mins > 0) {
          return mins * 60;
        }
      }
    }

    // 3. Fallback to the latest dialogue timestamp
    if (this.currentScene.dialogues.length > 0) {
      const lastDialogue = this.currentScene.dialogues[this.currentScene.dialogues.length - 1];
      return Math.max(lastDialogue.endTime + 5, 30);
    }

    return 60;
  }

  public setSentenceCompleted(completed: boolean): void {
    this.isSentenceCompleted = completed;
    if (completed) {
      this.clearLoopTimer();
    }
  }

  public getSentenceCompleted(): boolean {
    return this.isSentenceCompleted;
  }

  public clearLoopTimer(): void {
    if (this.loopTimerId !== null) {
      window.clearTimeout(this.loopTimerId);
      this.loopTimerId = null;
    }
  }

  public setIsManualPaused(paused: boolean): void {
    this.isManualPaused = paused;
  }

  public togglePlayPause(): void {
    if (this.isSpeaking) {
      this.pausePlayback(true);
      this.flashActionIndicator('pause');
    } else {
      this.resumePlayback();
      this.flashActionIndicator('play');
    }
  }

  public pausePlayback(isManual: boolean = true): void {
    if (isManual) {
      this.isManualPaused = true;
    }
    this.clearLoopTimer();
    this.stopVideoTracking();

    if (this.videoElement) {
      try {
        this.videoElement.pause();
      } catch {}
    }

    if (this.ytIframeElement) {
      const targetOrigin = 'https://www.youtube-nocookie.com';
      this.ytIframeElement.contentWindow?.postMessage(JSON.stringify({
        event: 'command',
        func: 'pauseVideo',
        args: []
      }), targetOrigin);
    }

    this.setSpeakingState(false);
  }

  public resumePlayback(): void {
    if (!this.currentSentence) return;
    this.isManualPaused = false;
    this.clearLoopTimer();

    const startTime = this.currentSentence.startTime;
    const endTime = this.currentSentence.endTime;

    let curTime = startTime;
    if (this.videoElement) {
      curTime = this.videoElement.currentTime;
    } else if (this.ytIframeElement) {
      curTime = this.ytCurrentTime;
    }

    // If already at or very close to the end (within 0.2s) or before start, restart from start
    if (curTime >= endTime - 0.2 || curTime < startTime) {
      this.playVideoSegment(startTime, endTime);
    } else {
      this.playVideoSegment(curTime, endTime);
    }
  }

  private scheduleAutoLoop(startTime: number, endTime: number): void {
    this.clearLoopTimer();
    // Gentle natural interval: 1.2s gives user comfortable thinking time between repetitions
    this.loopTimerId = window.setTimeout(() => {
      this.loopTimerId = null;
      if (!this.isSentenceCompleted && !this.isManualPaused && this.currentSentence) {
        this.playVideoSegment(startTime, endTime);
      }
    }, 1200);
  }

  private flashActionIndicator(action: 'play' | 'pause'): void {
    const indicator = this.container.querySelector<HTMLElement>('#videoCenterIndicator');
    if (!indicator) return;
    const icon = indicator.querySelector('i');
    if (icon) {
      icon.className = `ph ph-${action === 'play' ? 'play-fill' : 'pause-fill'}`;
    }
    indicator.classList.remove('animate-flash');
    void indicator.offsetWidth; // Trigger DOM reflow to restart CSS animation
    indicator.classList.add('animate-flash');
  }

  public playVideoSegment(startTime: number, endTime: number, onEnd?: () => void): void {
    this.stopVideoTracking();
    this.clearLoopTimer();
    this.isManualPaused = false;

    // 1. YouTube Player Mode
    const validYtVideoId = isValidYouTubeVideoId(this.currentScene?.youtubeVideoId);
    if (validYtVideoId && this.ytIframeElement) {
      this.setSpeakingState(true);

      const iframe = this.ytIframeElement;
      const targetOrigin = 'https://www.youtube-nocookie.com';

      // Send postMessage command to seek and play strictly to trusted origin
      const seekMsg = JSON.stringify({
        event: 'command',
        func: 'seekTo',
        args: [startTime, true]
      });
      const playMsg = JSON.stringify({
        event: 'command',
        func: 'playVideo',
        args: []
      });

      iframe.contentWindow?.postMessage(seekMsg, targetOrigin);
      iframe.contentWindow?.postMessage(playMsg, targetOrigin);

      iframe.contentWindow?.postMessage(JSON.stringify({
        event: 'listening'
      }), targetOrigin);

      let startTimestamp = Date.now() + 500; // 500ms initial buffer tolerance
      let isYtPlaying = false;
      this.ytCurrentTime = startTime;

      const onYtMessage = (e: MessageEvent) => {
        if (!e.origin.includes('youtube')) return;
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data.event === 'onStateChange') {
            if (data.info === 1) { // PLAYING
              isYtPlaying = true;
              startTimestamp = Date.now();
            } else if (data.info === 2) { // PAUSED
              isYtPlaying = false;
            }
          }
          if (data.info?.currentTime !== undefined && typeof data.info.currentTime === 'number') {
            this.ytCurrentTime = data.info.currentTime;
          }
        } catch {}
      };

      window.addEventListener('message', onYtMessage);

      const trackYtProgress = () => {
        if (this.isManualPaused) {
          window.removeEventListener('message', onYtMessage);
          return;
        }

        const now = Date.now();
        if (now < startTimestamp && !isYtPlaying) {
          this.animFrameId = requestAnimationFrame(trackYtProgress);
          return;
        }

        const elapsed = Math.max(0, (now - startTimestamp) / 1000);
        const estimatedCurrentTime = startTime + (elapsed * this.speed);
        const currentPos = this.ytCurrentTime > startTime ? this.ytCurrentTime : estimatedCurrentTime;
        this.updateTimelineProgress(currentPos);

        if (currentPos >= endTime) {
          window.removeEventListener('message', onYtMessage);
          const pauseMsg = JSON.stringify({
            event: 'command',
            func: 'pauseVideo',
            args: []
          });
          iframe.contentWindow?.postMessage(pauseMsg, targetOrigin);
          this.stopVideoTracking();
          this.setSpeakingState(false);
          this.updateTimelineProgress(endTime);
          onEnd?.();

          // Auto-loop continuously until user completes the sentence or manually pauses
          if (!this.isSentenceCompleted && !this.isManualPaused) {
            this.scheduleAutoLoop(this.currentSentence?.startTime ?? startTime, this.currentSentence?.endTime ?? endTime);
          }
        } else {
          this.animFrameId = requestAnimationFrame(trackYtProgress);
        }
      };

      this.animFrameId = requestAnimationFrame(trackYtProgress);
      return;
    }

    // 2. HTML5 Video Player Mode
    if (!this.videoElement || !this.currentScene?.videoUrl) {
      this.setSpeakingState(false);
      onEnd?.();
      return;
    }

    const video = this.videoElement;
    video.playbackRate = this.speed;

    const startTracking = () => {
      this.setSpeakingState(true);

      const checkTime = () => {
        if (!this.videoElement || this.isManualPaused) return;

        const cur = this.videoElement.currentTime;
        this.updateTimelineProgress(cur);

        // ONLY stop when reached or passed sentence endTime (never stop prematurely on buffer/pause)
        if (cur >= endTime) {
          this.videoElement.pause();
          this.stopVideoTracking();
          this.setSpeakingState(false);
          this.updateTimelineProgress(endTime);
          onEnd?.();

          // Continuous auto-loop until user completes the sentence or manually pauses
          if (!this.isSentenceCompleted && !this.isManualPaused) {
            this.scheduleAutoLoop(this.currentSentence?.startTime ?? startTime, this.currentSentence?.endTime ?? endTime);
          }
        } else {
          this.animFrameId = requestAnimationFrame(checkTime);
        }
      };

      this.stopVideoTracking();
      this.animFrameId = requestAnimationFrame(checkTime);
    };

    const beginPlay = () => {
      try {
        if (Math.abs(video.currentTime - startTime) > 0.05) {
          video.currentTime = startTime;
        }
      } catch {}

      video.playbackRate = this.speed;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          startTracking();
        }).catch(() => {
          this.setSpeakingState(false);
          this.stopVideoTracking();
        });
      } else {
        startTracking();
      }
    };

    beginPlay();
  }

  public seekRelative(deltaSeconds: number): void {
    if (!this.currentSentence) return;
    const newTime = Math.max(
      this.currentSentence.startTime,
      Math.min(this.currentSentence.endTime, (this.videoElement?.currentTime || this.currentSentence.startTime) + deltaSeconds)
    );
    this.playVideoSegment(newTime, this.currentSentence.endTime);
  }

  public stopPlayback(): void {
    this.clearLoopTimer();
    this.stopVideoTracking();
    if (this.ytIframeElement) {
      const pauseMsg = JSON.stringify({
        event: 'command',
        func: 'pauseVideo',
        args: []
      });
      this.ytIframeElement.contentWindow?.postMessage(pauseMsg, '*');
    }
    if (this.videoElement) {
      try {
        this.videoElement.pause();
      } catch {}
    }
    this.setSpeakingState(false);
  }

  private stopVideoTracking(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public setSpeakingState(speaking: boolean): void {
    this.isSpeaking = speaking;
    const replayIcon = this.container.querySelector('#stageReplayBtn i');
    if (replayIcon) {
      replayIcon.className = `ph ph-${speaking ? 'pause-fill' : 'play-fill'}`;
    }
    const replaySpan = this.container.querySelector('#stageReplayBtn span');
    if (replaySpan) {
      const isUz = i18n.getLanguage() === 'uz';
      replaySpan.textContent = speaking ? (isUz ? 'To‘xtatish' : 'Pause') : i18n.t().replay;
    }
    const replayBtn = this.container.querySelector<HTMLButtonElement>('#stageReplayBtn');
    if (replayBtn) {
      const isUz = i18n.getLanguage() === 'uz';
      const tooltip = speaking ? (isUz ? 'To‘xtatish (Space)' : 'Pause (Space)') : `${i18n.t().replay} (Space / Tab)`;
      replayBtn.title = tooltip;
      replayBtn.setAttribute('aria-label', tooltip);
    }
  }

  public getSpeakingState(): boolean {
    return this.isSpeaking;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public setSpeed(newSpeed: number): void {
    this.speed = newSpeed;
    speechService.setSpeed(newSpeed);
    if (this.videoElement) {
      this.videoElement.playbackRate = newSpeed;
    }
    if (this.ytIframeElement) {
      const rateMsg = JSON.stringify({
        event: 'command',
        func: 'setPlaybackRate',
        args: [newSpeed]
      });
      this.ytIframeElement.contentWindow?.postMessage(rateMsg, '*');
    }
    this.render();
    this.onSpeedChange?.(newSpeed);
  }

  /**
   * Toggles slow motion playback: 1.0x -> 0.75x -> 0.5x -> 1.0x
   */
  public cycleSlowDownSpeed(): number {
    let nextSpeed = 1.0;
    if (this.speed === 1.0) {
      nextSpeed = 0.75;
    } else if (this.speed === 0.75) {
      nextSpeed = 0.5;
    } else {
      nextSpeed = 1.0;
    }
    this.setSpeed(nextSpeed);
    return nextSpeed;
  }

  public setSubtitleRevealed(revealed: boolean): void {
    this.isSubtitleRevealed = revealed;
    this.updateSubtitleDisplay();
  }

  public getSubtitleRevealed(): boolean {
    return this.isSubtitleRevealed;
  }

  public getSubtitleMode(): 'both' | 'en' | 'uz' | 'off' {
    return this.subtitleMode;
  }

  public setSubtitleMode(mode: 'both' | 'en' | 'uz' | 'off'): void {
    this.subtitleMode = mode;
    try {
      localStorage.setItem(SUBTITLE_MODE_KEY, mode);
    } catch {
      // Ignore
    }
    this.updateSubtitleDisplay();
  }

  public toggleSubtitleMode(): 'both' | 'en' | 'uz' | 'off' {
    const modes: Array<'both' | 'en' | 'uz' | 'off'> = ['both', 'en', 'uz', 'off'];
    const curIdx = modes.indexOf(this.subtitleMode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    this.setSubtitleMode(nextMode);
    return nextMode;
  }

  public updateSubtitleDisplay(): void {
    const inVideoOverlay = this.container.querySelector<HTMLElement>('#videoSubtitleOverlay');
    if (!this.currentSentence) return;

    const isRevealed = this.isSubtitleRevealed;
    const mode = this.subtitleMode;

    // In-video floating subtitle overlay
    if (inVideoOverlay) {
      if (isRevealed && mode !== 'off') {
        inVideoOverlay.classList.add('visible');
        inVideoOverlay.innerHTML = `
          ${(mode === 'both' || mode === 'en') ? `<div class="invideo-sub-en">${escapeHtml(this.currentSentence.text)}</div>` : ''}
          ${(mode === 'both' || mode === 'uz') ? `<div class="invideo-sub-uz">${escapeHtml(i18n.getSentenceTranslation(this.currentSentence))}</div>` : ''}
        `;
      } else {
        inVideoOverlay.classList.remove('visible');
        inVideoOverlay.innerHTML = '';
      }
    }
  }

  private updateTimelineProgress(currentTime: number): void {
    const timeDisplay = this.container.querySelector('#videoTimeDisplay');
    const progressFill = this.container.querySelector('#videoProgressFill') as HTMLElement;
    const totalDuration = this.getTotalDuration();

    if (timeDisplay) {
      const curM = Math.floor(currentTime / 60);
      const curS = Math.floor(currentTime % 60);
      const totM = Math.floor(totalDuration / 60);
      const totS = Math.floor(totalDuration % 60);
      timeDisplay.textContent = `${curM}:${curS.toString().padStart(2, '0')} / ${totM}:${totS.toString().padStart(2, '0')}`;
    }

    if (progressFill && totalDuration > 0) {
      const pct = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));
      progressFill.style.width = `${pct}%`;
    }
  }

  private render(): void {
    if (!this.currentScene || !this.currentSentence) return;

    const isFirstSentence = this.sentenceIndex === 0;
    const isLastSentence = this.sentenceIndex === this.totalSentences - 1;
    const validYtVideoId = isValidYouTubeVideoId(this.currentScene.youtubeVideoId) ? this.currentScene.youtubeVideoId.trim() : null;
    const isYouTube = Boolean(validYtVideoId);
    const secureYtEmbedUrl = isYouTube && validYtVideoId ? buildSecureYouTubeEmbedUrl(validYtVideoId, window.location.origin) : null;
    const totalDuration = this.getTotalDuration();

    this.container.innerHTML = `
      <div class="player-column-wrapper">
        <!-- Breadcrumbs Trail & Title (Matching Image 1) -->
        <div class="practice-top-navigation">
          <div class="breadcrumbs-trail">
            <span class="breadcrumb-link" id="bcLibraryLink">Kinolar</span>
            <span>/</span>
            <span class="breadcrumb-link" id="bcCourseLink">${escapeHtml(this.currentScene.title)}</span>
            <span>/</span>
            <span>Replika ${(this.sentenceIndex + 1).toString().padStart(2, '0')}</span>
          </div>

          <div class="practice-title-row">
            <div class="practice-title-left">
              <button class="back-round-btn" id="backToLibraryBtn" title="Orqaga qaytish" aria-label="Katalogga qaytish">
                <i class="ph ph-caret-left" aria-hidden="true"></i>
              </button>
              <h2 class="practice-course-heading">${escapeHtml(this.currentScene.title)}</h2>
            </div>

            <!-- Top Right Info Badges + Minimalist Focus Mode Toggle -->
            <div class="practice-meta-pills">
              <div class="info-pill-yellow">
                <i class="ph ph-notepad"></i>
                <span>${this.totalSentences} ta replika</span>
              </div>
              <div class="info-pill-yellow">
                <i class="ph ph-clock"></i>
                <span>${escapeHtml(this.currentScene.duration)}</span>
              </div>
              <button class="info-pill-yellow focus-mode-btn" id="stageFocusModeBtn" title="Minimalist Focus Mode: Faqat video va matnga diqqat qaratish" aria-label="Minimalist fokus rejimini yoqish">
                <i class="ph ph-corners-out" aria-hidden="true"></i>
                <span>Fokus Rejimi</span>
              </button>
            </div>
          </div>

          ${this.challengePayload ? `
            <div class="friend-challenge-incoming-banner">
              <div class="challenge-banner-left">
                <span class="challenge-banner-icon">⚔️</span>
                <div class="challenge-banner-text">
                  <strong>${escapeHtml(this.challengePayload.creatorName)} ${i18n.t().challengeBannerTitle}</strong>
                  <p>${escapeHtml(i18n.t().challengeBannerText
                    .replace('{userName}', this.challengePayload.creatorName)
                    .replace('{accuracy}', this.challengePayload.accuracy.toString())
                    .replace('{wpm}', this.challengePayload.wpm.toString()))}</p>
                </div>
              </div>
              <div class="challenge-target-pill">
                <span class="target-title">REKORD:</span>
                <span class="target-val">${this.challengePayload.accuracy}% • ${this.challengePayload.wpm} WPM</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Cinema / YouTube Video Player with CDN & Streaming Indicator -->
        <div class="cinema-video-card ${isYouTube && secureYtEmbedUrl ? 'youtube-player-active' : ''}">
          ${isYouTube && secureYtEmbedUrl ? `
            <iframe
              id="youtubeIframePlayer"
              class="youtube-embedded-player"
              src="${secureYtEmbedUrl}"
              title="${escapeHtml(this.currentScene.title)}"
              frameborder="0"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
              loading="lazy"
            ></iframe>
          ` : `
            <video
              id="sceneVideoElement"
              class="cinema-video-player-element"
              playsinline
              preload="auto"
            ></video>
          `}

          <div class="video-character-pill-overlay">
            <span>${escapeHtml(this.currentSentence.character)}</span>
          </div>

          <!-- Video Play/Pause Tap Action Indicator -->
          <div class="video-center-indicator" id="videoCenterIndicator" aria-hidden="true">
            <i class="ph ph-play-fill"></i>
          </div>

          <!-- In-Video Floating Subtitle Overlay -->
          <div class="video-subtitles-overlay ${this.isSubtitleRevealed && this.subtitleMode !== 'off' ? 'visible' : ''}" id="videoSubtitleOverlay" aria-live="polite">
            ${this.isSubtitleRevealed && this.subtitleMode !== 'off' ? `
              ${(this.subtitleMode === 'both' || this.subtitleMode === 'en') ? `<div class="invideo-sub-en">${escapeHtml(this.currentSentence.text)}</div>` : ''}
              ${(this.subtitleMode === 'both' || this.subtitleMode === 'uz') ? `<div class="invideo-sub-uz">${escapeHtml(i18n.getSentenceTranslation(this.currentSentence))}</div>` : ''}
            ` : ''}
          </div>

          <!-- YouTube-Style Bottom Overlay: Timeline Scrubber + Floating Controls -->
          <div class="video-scrubber-overlay">
            <!-- Progress Bar with Sentence Markers -->
            <div class="timeline-progress-track" id="videoTimelineTrack" title="Vaqtni tanlash" role="slider" tabindex="0" aria-label="Video vaqti" aria-valuemin="0" aria-valuemax="${Math.round(totalDuration)}" aria-valuenow="${Math.round(this.currentSentence.startTime)}">
              <div class="timeline-progress-fill" id="videoProgressFill" style="width: ${(this.currentSentence.startTime / totalDuration) * 100}%"></div>
              ${this.currentScene.dialogues.map((d, i) => `
                <div class="timeline-dialogue-marker ${i === this.sentenceIndex ? 'active' : ''}"
                     style="left: ${(d.startTime / totalDuration) * 100}%"
                     title="Replika ${i + 1}: ${escapeHtml(d.text)}"></div>
              `).join('')}
            </div>

            <!-- YouTube Controls Toolbar directly on the video -->
            <div class="yt-video-controls-bar">
              <!-- Left: Play/Replay & Navigation buttons -->
              <div class="yt-controls-left">
                <button class="yt-ctrl-btn" id="stagePrevBtn" ${isFirstSentence ? 'disabled' : ''} title="${i18n.t().prevReplica} (Ctrl+Left)" aria-label="${i18n.t().prevReplica}">
                  <i class="ph ph-skip-back" aria-hidden="true"></i>
                  <span>${i18n.t().prevReplica}</span>
                </button>

                <button class="yt-ctrl-btn icon-only" id="stageRewind2sBtn" title="-2 soniya" aria-label="2 soniya orqaga">
                  <span aria-hidden="true">-2s</span>
                </button>

                <button class="yt-ctrl-btn primary-replay" id="stageReplayBtn" title="${i18n.t().replay} (Space / Tab)" aria-label="${i18n.t().replay}">
                  <i class="ph ph-play-fill" aria-hidden="true"></i>
                  <span>${i18n.t().replay}</span>
                </button>

                <button class="yt-ctrl-btn icon-only" id="stageForward2sBtn" title="+2 soniya" aria-label="2 soniya oldinga">
                  <span aria-hidden="true">+2s</span>
                </button>

                <button class="yt-ctrl-btn" id="stageNextBtn" ${isLastSentence ? 'disabled' : ''} title="${i18n.t().nextReplica} (Ctrl+Right)" aria-label="${i18n.t().nextReplica}">
                  <span>${i18n.t().nextReplica}</span>
                  <i class="ph ph-skip-forward" aria-hidden="true"></i>
                </button>

                <div class="yt-time-badge">
                  <span id="videoTimeDisplay">${formatTimecode(this.currentSentence.startTime)} / ${formatTimecode(totalDuration)}</span>
                </div>
              </div>

              <!-- Right: Speed Selector Chips -->
              <div class="yt-controls-right">
                <div class="yt-speed-selector">
                  <span class="yt-speed-label" id="speedLabelId">${i18n.t().speedLabel}</span>
                  <div class="yt-speed-chips" role="group" aria-labelledby="speedLabelId">
                    <button class="yt-speed-chip ${this.speed === 0.5 ? 'active' : ''}" data-speed="0.5" aria-pressed="${this.speed === 0.5}">0.5x</button>
                    <button class="yt-speed-chip ${this.speed === 0.75 ? 'active' : ''}" data-speed="0.75" aria-pressed="${this.speed === 0.75}">0.75x</button>
                    <button class="yt-speed-chip ${this.speed === 1.0 ? 'active' : ''}" data-speed="1.0" aria-pressed="${this.speed === 1.0}">1.0x</button>
                    <button class="yt-speed-chip ${this.speed === 1.25 ? 'active' : ''}" data-speed="1.25" aria-pressed="${this.speed === 1.25}">1.25x</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs Under Player (Description, Materials, Home task, Community TOP 3 + Share lesson) -->
        <div class="player-tabs-bar">
          <div class="player-nav-tabs" role="tablist" aria-label="Dars bo'limlari">
            <button class="player-tab-pill ${this.activeTab === 'description' ? 'active' : ''}" data-tab="description" role="tab" aria-selected="${this.activeTab === 'description'}">
              ${i18n.t().tabDescription}
            </button>
            <button class="player-tab-pill ${this.activeTab === 'materials' ? 'active' : ''}" data-tab="materials" role="tab" aria-selected="${this.activeTab === 'materials'}">
              ${i18n.t().tabMaterials}
            </button>
            <button class="player-tab-pill ${this.activeTab === 'task' ? 'active' : ''}" data-tab="task" role="tab" aria-selected="${this.activeTab === 'task'}">
              ${i18n.t().tabTask}
            </button>
            <button class="player-tab-pill ${this.activeTab === 'highscores' ? 'active' : ''}" data-tab="highscores" role="tab" aria-selected="${this.activeTab === 'highscores'}">
              ${i18n.t().tabHighScores}
            </button>
          </div>

          <div class="share-lesson-action" id="shareLessonBtn" role="button" tabindex="0" aria-label="${i18n.t().share}">
            <i class="ph ph-share-network" aria-hidden="true"></i>
            <span>${i18n.t().share}</span>
          </div>
        </div>

        <!-- Tab Content Area -->
        <div class="lesson-description-content">
          ${this.activeTab === 'description' ? `
            <div class="uzbek-translation-box">
              <span class="uzbek-trans-label">${i18n.t().translationLabel}</span>
              <p class="uzbek-trans-quote">"${escapeHtml(i18n.getSentenceTranslation(this.currentSentence))}"</p>
            </div>
            <p class="lesson-desc-text">
              <strong>${escapeHtml(this.currentSentence.character)}</strong>: ${i18n.t().appTagline}
            </p>
          ` : this.activeTab === 'materials' ? `
            <div class="materials-words-list">
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">${i18n.t().materialsTitle}</h4>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${Object.keys(this.currentSentence.wordDictionary).map(k => {
                  const w = this.currentSentence!.wordDictionary[k];
                  return `<span class="material-word-chip"><strong>${escapeHtml(w.word)}</strong> — ${escapeHtml(w.translation)}</span>`;
                }).join('') || '<span style="color: var(--text-secondary); font-size: 0.85rem;">Common dialogue phrase</span>'}
              </div>
            </div>
          ` : this.activeTab === 'task' ? `
            <p class="lesson-desc-text">
              ${i18n.t().taskInstruction}
            </p>
          ` : `
            ${this.renderHighScoresTabHtml()}
          `}
        </div>
      </div>
    `;

    this.videoElement = this.container.querySelector<HTMLVideoElement>('#sceneVideoElement');
    this.ytIframeElement = this.container.querySelector<HTMLIFrameElement>('#youtubeIframePlayer');

    if (this.videoElement && this.currentScene && !isValidYouTubeVideoId(this.currentScene.youtubeVideoId)) {
      videoStreamService.attachSmartVideoStream(this.videoElement, this.currentScene);
      const targetStartTime = this.currentSentence.startTime;
      const applyInitialSeek = () => {
        try {
          if (this.videoElement && Math.abs(this.videoElement.currentTime - targetStartTime) > 0.05) {
            this.videoElement.currentTime = targetStartTime;
          }
        } catch {}
      };
      if (this.videoElement.readyState >= 1) {
        applyInitialSeek();
      } else {
        this.videoElement.addEventListener('loadedmetadata', applyInitialSeek, { once: true });
      }
    }
    this.bindEvents();
  }

  private bindEvents(): void {
    // Top back navigation
    this.container.querySelector('#backToLibraryBtn')?.addEventListener('click', () => {
      this.onBackToLibrary?.();
    });
    this.container.querySelector('#bcLibraryLink')?.addEventListener('click', () => {
      this.onBackToLibrary?.();
    });

    // Tap / Click anywhere on the cinema video card to toggle play/pause smoothly
    const videoCard = this.container.querySelector('.cinema-video-card');
    videoCard?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Do not toggle play/pause if clicking inside the scrubber bar or on interactive controls/links
      if (
        target.closest('.video-scrubber-overlay') ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('.video-character-pill-overlay') ||
        target.closest('.video-subtitles-overlay')
      ) {
        return;
      }
      this.togglePlayPause();
    });

    // Minimalist Focus Mode Toggle
    this.container.querySelector('#stageFocusModeBtn')?.addEventListener('click', () => {
      soundEffects.playKeyClick();
      document.body.classList.toggle('minimalist-focus-mode');

      // Add or remove floating exit button
      const existingExit = document.getElementById('minimalistExitBtn');
      if (document.body.classList.contains('minimalist-focus-mode')) {
        if (!existingExit) {
          const exitBtn = document.createElement('button');
          exitBtn.id = 'minimalistExitBtn';
          exitBtn.className = 'minimalist-exit-badge';
          exitBtn.setAttribute('aria-label', 'Oddiy rejimga qaytish');
          exitBtn.innerHTML = '<i class="ph ph-corners-in" aria-hidden="true"></i> <span>Oddiy rejimga qaytish</span>';
          exitBtn.addEventListener('click', () => {
            soundEffects.playKeyClick();
            document.body.classList.remove('minimalist-focus-mode');
            exitBtn.remove();
          });
          document.body.appendChild(exitBtn);
        }
      } else {
        existingExit?.remove();
      }
    });

    // Play / Pause / Replay current segment
    this.container.querySelector('#stageReplayBtn')?.addEventListener('click', () => {
      this.togglePlayPause();
    });

    // Previous sentence
    this.container.querySelector('#stagePrevBtn')?.addEventListener('click', () => {
      this.onPrevSentenceRequest?.();
    });

    // Next sentence
    this.container.querySelector('#stageNextBtn')?.addEventListener('click', () => {
      this.onNextSentenceRequest?.();
    });

    // -2s Rewind
    this.container.querySelector('#stageRewind2sBtn')?.addEventListener('click', () => {
      this.seekRelative(-2);
    });

    // +2s Forward
    this.container.querySelector('#stageForward2sBtn')?.addEventListener('click', () => {
      this.seekRelative(2);
    });

    // Tab buttons
    const tabBtns = this.container.querySelectorAll('.player-tab-pill');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as 'description' | 'materials' | 'task' | 'highscores';
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Share lesson / challenge friend
    const shareBtn = this.container.querySelector('#shareLessonBtn');
    shareBtn?.addEventListener('click', () => {
      this.onChallengeRequest?.();
    });
    shareBtn?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        this.onChallengeRequest?.();
      }
    });

    // Timeline track click
    const timelineTrack = this.container.querySelector('#videoTimelineTrack');
    const seekByRatio = (ratio: number): void => {
      if (!this.currentScene) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      const targetTime = clamped * this.getTotalDuration();

      const sentenceIdx = this.currentScene.dialogues.findIndex(
        d => targetTime >= d.startTime - 0.5 && targetTime <= d.endTime + 0.5
      );
      if (sentenceIdx >= 0) {
        this.onSeekToSentence?.(sentenceIdx);
      }
    };
    timelineTrack?.addEventListener('click', (e) => {
      if (!this.currentScene) return;
      const rect = (timelineTrack as HTMLElement).getBoundingClientRect();
      const clickX = (e as MouseEvent).clientX - rect.left;
      seekByRatio(clickX / rect.width);
    });
    // Keyboard: arrows seek between replicas on the slider track
    timelineTrack?.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'ArrowLeft') {
        e.preventDefault();
        this.onPrevSentenceRequest?.();
      } else if (ke.key === 'ArrowRight') {
        e.preventDefault();
        this.onNextSentenceRequest?.();
      } else if (ke.key === 'Enter' || ke.key === ' ') {
        e.preventDefault();
        this.onReplayRequest?.();
      }
    });

    // Speed selection (chips are rendered with the .yt-speed-chip class)
    const speedChips = this.container.querySelectorAll('.yt-speed-chip');
    speedChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const newSpeed = parseFloat(target.dataset.speed || '1.0');
        this.speed = newSpeed;
        speechService.setSpeed(newSpeed);
        if (this.videoElement) {
          this.videoElement.playbackRate = newSpeed;
        }
        if (this.ytIframeElement) {
          const rateMsg = JSON.stringify({
            event: 'command',
            func: 'setPlaybackRate',
            args: [newSpeed]
          });
          this.ytIframeElement.contentWindow?.postMessage(rateMsg, '*');
        }
        this.render();
        this.onSpeedChange?.(newSpeed);
        this.onReplayRequest?.();
      });
    });

  }

  private renderHighScoresTabHtml(): string {
    if (!this.currentScene) return '';
    const t = i18n.t();
    const top3 = storageService.getSceneHighScores(this.currentScene.id);

    if (top3.length === 0) {
      return `
        <div class="highscores-empty-state">
          <div class="hs-empty-icon"><i class="ph ph-trophy"></i></div>
          <h4 class="hs-empty-title">${t.noHighScoresYet}</h4>
          <p class="hs-empty-sub">Ushbu videoni eng birinchi bo‘lib xatosiz yozib tugating va 1-o‘rinni egallang!</p>
        </div>
      `;
    }

    const rankBadges = [
      { icon: '🥇', label: t.firstPlace, cls: 'rank-gold', color: '#EAB308' },
      { icon: '🥈', label: t.secondPlace, cls: 'rank-silver', color: '#94A3B8' },
      { icon: '🥉', label: t.thirdPlace, cls: 'rank-bronze', color: '#D97706' }
    ];

    return `
      <div class="community-highscores-wrapper">
        <div class="highscores-header-info">
          <div class="hs-header-title-wrap">
            <i class="ph ph-trophy-fill" style="color: #F59E0B; font-size: 1.25rem;"></i>
            <h4 class="highscores-heading">${t.highScoresTitle}</h4>
          </div>
          <span class="hs-scene-name">${escapeHtml(this.currentScene.title)}</span>
        </div>

        <div class="highscores-podium-list">
          ${top3.map((record, index) => {
            const badge = rankBadges[index] || rankBadges[0];
            const dateStr = new Date(record.completedAt).toLocaleDateString();
            const minutes = Math.floor(record.timeSpentSeconds / 60);
            const seconds = record.timeSpentSeconds % 60;
            const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            return `
              <div class="highscore-podium-card ${badge.cls}">
                <div class="hs-card-left">
                  <div class="hs-rank-medal" title="${badge.label}">
                    <span class="medal-emoji">${badge.icon}</span>
                    <span class="medal-rank-num">#${index + 1}</span>
                  </div>
                  <div class="hs-user-meta">
                    <div class="hs-user-name-row">
                      <span class="hs-user-name">${escapeHtml(record.userName)}</span>
                      <span class="hs-user-handle">${escapeHtml(record.userHandle)}</span>
                    </div>
                    <span class="hs-date">${dateStr}</span>
                  </div>
                </div>

                <div class="hs-card-stats-cluster">
                  <div class="hs-stat-item">
                    <span class="hs-stat-val accuracy">${record.accuracy}%</span>
                    <span class="hs-stat-lbl">${t.accuracyLabel}</span>
                  </div>
                  <div class="hs-stat-item">
                    <span class="hs-stat-val wpm">${record.wpm} <small>wpm</small></span>
                    <span class="hs-stat-lbl">${t.speedWpmLabel}</span>
                  </div>
                  <div class="hs-stat-item">
                    <span class="hs-stat-val time">${timeFormatted}</span>
                    <span class="hs-stat-lbl">${t.timeSpentLabel}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

