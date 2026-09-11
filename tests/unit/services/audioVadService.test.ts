import { describe, it, expect } from 'vitest';
import { audioVadService } from '../../../src/services/audioVadService';

describe('AudioVadService', () => {
  it('should return empty segments for empty or tiny channel data', () => {
    const empty = new Float32Array(0);
    const result = audioVadService.detectSpeechSegmentsFromChannelData(empty, 16000);
    expect(result).toEqual([]);
  });

  it('should filter low frequencies and detect speech bursts in synthetic audio', () => {
    const sampleRate = 16000;
    const durationSeconds = 10;
    const totalSamples = sampleRate * durationSeconds;
    const samples = new Float32Array(totalSamples);

    // 0s to 3s: Intro background music (continuous 80Hz bass hum + 5000Hz cymbal sizzle)
    for (let i = 0; i < sampleRate * 3; i++) {
      const t = i / sampleRate;
      samples[i] = 0.2 * Math.sin(2 * Math.PI * 80 * t) + 0.05 * Math.sin(2 * Math.PI * 5000 * t);
    }

    // 3.5s to 6s: Spoken dialogue (vocal formant 1000Hz with rapid modulation)
    for (let i = Math.floor(sampleRate * 3.5); i < Math.floor(sampleRate * 6); i++) {
      const t = i / sampleRate;
      const syllableEnv = 0.5 * (1 + Math.sin(2 * Math.PI * 4 * t)); // 4 Hz syllable rate
      samples[i] = syllableEnv * 0.4 * Math.sin(2 * Math.PI * 1000 * t);
    }

    // 6.5s to 9s: Another spoken sentence
    for (let i = Math.floor(sampleRate * 6.5); i < Math.floor(sampleRate * 9); i++) {
      const t = i / sampleRate;
      const syllableEnv = 0.5 * (1 + Math.sin(2 * Math.PI * 5 * t));
      samples[i] = syllableEnv * 0.4 * Math.sin(2 * Math.PI * 1200 * t);
    }

    const segments = audioVadService.detectSpeechSegmentsFromChannelData(samples, sampleRate, 2);

    expect(segments.length).toBe(2);
    // Speech segment 1 should start around 3.3s - 3.7s, well past the 0s-3s intro music
    expect(segments[0].startTime).toBeGreaterThanOrEqual(3.0);
    expect(segments[0].startTime).toBeLessThanOrEqual(4.0);
    expect(segments[0].endTime).toBeGreaterThanOrEqual(5.5);

    // Speech segment 2 should be around 6.3s - 9.2s
    expect(segments[1].startTime).toBeGreaterThanOrEqual(6.0);
    expect(segments[1].endTime).toBeGreaterThanOrEqual(8.5);
  });

  it('should align to expected dialogue count', () => {
    const sampleRate = 16000;
    const duration = 20;
    const samples = new Float32Array(sampleRate * duration);

    // Create 3 speech bursts
    for (let seg = 0; seg < 3; seg++) {
      const startSec = 4 + seg * 5;
      for (let i = Math.floor(sampleRate * startSec); i < Math.floor(sampleRate * (startSec + 2.5)); i++) {
        const t = i / sampleRate;
        samples[i] = 0.4 * Math.sin(2 * Math.PI * 1000 * t);
      }
    }

    const segments = audioVadService.detectSpeechSegmentsFromChannelData(samples, sampleRate, 3);
    expect(segments.length).toBe(3);
    expect(segments[0].startTime).toBeLessThan(segments[1].startTime);
    expect(segments[1].startTime).toBeLessThan(segments[2].startTime);
  });
});
