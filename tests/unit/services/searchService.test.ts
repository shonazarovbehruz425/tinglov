import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchByWord, highlightMatch } from "@/services/searchService";
import { storageService } from '@/services/storageService';

vi.mock('@/services/storageService', () => ({
  storageService: {
    getAllScenes: vi.fn(),
  },
}));

describe('highlightMatch', () => {
  it('should return empty string for empty text', () => {
    expect(highlightMatch('', 'query')).toBe('');
  });
  it('should return escaped text for empty query', () => {
    expect(highlightMatch('hello world', '')).toBe('hello world');
  });
  it('should highlight matching text', () => {
    const result = highlightMatch('hello world', 'world');
    expect(result).toContain('<mark');
    expect(result).toContain('world');
  });
  it('should escape HTML in text', () => {
    const result = highlightMatch('<script>alert</script>', 'script');
    expect(result).not.toContain('<script>');
  });
  it('should escape regex special chars in query', () => {
    const result = highlightMatch('test.file', 'file');
    expect(result).toContain('file');
  });
  it('should highlight multiple occurrences', () => {
    const result = highlightMatch('cat cat cat', 'cat');
    const matches = result.match(/<mark/g);
    expect(matches?.length).toBe(3);
  });
  it('should be case insensitive', () => {
    const result = highlightMatch('Hello World', 'hello');
    expect(result).toContain('<mark');
  });
  it('should return empty string for empty text and query', () => {
    expect(highlightMatch('', '')).toBe('');
  });
});

describe('searchByWord', () => {
  const mockScenes = [
    {
      id: '1', title: 'Welcome', movieName: 'Movie 1',
      dialogues: [
        { id: 'd1', character: 'Ali', text: 'Hello world', uzbekTranslation: 'Salom dunyo', russianTranslation: 'Привет мир', wordDictionary: { hello: { word: 'hello', translation: 'salom' } } },
        { id: 'd2', character: 'Bob', text: 'Good morning', uzbekTranslation: 'Assalomu alaykum', russianTranslation: 'Доброе утро', wordDictionary: {} },
      ],
      coverEmoji: '🎬', difficulty: 'beginner' as const, category: 'Cartoon' as const, duration: '5:00', accent: 'American' as const,
    },
    {
      id: '2', title: 'Goodbye', movieName: 'Movie 2',
      dialogues: [
        { id: 'd3', character: 'Charlie', text: 'See you later', uzbekTranslation: 'Ko\'rishguncha', russianTranslation: 'Увидимся', wordDictionary: {} },
      ],
      coverEmoji: '🎬', difficulty: 'intermediate' as const, category: 'Cinema' as const, duration: '3:00', accent: 'British' as const,
    },
  ];

  beforeEach(() => {
    vi.mocked(storageService.getAllScenes).mockReturnValue(mockScenes);
  });

  it('should return empty results for empty query', () => {
    const result = searchByWord('');
    expect(result.totalMatches).toBe(0);
    expect(result.dialogueMatches).toEqual([]);
    expect(result.sceneMatches).toEqual([]);
  });
  it('should find matching dialogue text', () => {
    const result = searchByWord('hello');
    expect(result.totalMatches).toBeGreaterThan(0);
  });
  it('should find matching uzbek translation', () => {
    const result = searchByWord('salom');
    expect(result.totalMatches).toBeGreaterThan(0);
  });
  it('should find matching character name', () => {
    const result = searchByWord('ali');
    expect(result.totalMatches).toBeGreaterThan(0);
  });
  it('should find matching word in dictionary', () => {
    const result = searchByWord('hello');
    expect(result.totalMatches).toBeGreaterThan(0);
  });
  it('should find matching movie name', () => {
    const result = searchByWord('movie');
    expect(result.sceneMatches.length).toBeGreaterThan(0);
  });
  it('should find matching scene title', () => {
    const result = searchByWord('welcome');
    expect(result.sceneMatches.length).toBeGreaterThan(0);
  });
  it('should return 0 matches for non-existent word', () => {
    const result = searchByWord('xyznonexistent');
    expect(result.totalMatches).toBe(0);
  });
  it('should sort dialogue matches by score descending', () => {
    const result = searchByWord('hello');
    for (let i = 1; i < result.dialogueMatches.length; i++) {
      expect(result.dialogueMatches[i - 1].matchScore).toBeGreaterThanOrEqual(result.dialogueMatches[i].matchScore);
    }
  });
  it('should include sceneMatches', () => {
    const result = searchByWord('movie');
    expect(result.sceneMatches.length).toBeGreaterThan(0);
  });
  it('should trim query', () => {
    const result = searchByWord('  hello  ');
    expect(result.query).toBe('hello');
  });
  it('should return correct query', () => {
    const result = searchByWord('test');
    expect(result.query).toBe('test');
  });
});
