import { describe, it, expect } from 'vitest';
import { normalizeWord, splitIntoWords, evaluateDictation, getNextHint } from '@/utils/stringDiff';

describe('normalizeWord', () => {
  it('should convert to lowercase', () => {
    expect(normalizeWord('HELLO')).toBe('hello');
  });
  it('should remove punctuation', () => {
    expect(normalizeWord('hello!')).toBe('hello');
  });
  it('should remove commas and periods', () => {
    expect(normalizeWord('hello, world.')).toBe('hello world');
  });
  it('should trim whitespace', () => {
    expect(normalizeWord('  hello  ')).toBe('hello');
  });
  it('should handle empty string', () => {
    expect(normalizeWord('')).toBe('');
  });
  it('should remove special characters', () => {
    // normalizeWord's strip set covers #$% etc. but intentionally keeps '@'.
    expect(normalizeWord('test#$%')).toBe('test');
  });
  it('should handle apostrophes', () => {
    expect(normalizeWord("don't")).toBe('dont');
  });
  it('should handle quotes', () => {
    expect(normalizeWord('"hello"')).toBe('hello');
  });
});

describe('splitIntoWords', () => {
  it('should split text into words', () => {
    expect(splitIntoWords('hello world')).toEqual(['hello', 'world']);
  });
  it('should filter empty strings', () => {
    expect(splitIntoWords('hello   world')).toEqual(['hello', 'world']);
  });
  it('should trim input', () => {
    expect(splitIntoWords('  hello world  ')).toEqual(['hello', 'world']);
  });
  it('should return empty array for empty string', () => {
    expect(splitIntoWords('')).toEqual([]);
  });
  it('should handle single word', () => {
    expect(splitIntoWords('hello')).toEqual(['hello']);
  });
});

describe('evaluateDictation', () => {
  it('should return correct feedback for perfect match', () => {
    const result = evaluateDictation('hello world', 'hello world');
    expect(result.isComplete).toBe(true);
    expect(result.accuracy).toBe(100);
    expect(result.errorsCount).toBe(0);
  });
  it('should count incorrect words', () => {
    const result = evaluateDictation('hello foo', 'hello world');
    expect(result.isComplete).toBe(false);
    expect(result.errorsCount).toBe(1);
    expect(result.accuracy).toBe(50);
  });
  it('should mark missing words', () => {
    const result = evaluateDictation('hello', 'hello world');
    expect(result.isComplete).toBe(false);
    const missing = result.userTokens.filter(t => t.status === 'missing');
    expect(missing.length).toBe(1);
  });
  it('should mark extra words', () => {
    const result = evaluateDictation('hello world extra', 'hello world');
    expect(result.isComplete).toBe(false);
    const extra = result.userTokens.filter(t => t.status === 'extra');
    expect(extra.length).toBe(1);
  });
  it('should return 0 accuracy for empty target', () => {
    const result = evaluateDictation('hello', '');
    expect(result.accuracy).toBe(0);
  });
  it('should handle empty user input', () => {
    const result = evaluateDictation('', 'hello world');
    expect(result.isComplete).toBe(false);
    expect(result.userTokens.length).toBe(2);
    expect(result.userTokens.every(t => t.status === 'missing')).toBe(true);
  });
  it('should normalize punctuation in comparison', () => {
    const result = evaluateDictation('hello, world!', 'hello world');
    expect(result.isComplete).toBe(true);
    expect(result.accuracy).toBe(100);
  });
  it('should handle case insensitivity', () => {
    const result = evaluateDictation('Hello World', 'hello world');
    expect(result.isComplete).toBe(true);
    expect(result.accuracy).toBe(100);
  });
  it('should return correct token structure', () => {
    const result = evaluateDictation('test', 'test');
    expect(result.userTokens[0]).toHaveProperty('word');
    expect(result.userTokens[0]).toHaveProperty('isCorrect');
    expect(result.userTokens[0]).toHaveProperty('expectedWord');
    expect(result.userTokens[0]).toHaveProperty('status');
  });
  it('should handle partial match', () => {
    const result = evaluateDictation('hello', 'hello world test');
    expect(result.isComplete).toBe(false);
    expect(result.userTokens.length).toBe(3);
  });
});

describe('getNextHint', () => {
  it('should return hint for incorrect word', () => {
    const result = getNextHint('hello foo', 'hello world');
    expect(result).not.toBeNull();
    expect(result!.hintWord).toBe('world');
    expect(result!.index).toBe(1);
  });
  it('should return null for perfect match', () => {
    const result = getNextHint('hello world', 'hello world');
    expect(result).toBeNull();
  });
  it('should return hint for missing word', () => {
    const result = getNextHint('hello', 'hello world');
    expect(result).not.toBeNull();
    expect(result!.hintWord).toBe('world');
  });
  it('should return partial hint for long words', () => {
    const result = getNextHint('', 'beautiful');
    expect(result).not.toBeNull();
    expect(result!.partialHint).toBe('be...');
  });
  it('should return partial hint for short words', () => {
    const result = getNextHint('', 'it');
    expect(result).not.toBeNull();
    expect(result!.partialHint).toBe('i...');
  });
});
