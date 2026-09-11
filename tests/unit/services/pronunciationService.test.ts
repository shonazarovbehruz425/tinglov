import { describe, it, expect } from 'vitest';
import {
  evaluatePronunciation,
  cleanSpokenText
} from '@/services/pronunciationService';

describe('cleanSpokenText', () => {
  it('should convert to lowercase', () => {
    expect(cleanSpokenText('HELLO')).toBe('hello');
  });
  it('should remove punctuation', () => {
    expect(cleanSpokenText('hello!')).toBe('hello');
  });
  // FIXED APP BUG: the strip class used to contain a duplicated '!' but no
  // apostrophe, so "don't" kept its apostrophe and never matched the
  // contraction map keys ("dont", "im", ...). Both the ASCII apostrophe and
  // the curly U+2019 (normalized to ' first) must now be stripped.
  it('should remove apostrophes', () => {
    expect(cleanSpokenText("don't")).toBe('dont');
  });
  it('should remove curly apostrophes (U+2019)', () => {
    expect(cleanSpokenText('don’t')).toBe('dont');
  });
  it('should strip mixed punctuation and apostrophes together', () => {
    expect(cleanSpokenText('Wait, what? "I can\'t" believe it!')).toBe('wait what i cant believe it');
  });
  it('should trim whitespace', () => {
    expect(cleanSpokenText('  hello  ')).toBe('hello');
  });
  it('should handle empty string', () => {
    expect(cleanSpokenText('')).toBe('');
  });
  it('should remove multiple punctuation marks', () => {
    expect(cleanSpokenText('hello, world!')).toBe('hello world');
  });
});

describe('evaluatePronunciation — apostrophe fix end to end', () => {
  it('should score "don\'t" vs "dont" as a perfect match after stripping', () => {
    const result = evaluatePronunciation("I don't know", 'I dont know', 1.2);
    expect(result.accuracyScore).toBe(100);
    expect(result.words.every(w => w.similarity === 100)).toBe(true);
  });
  it('should treat curly apostrophes the same as ASCII ones', () => {
    const result = evaluatePronunciation('don’t', "don't", 0.6);
    expect(result.words[0].similarity).toBe(100);
    expect(result.words[0].status).toBe('perfect');
  });
});

describe('evaluatePronunciation', () => {
  it('should return perfect score for exact match', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(result.overallScore).toBeGreaterThanOrEqual(88);
    expect(result.verdict).toBe('Mukammal! 🌟');
  });
  it('should return accuracy score based on words', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(result.accuracyScore).toBe(100);
  });
  it('should return missed verdict for empty spoken text', () => {
    const result = evaluatePronunciation('', 'hello world', 2.0);
    // The app's verdict strings (incl. its type union) use U+2018 'ko‘ring',
    // not an ASCII apostrophe.
    expect(result.verdict).toBe('Qayta urinib ko‘ring 🔄');
    expect(result.overallScore).toBeLessThan(50);
  });
  it('should return words array with correct length', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(result.words.length).toBe(2);
  });
  it('should mark words as correct for high similarity', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(result.words.every(w => w.isCorrect)).toBe(true);
  });
  it('should return durationSeconds', () => {
    const result = evaluatePronunciation('hello', 'hello', 3.0);
    expect(result.durationSeconds).toBe(3.0);
  });
  it('should return transcript', () => {
    const result = evaluatePronunciation('test spoken', 'hello world', 2.0);
    expect(result.transcript).toBe('test spoken');
  });
  it('should handle single word', () => {
    const result = evaluatePronunciation('hello', 'hello', 1.0);
    expect(result.words.length).toBe(1);
  });
  it('should return fluencyScore', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(result.fluencyScore).toBeGreaterThanOrEqual(0);
    expect(result.fluencyScore).toBeLessThanOrEqual(100);
  });
  it('should return accuracyScore', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(result.accuracyScore).toBeGreaterThanOrEqual(0);
    expect(result.accuracyScore).toBeLessThanOrEqual(100);
  });
  it('should handle different durations', () => {
    const result1 = evaluatePronunciation('hello world', 'hello world', 1.0);
    const result2 = evaluatePronunciation('hello world', 'hello world', 5.0);
    // Different fluency scores due to different durations
    expect(result1.fluencyScore).not.toBe(result2.fluencyScore);
  });
  it('should have feedbackUz string', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(typeof result.feedbackUz).toBe('string');
  });
  it('should have verdict string', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 2.0);
    expect(typeof result.verdict).toBe('string');
  });
  it('should handle misspelled words', () => {
    const result = evaluatePronunciation('helo wrld', 'hello world', 2.0);
    expect(result.overallScore).toBeLessThan(100);
    expect(result.words.length).toBe(2);
  });
  it('should return overallScore between 0 and 100', () => {
    const result = evaluatePronunciation('test', 'hello', 2.0);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
  it('should penalize fluency when speaking too slowly (speedRatio < 0.5)', () => {
    const result = evaluatePronunciation('hello world', 'hello world', 3.0);
    // expectedSeconds = 1.0, duration 3.0 → ratio ≈ 0.33 → penalized
    expect(result.fluencyScore).toBe(50);
    expect(result.accuracyScore).toBe(100);
  });
  it('should penalize fluency when rushing (speedRatio > 2.0)', () => {
    const result = evaluatePronunciation(
      'hello there beautiful world friend',
      'hello there beautiful world friend',
      0.5
    );
    // expectedSeconds = 2.25, duration 0.5 → ratio 4.5 → floored at 60
    expect(result.fluencyScore).toBe(60);
  });
  it('should keep full fluency when durationSeconds is 0 (guard branch)', () => {
    const result = evaluatePronunciation('ok', 'ok', 0);
    expect(result.fluencyScore).toBe(100);
    expect(result.durationSeconds).toBe(0);
  });
  it('should produce the "Juda yaxshi" verdict band', () => {
    const result = evaluatePronunciation('hello words', 'hello world', 3.0);
    expect(result.overallScore).toBeGreaterThanOrEqual(72);
    expect(result.overallScore).toBeLessThan(88);
    expect(result.verdict).toBe('Juda yaxshi! 👏');
  });
  it('should produce the "Yaxshi, yana ozgina" verdict band', () => {
    const result = evaluatePronunciation('hello xyz', 'hello world', 2.0);
    expect(result.overallScore).toBeGreaterThanOrEqual(50);
    expect(result.overallScore).toBeLessThan(72);
    expect(result.verdict).toBe('Yaxshi, yana ozgina! 👍');
  });
  it('should mark imperfect words with a pronunciation tip', () => {
    const result = evaluatePronunciation('hello words', 'hello world', 2.0);
    const imperfect = result.words.find(w => w.status === 'imperfect');
    expect(imperfect).toBeDefined();
    expect(imperfect?.tip).toContain('aniqroq talaffuz qiling');
  });
  it('should reward phonetic approximations (phone ≈ fone)', () => {
    const result = evaluatePronunciation('fone', 'phone', 0.8);
    expect(result.words[0].similarity).toBe(95);
    expect(result.words[0].isCorrect).toBe(true);
  });
  it('should score punctuation-only speech as 0 similarity', () => {
    const result = evaluatePronunciation('.', 'hello', 2.0);
    expect(result.words[0].similarity).toBe(0);
    expect(result.words[0].status).toBe('missed');
    expect(result.feedbackUz).toContain('Mikrofon');
  });
  it('should mark remaining target words missed when speech runs out', () => {
    const result = evaluatePronunciation('hello', 'hello world', 2.0);
    expect(result.words.length).toBe(2);
    expect(result.words[1].similarity).toBe(0);
    expect(result.words[1].spokenWord).toBe('');
    expect(result.words[1].status).toBe('missed');
  });
  it('should handle an empty target sentence without crashing', () => {
    const result = evaluatePronunciation('hello', '   ', 2.0);
    expect(result.words).toEqual([]);
    expect(result.accuracyScore).toBe(0);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});
