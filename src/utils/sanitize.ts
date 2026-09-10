import DOMPurify from 'dompurify';

/**
 * Escapes HTML characters to prevent XSS injection in strings inserted into innerHTML
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes rich HTML string using DOMPurify
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'span', 'strong', 'em', 'b', 'i', 'u', 'p', 'div',
      'mark', 'kbd', 'code', 'br', 'hr', 'small', 'sub', 'sup'
    ],
    ALLOWED_ATTR: ['class', 'style', 'title', 'data-word', 'data-scene-id', 'data-index']
  });
}

/**
 * Validates and sanitizes URLs to prevent javascript: or malicious URI schemes
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  ) {
    return escapeHtml(trimmed);
  }
  return '';
}

/**
 * Strict allowlist of permitted third-party video embed origins
 */
export const ALLOWED_VIDEO_EMBED_DOMAINS = [
  'https://www.youtube-nocookie.com',
] as const;

/**
 * Validates YouTube 11-character video ID format (/^[a-zA-Z0-9_-]{11}$/)
 */
export function isValidYouTubeVideoId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

/**
 * Securely constructs a sandboxed YouTube embed URL strictly from the allowed domain
 */
export function buildSecureYouTubeEmbedUrl(videoId: unknown, clientOrigin?: string): string | null {
  if (!isValidYouTubeVideoId(videoId)) {
    return null;
  }
  const cleanId = videoId.trim();
  const rawOrigin = clientOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  const originParam = rawOrigin ? `&origin=${encodeURIComponent(rawOrigin)}` : '';
  const baseDomain = ALLOWED_VIDEO_EMBED_DOMAINS[0];
  return `${baseDomain}/embed/${encodeURIComponent(cleanId)}?enablejsapi=1&autoplay=0&controls=0&modestbranding=1&rel=0&playsinline=1${originParam}`;
}
