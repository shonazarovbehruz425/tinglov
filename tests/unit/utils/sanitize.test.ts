import { describe, it, expect, vi } from 'vitest';

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((dirty: string) => {
      return dirty.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
    }),
  },
}));

import { escapeHtml, sanitizeHtml, sanitizeUrl, isValidYouTubeVideoId, buildSecureYouTubeEmbedUrl, ALLOWED_VIDEO_EMBED_DOMAINS } from '@/utils/sanitize';

describe('escapeHtml', () => {
  it('should escape ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });
  it('should escape less than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
  it('should escape greater than', () => {
    expect(escapeHtml('>test<')).toBe('&gt;test&lt;');
  });
  it('should escape double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });
  it('should escape single quotes', () => {
    expect(escapeHtml("'hello'")).toBe('&#039;hello&#039;');
  });
  it('should return empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });
  it('should return empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });
  it('should convert numbers to string', () => {
    expect(escapeHtml(123)).toBe('123');
  });
  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
  it('should handle mixed content', () => {
    expect(escapeHtml('<div class="test">hello & world</div>')).toBe('&lt;div class=&quot;test&quot;&gt;hello &amp; world&lt;/div&gt;');
  });
});

describe('sanitizeHtml', () => {
  it('should return empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
  it('should return empty string for falsy input', () => {
    expect(sanitizeHtml(null as any)).toBe('');
  });
  it('should sanitize using DOMPurify', () => {
    const result = sanitizeHtml('<p>hello</p>');
    expect(typeof result).toBe('string');
  });
  it('should allow span tags', () => {
    const result = sanitizeHtml('<span>text</span>');
    expect(result).toContain('span');
  });
  it('should allow strong tags', () => {
    const result = sanitizeHtml('<strong>bold</strong>');
    expect(result).toContain('strong');
  });
  it('should allow em tags', () => {
    const result = sanitizeHtml('<em>italic</em>');
    expect(result).toContain('em');
  });
  it('should allow mark tags', () => {
    const result = sanitizeHtml('<mark>highlight</mark>');
    expect(result).toContain('mark');
  });
  it('should allow code tags', () => {
    const result = sanitizeHtml('<code>code</code>');
    expect(result).toContain('code');
  });
  it('should allow br tags', () => {
    const result = sanitizeHtml('<br>');
    expect(result).toContain('br');
  });
  it('should allow hr tags', () => {
    const result = sanitizeHtml('<hr>');
    expect(result).toContain('hr');
  });
  it('should allow small tags', () => {
    const result = sanitizeHtml('<small>small</small>');
    expect(result).toContain('small');
  });
});

describe('sanitizeUrl', () => {
  it('should return empty string for null', () => {
    expect(sanitizeUrl(null)).toBe('');
  });
  it('should return empty string for undefined', () => {
    expect(sanitizeUrl(undefined)).toBe('');
  });
  it('should allow https URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });
  it('should allow http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });
  it('should allow relative URLs', () => {
    expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
  });
  it('should allow blob URLs', () => {
    expect(sanitizeUrl('blob:https://example.com/xxx')).toBe('blob:https://example.com/xxx');
  });
  it('should reject javascript URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });
  it('should reject data URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });
  it('should trim whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });
  it('should return empty string for empty string', () => {
    expect(sanitizeUrl('')).toBe('');
  });
});

describe('isValidYouTubeVideoId', () => {
  it('should return true for valid 11-char ID', () => {
    expect(isValidYouTubeVideoId('dQw4w9WgXcQ')).toBe(true);
  });
  it('should return true for ID with hyphens and underscores', () => {
    // YouTube video IDs are exactly 11 chars of [A-Za-z0-9_-]; the old
    // fixture 'abc-def_12345' was 13 chars and correctly rejected.
    expect(isValidYouTubeVideoId('abc-def_123')).toBe(true);
  });
  it('should return false for too short ID', () => {
    expect(isValidYouTubeVideoId('abc123')).toBe(false);
  });
  it('should return false for too long ID', () => {
    expect(isValidYouTubeVideoId('abc1234567890')).toBe(false);
  });
  it('should return false for non-string input', () => {
    expect(isValidYouTubeVideoId(12345 as any)).toBe(false);
  });
  it('should return false for empty string', () => {
    expect(isValidYouTubeVideoId('')).toBe(false);
  });
  it('should return false for ID with special chars', () => {
    expect(isValidYouTubeVideoId('abc!@#$%^&*')).toBe(false);
  });
  it('should trim whitespace', () => {
    expect(isValidYouTubeVideoId(' dQw4w9WgXcQ ')).toBe(true);
  });
});

describe('buildSecureYouTubeEmbedUrl', () => {
  it('should return null for invalid video ID', () => {
    expect(buildSecureYouTubeEmbedUrl('invalid')).toBeNull();
  });
  it('should return null for non-string ID', () => {
    expect(buildSecureYouTubeEmbedUrl(123 as any)).toBeNull();
  });
  it('should return valid URL for valid ID', () => {
    const result = buildSecureYouTubeEmbedUrl('dQw4w9WgXcQ');
    expect(result).not.toBeNull();
    expect(result).toContain('youtube-nocookie.com');
    expect(result).toContain('dQw4w9WgXcQ');
  });
  it('should include origin param when provided', () => {
    const result = buildSecureYouTubeEmbedUrl('dQw4w9WgXcQ', 'https://example.com');
    expect(result).toContain('origin=');
  });
  it('should use window.location.origin when no clientOrigin', () => {
    const result = buildSecureYouTubeEmbedUrl('dQw4w9WgXcQ');
    // The origin is passed through encodeURIComponent, so assert the encoded form.
    expect(result).toContain('origin=http%3A%2F%2Flocalhost%3A3000');
  });
});

describe('ALLOWED_VIDEO_EMBED_DOMAINS', () => {
  it('should contain youtube-nocookie.com', () => {
    expect(ALLOWED_VIDEO_EMBED_DOMAINS).toContain('https://www.youtube-nocookie.com');
  });
  it('should have exactly one domain', () => {
    expect(ALLOWED_VIDEO_EMBED_DOMAINS).toHaveLength(1);
  });
});
