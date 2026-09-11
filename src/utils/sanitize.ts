import DOMPurify from 'dompurify';

/**
 * Escapes HTML characters to prevent XSS injection in strings inserted into innerHTML
 */
export function escapeHtml(str: unknown): string {
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
const URL_CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

function decodeUrlPayload(input: string): string {
  let current = input;
  for (let pass = 0; pass < 3; pass++) {
    let decoded = current;
    if (decoded.includes('%')) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {}
    }
    if (typeof document !== 'undefined' && /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/.test(decoded)) {
      try {
        const decoder = document.createElement('textarea');
        decoder.innerHTML = decoded;
        decoded = decoder.value;
      } catch {}
    }
    decoded = decoded.replace(URL_CONTROL_CHARS, '');
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const cleaned = decodeUrlPayload(url.trim().replace(URL_CONTROL_CHARS, ''));
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('ftp:')
  ) {
    return '';
  }
  if (
    cleaned.startsWith('https://') ||
    cleaned.startsWith('http://') ||
    cleaned.startsWith('/') ||
    cleaned.startsWith('blob:')
  ) {
    return escapeHtml(cleaned);
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
