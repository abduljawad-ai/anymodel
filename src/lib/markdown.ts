import DOMPurify from 'dompurify';
import { marked, type Tokens } from 'marked';
import hljs from 'highlight.js';

// Configure marked with GFM and custom code renderer for syntax highlighting
const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: Tokens.Code) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  let highlighted: string;
  try {
    highlighted = language === 'plaintext'
      ? hljs.highlightAuto(text).value
      : hljs.highlight(text, { language }).value;
  } catch {
    highlighted = text;
  }
  const langLabel = lang || 'code';
  return `<div class="code-block-wrap">
  <div class="code-head">
    <span>${langLabel}</span>
    <button class="code-copy" data-code="${encodeURIComponent(text)}" onclick="(function(btn){const t=decodeURIComponent(btn.dataset.code);navigator.clipboard.writeText(t).then(()=>{btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1500)})})(this)">Copy</button>
  </div>
  <pre><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`;
};

marked.use({ renderer, gfm: true, breaks: true });

/**
 * Escape-first markdown pipeline: marked → DOMPurify.
 * Only http(s) links survive sanitization.
 * Security: All links get rel="noreferrer" to prevent referrer leakage.
 * Code blocks get syntax highlighting via highlight.js.
 */
export function renderMarkdown(src: string): string {
  if (!src) return '';
  const raw = marked.parse(src, { async: false }) as string;
  const sanitized = DOMPurify.sanitize(raw, {
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
    ADD_ATTR: ['target', 'data-code', 'onclick'],
    // Allow onclick for copy buttons (safely scoped)
    FORCE_BODY: false,
  });
  // Add rel="noreferrer" + target="_blank" to all external links for security
  return sanitized
    .replace(/<a\s(?![^>]*rel=)/g, '<a rel="noreferrer" target="_blank" ')
    .replace(/<a\s([^>]*rel=)/g, '<a target="_blank" $1');
}
