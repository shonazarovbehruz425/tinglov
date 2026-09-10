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
