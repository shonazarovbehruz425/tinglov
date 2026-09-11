/**
 * Voice Activity Detection (VAD) & Speech Segment Alignment Service
 *
 * Accurately detects where speech occurs in video/audio files while filtering
 * out background music, intro jingles, and ambient noise.
 *
 * Algorithm:
 * 1. Biquad Bandpass Filter (300 Hz - 3400 Hz):
 *    Isolates the human vocal formant band, stripping away sub-bass (<250Hz)
 *    and high percussion (>4000Hz) characteristic of music and sound effects.
 * 2. Short-Time Energy (RMS) + Zero-Crossing Rate (ZCR):
 *    Evaluates energy in 30ms-50ms sliding frames.
 * 3. Dynamic Modulation Index:
 *    Human speech features rapid syllable bursts and micro-pauses (high variance)
 *    unlike sustained chords or steady rhythms in music.
 * 4. Cluster & Hangover Smoothing:
 *    Merges micro-pauses within sentences (< 0.6s), rejects brief noise spikes (< 0.4s),
 *    and pads speech boundaries (+0.2s pre-roll, +0.35s post-roll) to preserve natural consonants.
 */

export interface SpeechSegment {
  startTime: number;
  endTime: number;
  duration: number;
  confidence: number;
}

export class AudioVadService {
  /**
   * Applies a digital 2nd-order Biquad Bandpass Filter to isolate speech frequencies.
   * Center frequency f0 = 1200 Hz, Q = 0.707 (covers ~300 Hz to 3500 Hz).
   */
  public applySpeechBandpassFilter(samples: Float32Array, sampleRate: number): Float32Array {
    const f0 = 1200;
    const Q = 0.707;
    const w0 = (2 * Math.PI * f0) / sampleRate;
    const alpha = Math.sin(w0) / (2 * Q);

    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;

    const norm_b0 = b0 / a0;
    const norm_b1 = b1 / a0;
    const norm_b2 = b2 / a0;
    const norm_a1 = a1 / a0;
    const norm_a2 = a2 / a0;

    const filtered = new Float32Array(samples.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = norm_b0 * x0 + norm_b1 * x1 + norm_b2 * x2 - norm_a1 * y1 - norm_a2 * y2;
      filtered[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }

    return filtered;
  }

  /**
   * Core VAD algorithm running on raw PCM Float32Array channel data.
   */
  public detectSpeechSegmentsFromChannelData(
    channelData: Float32Array,
    sampleRate: number,
    expectedCount: number = 0
  ): SpeechSegment[] {
    if (!channelData || channelData.length === 0 || sampleRate <= 0) {
      return [];
    }

    const totalDuration = channelData.length / sampleRate;
    if (totalDuration < 1.0) {
      return [{ startTime: 0, endTime: totalDuration, duration: totalDuration, confidence: 1.0 }];
    }

    // 1. Apply voice bandpass filter to suppress music bass and high percussion
    const filtered = this.applySpeechBandpassFilter(channelData, sampleRate);

    // 2. Frame-based analysis (50ms frames)
    const frameSize = Math.max(128, Math.floor(sampleRate * 0.05)); // 50ms
    const hopSize = Math.max(64, Math.floor(sampleRate * 0.025));  // 25ms overlap
    const numFrames = Math.floor((filtered.length - frameSize) / hopSize);

    if (numFrames <= 0) {
      return [{ startTime: 0, endTime: totalDuration, duration: totalDuration, confidence: 1.0 }];
    }

    const frameRms = new Float32Array(numFrames);
    const frameZcr = new Float32Array(numFrames);
    const frameTimes = new Float32Array(numFrames);

    let maxRms = 0;
    let sumRms = 0;

    for (let i = 0; i < numFrames; i++) {
      const offset = i * hopSize;
      let sumSq = 0;
      let zeroCrossings = 0;
      let prevSample = filtered[offset];

      for (let j = 1; j < frameSize; j++) {
        const s = filtered[offset + j];
        sumSq += s * s;
        if ((s >= 0 && prevSample < 0) || (s < 0 && prevSample >= 0)) {
          zeroCrossings++;
        }
        prevSample = s;
      }

      const rms = Math.sqrt(sumSq / frameSize);
      frameRms[i] = rms;
      frameZcr[i] = zeroCrossings / frameSize;
      frameTimes[i] = (offset + frameSize / 2) / sampleRate;

      if (rms > maxRms) maxRms = rms;
      sumRms += rms;
    }

    if (maxRms <= 0.0005) {
      // Audio is essentially silent
      return [];
    }

    const avgRms = sumRms / numFrames;

    // 3. Compute dynamic modulation index (speech syllables modulate rapidly, music chords sustain)
    const windowFrames = 10; // ~250ms window
    const speechScores = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
      let winMin = frameRms[i];
      let winMax = frameRms[i];
      const start = Math.max(0, i - windowFrames);
      const end = Math.min(numFrames, i + windowFrames);

      for (let w = start; w < end; w++) {
        if (frameRms[w] < winMin) winMin = frameRms[w];
        if (frameRms[w] > winMax) winMax = frameRms[w];
      }

      const dynamicRange = (winMax - winMin) / (winMax + 0.0001);
      const zcrFactor = Math.min(2.0, Math.max(0.4, frameZcr[i] * 12));

      // Human speech score combines bandpass energy, syllable modulation, and zero-crossing rate
      speechScores[i] = frameRms[i] * (0.4 + dynamicRange * 0.8) * zcrFactor;
    }

    // 4. Determine adaptive speech threshold
    const sortedScores = Array.from(speechScores).sort((a, b) => a - b);
    const noiseFloor = sortedScores[Math.floor(sortedScores.length * 0.25)];
    const upperPercentile = sortedScores[Math.floor(sortedScores.length * 0.85)];

    const threshold = Math.max(avgRms * 0.45, noiseFloor + (upperPercentile - noiseFloor) * 0.28);

    // 5. Detect active speech regions with hangover smoothing
    const rawSegments: Array<{ start: number; end: number }> = [];
    let inSpeech = false;
    let segStart = 0;
    let silentFrames = 0;
    const maxSilentFrames = Math.floor(0.55 / 0.025); // allow up to 550ms intra-sentence pauses

    for (let i = 0; i < numFrames; i++) {
      const isVoice = speechScores[i] >= threshold;

      if (isVoice) {
        if (!inSpeech) {
          inSpeech = true;
          segStart = frameTimes[i];
        }
        silentFrames = 0;
      } else if (inSpeech) {
        silentFrames++;
        if (silentFrames > maxSilentFrames) {
          const segEnd = frameTimes[Math.max(0, i - silentFrames)];
          if (segEnd - segStart >= 0.45) {
            rawSegments.push({ start: segStart, end: segEnd });
          }
          inSpeech = false;
          silentFrames = 0;
        }
      }
    }

    if (inSpeech) {
      const segEnd = frameTimes[numFrames - 1];
      if (segEnd - segStart >= 0.45) {
        rawSegments.push({ start: segStart, end: segEnd });
      }
    }

    // 6. Merge adjacent segments with brief pauses (< 0.8s)
    const mergedSegments: Array<{ start: number; end: number }> = [];
    for (const seg of rawSegments) {
      if (mergedSegments.length === 0) {
        mergedSegments.push({ ...seg });
      } else {
        const last = mergedSegments[mergedSegments.length - 1];
        if (seg.start - last.end <= 0.8) {
          last.end = Math.max(last.end, seg.end);
        } else {
          mergedSegments.push({ ...seg });
        }
      }
    }

    // 7. Add pre-roll (+0.2s) and post-roll (+0.35s) padding, clamp to duration
    const paddedSegments: SpeechSegment[] = mergedSegments
      .map(s => {
        const start = Math.max(0, Math.round((s.start - 0.2) * 10) / 10);
        const end = Math.min(totalDuration, Math.round((s.end + 0.35) * 10) / 10);
        const dur = Math.round((end - start) * 10) / 10;
        return {
          startTime: start,
          endTime: end,
          duration: dur,
          confidence: Math.min(1.0, Math.round((dur / 3.0) * 100) / 100)
        };
      })
      .filter(s => s.duration >= 0.7);

    // If expectedCount is provided, align segments
    if (expectedCount > 0) {
      return this.alignSegmentsToExpectedCount(paddedSegments, expectedCount, totalDuration);
    }

    return paddedSegments;
  }

  /**
   * Aligns detected speech segments to match the expected number of dialogue lines.
   */
  public alignSegmentsToExpectedCount(
    segments: SpeechSegment[],
    expectedCount: number,
    totalDuration: number
  ): SpeechSegment[] {
    if (expectedCount <= 0) return segments;

    if (segments.length === expectedCount) {
      return segments;
    }

    // If we detected MORE segments than expected dialogues:
    // Keep the most prominent / longest segments in chronological order
    if (segments.length > expectedCount) {
      const withIndex = segments.map((s, idx) => ({ ...s, originalIdx: idx }));
      withIndex.sort((a, b) => b.duration - a.duration);
      const topSelected = withIndex.slice(0, expectedCount);
      topSelected.sort((a, b) => a.startTime - b.startTime);
      return topSelected.map(({ originalIdx, ...rest }) => rest);
    }

    // If we detected FEWER segments than expected:
    // If we have at least 1 segment, subdivide the longest ones
    const result = [...segments];
    while (result.length < expectedCount && result.length > 0) {
      let longestIdx = 0;
      let maxDur = 0;
      for (let i = 0; i < result.length; i++) {
        if (result[i].duration > maxDur) {
          maxDur = result[i].duration;
          longestIdx = i;
        }
      }

      if (maxDur < 3.0) {
        break;
      }

      const target = result[longestIdx];
      const mid = Math.round(((target.startTime + target.endTime) / 2) * 10) / 10;
      const firstHalf: SpeechSegment = {
        startTime: target.startTime,
        endTime: Math.max(target.startTime + 1.0, mid - 0.2),
        duration: Math.round((mid - 0.2 - target.startTime) * 10) / 10,
        confidence: 0.85
      };
      const secondHalf: SpeechSegment = {
        startTime: mid,
        endTime: target.endTime,
        duration: Math.round((target.endTime - mid) * 10) / 10,
        confidence: 0.85
      };

      result.splice(longestIdx, 1, firstHalf, secondHalf);
    }

    // Fall back to intelligent distribution starting after intro if still fewer
    if (result.length < expectedCount) {
      const introDuration = Math.min(15, totalDuration * 0.15);
      const usableDuration = Math.max(10, totalDuration - introDuration);
      const step = usableDuration / expectedCount;

      const fallback: SpeechSegment[] = [];
      for (let i = 0; i < expectedCount; i++) {
        const s = Math.round((introDuration + i * step) * 10) / 10;
        const e = Math.round(Math.min(totalDuration, s + Math.min(step * 0.85, 6.0)) * 10) / 10;
        fallback.push({
          startTime: s,
          endTime: e,
          duration: Math.round((e - s) * 10) / 10,
          confidence: 0.7
        });
      }
      return fallback;
    }

    return result.slice(0, expectedCount);
  }

  /**
   * Decodes an AudioBuffer from an ArrayBuffer using native Web Audio API.
   */
  public async decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;

      const audioCtx = new AudioContextClass();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      try {
        await audioCtx.close();
      } catch {}
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Analyzes an uploaded video or audio File to detect speech intervals.
   */
  public async detectSpeechSegmentsFromFile(
    file: File | Blob,
    expectedCount: number = 0
  ): Promise<SpeechSegment[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.decodeAudio(arrayBuffer);
      if (!audioBuffer) return [];

      const channelData = audioBuffer.getChannelData(0);
      return this.detectSpeechSegmentsFromChannelData(channelData, audioBuffer.sampleRate, expectedCount);
    } catch {
      return [];
    }
  }

  /**
   * Analyzes audio from a blob URL or video source URL.
   */
  public async detectSpeechSegmentsFromUrl(
    url: string,
    expectedCount: number = 0
  ): Promise<SpeechSegment[]> {
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.decodeAudio(arrayBuffer);
      if (!audioBuffer) return [];

      const channelData = audioBuffer.getChannelData(0);
      return this.detectSpeechSegmentsFromChannelData(channelData, audioBuffer.sampleRate, expectedCount);
    } catch {
      return [];
    }
  }

  /**
   * Analyzes an HTMLVideoElement currently loaded in the DOM.
   * If the video src is a blob: URL or fetchable URL, it downloads the buffer and decodes.
   */
  public async detectSpeechSegmentsFromVideo(
    videoElement: HTMLVideoElement,
    expectedCount: number = 0
  ): Promise<SpeechSegment[]> {
    const src = videoElement.currentSrc || videoElement.src;
    if (!src) return [];

    try {
      const segments = await this.detectSpeechSegmentsFromUrl(src, expectedCount);
      if (segments.length > 0) {
        return segments;
      }
    } catch {
      // Ignore
    }

    // Fallback using duration estimation if audio cannot be decoded
    const totalDuration = videoElement.duration || 60;
    if (expectedCount > 0 && !isNaN(totalDuration) && totalDuration > 0) {
      const introOffset = totalDuration > 30 ? Math.min(16, totalDuration * 0.2) : 2.0;
      const activeWindow = totalDuration - introOffset;
      const step = activeWindow / expectedCount;

      const fallback: SpeechSegment[] = [];
      for (let i = 0; i < expectedCount; i++) {
        const start = Math.round((introOffset + i * step) * 10) / 10;
        const end = Math.round(Math.min(totalDuration, start + Math.min(step * 0.85, 6.0)) * 10) / 10;
        fallback.push({
          startTime: start,
          endTime: end,
          duration: Math.round((end - start) * 10) / 10,
          confidence: 0.6
        });
      }
      return fallback;
    }

    return [];
  }
}

export const audioVadService = new AudioVadService();
