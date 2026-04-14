/**
 * HTML sanitizer for user-generated content using DOMPurify.
 * Removes dangerous tags, event handlers, and XSS vectors.
 */
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr', 'sup', 'sub', 'small',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
      'class', 'style', 'id', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  })
}
