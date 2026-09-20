import { describe, it, expect } from 'vitest';
import { subtitleService } from '../../../src/services/subtitleService';

describe('SubtitleService', () => {
  describe('parseTimestampToSeconds', () => {
    it('parses SRT comma timestamps (HH:MM:SS,mmm)', () => {
      expect(subtitleService.parseTimestampToSeconds('00:01:23,456')).toBeCloseTo(83.456, 3);
      expect(subtitleService.parseTimestampToSeconds('01:00:00,000')).toBeCloseTo(3600, 3);
    });

    it('parses WebVTT dot timestamps (HH:MM:SS.mmm & MM:SS.mmm)', () => {
      expect(subtitleService.parseTimestampToSeconds('00:02:15.500')).toBeCloseTo(135.5, 3);
      expect(subtitleService.parseTimestampToSeconds('01:30.250')).toBeCloseTo(90.25, 3);
    });

    it('handles empty or malformed inputs gracefully', () => {
      expect(subtitleService.parseTimestampToSeconds('')).toBe(0);
      expect(subtitleService.parseTimestampToSeconds('invalid')).toBe(0);
    });
  });

  describe('cleanSubtitleText', () => {
    it('removes HTML tags and WebVTT styling', () => {
      const result = subtitleService.cleanSubtitleText('<i>Hello</i> <b>world</b> <c.yellow>friend</c>');
      expect(result.text).toBe('Hello world friend');
    });

    it('extracts speaker names and separates dialogue', () => {
      const result = subtitleService.cleanSubtitleText('WEDNESDAY: I find social media to be a void.');
      expect(result.character).toBe('WEDNESDAY');
      expect(result.text).toBe('I find social media to be a void.');
    });

    it('removes non-speech noise cues ([Music], ♪, [Laughter])', () => {
      const result = subtitleService.cleanSubtitleText('[Dramatic Music] ♪ Stay hungry, stay foolish. ♪ [Applause]');
      expect(result.text).toBe('Stay hungry, stay foolish.');
    });
  });

  describe('parseSubtitles', () => {
    it('parses standard SRT format correctly', () => {
      const srt = `
1
00:00:01,500 --> 00:00:04,200
I am honored to be with you today.

2
00:00:05,000 --> 00:00:08,800
STEVE: Stay hungry, stay foolish.
`;
      const parsed = subtitleService.parseSubtitles(srt);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].startTime).toBeCloseTo(1.5, 2);
      expect(parsed[0].endTime).toBeCloseTo(4.2, 2);
      expect(parsed[0].duration).toBeCloseTo(2.7, 2);
      expect(parsed[0].text).toBe('I am honored to be with you today.');

      expect(parsed[1].startTime).toBeCloseTo(5.0, 2);
      expect(parsed[1].endTime).toBeCloseTo(8.8, 2);
      expect(parsed[1].character).toBe('STEVE');
      expect(parsed[1].text).toBe('Stay hungry, stay foolish.');
    });

    it('parses WebVTT format correctly and ignores header metadata', () => {
      const vtt = `WEBVTT - Sample File
NOTE This is a commentary note

00:00.500 --> 00:03.000 line:80%
<v Wednesday>It is quiet here.

00:04.000 --> 00:06.500
[Suspenseful Music]
`;
      const parsed = subtitleService.parseSubtitles(vtt);
      // The second cue had only [Suspenseful Music] which gets cleaned to empty and skipped
      expect(parsed).toHaveLength(1);
      expect(parsed[0].startTime).toBeCloseTo(0.5, 2);
      expect(parsed[0].endTime).toBeCloseTo(3.0, 2);
      expect(parsed[0].character).toBe('Wednesday');
      expect(parsed[0].text).toBe('It is quiet here.');
    });
  });

  describe('optimizeForLearning', () => {
    it('merges rapid short fragments from the same speaker', () => {
      const entries = [
        { index: 1, startTime: 1.0, endTime: 2.0, duration: 1.0, character: 'John', text: 'I think' },
        { index: 2, startTime: 2.2, endTime: 4.5, duration: 2.3, character: 'John', text: 'we should go.' },
      ];
      const optimized = subtitleService.optimizeForLearning(entries);
      expect(optimized).toHaveLength(1);
      expect(optimized[0].startTime).toBe(1.0);
      expect(optimized[0].endTime).toBe(4.5);
      expect(optimized[0].text).toBe('I think we should go.');
    });
  });
});
