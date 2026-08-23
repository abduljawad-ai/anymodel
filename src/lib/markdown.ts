import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Escape-first markdown pipeline: marked → DOMPurify.
 * Only http(s) links survive sanitization.
 */
export function renderMarkdown(src: string): string {
  const raw = marked.parse(src ?? '', { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
    ADD_ATTR: ['target'],
  });
}
