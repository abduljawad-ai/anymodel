import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Escape-first markdown pipeline: marked → DOMPurify.
 * Only http(s) links survive sanitization.
 * Security: All links get rel="noreferrer" to prevent referrer leakage.
 */
export function renderMarkdown(src: string): string {
  const raw = marked.parse(src ?? '', { async: false }) as string;
  const sanitized = DOMPurify.sanitize(raw, {
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
    ADD_ATTR: ['target'],
  });
  // Add rel="noreferrer" to all external links for security
  return sanitized.replace(/<a\s/g, '<a rel="noreferrer" ');
}
