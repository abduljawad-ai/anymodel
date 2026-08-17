/**
 * Markdown rendering with code highlighting (lightweight, dependency-free).
 * Uses DOMPurify for sanitization and highlight.js from CDN if available.
 */

/**
 * Render a markdown-ish string to sanitized HTML.
 * Supports: code blocks, headings, blockquotes, bold/italic, inline code,
 * links (http/https only), lists, horizontal rules.
 */
export function renderMarkdownish(text) {
  const esc = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const codeBlocks = [];
  let out = esc.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push({ lang: lang || "", code: code.replace(/\n$/, "") });
    return `\u0000CODEBLOCK${i}\u0000`;
  });

  out = out.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  out = out.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  out = out.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  out = out.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  out = out.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  out = out.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  out = out.replace(/^---+$/gm, "<hr>");
  out = out.replace(/^\*\*\*+$/gm, "<hr>");
  out = out.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");

  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Only allow http/https links; escape quotes in URL
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = /^https?:\/\//i.test(url) ? url.replace(/["'<>]/g, "") : "#";
    const safeLabel = label.replace(/[<>]/g, "");
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  out = out.replace(/(?:^|\n)((?:[\s]*[-*]\s+.+(?:\n|$))+)/g, (match, block) => {
    const items = block.trim().split(/\n/)
      .map(l => l.replace(/^[\s]*[-*]\s+/, ""))
      .map(l => `<li>${l}</li>`)
      .join("");
    return `\n<ul>${items}</ul>\n`;
  });

  out = out.replace(/(?:^|\n)((?:[\s]*\d+\.\s+.+(?:\n|$))+)/g, (match, block) => {
    const items = block.trim().split(/\n/)
      .map(l => l.replace(/^[\s]*\d+\.\s+/, ""))
      .map(l => `<li>${l}</li>`)
      .join("");
    return `\n<ol>${items}</ol>\n`;
  });

  out = out.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (match, i) => {
    const cb = codeBlocks[parseInt(i, 10)];
    if (!cb) return match;
    const langClass = cb.lang ? ` class="language-${cb.lang}"` : "";
    const langLabel = cb.lang ? ` data-lang="${cb.lang}"` : "";
    return `<pre${langLabel}><button class="code-copy-btn" aria-label="Copy code">Copy</button><code${langClass}>${cb.code}</code></pre>`;
  });

  // Defense-in-depth: sanitize any tags/attributes that slipped through
  if (typeof window !== "undefined" && window.DOMPurify) {
    out = window.DOMPurify.sanitize(out, {
      ALLOWED_TAGS: ["h1","h2","h3","h4","h5","h6","p","br","hr","strong","em","code","pre",
                     "blockquote","ul","ol","li","a","span","button","img","audio",
                     "table","thead","tbody","tr","th","td"],
      ALLOWED_ATTR: ["href","target","rel","class","data-lang","aria-label","src","controls"],
      ALLOW_DATA_ATTR: true
    });
  }

  return out;
}

/**
 * Enhance code blocks inside a container: highlight.js syntax highlighting
 * and wire up copy-to-clipboard buttons (guarded against double-wiring).
 */
export function enhanceCodeBlocks(container) {
  if (!container) return;

  // Syntax highlighting
  container.querySelectorAll("pre > code").forEach(codeEl => {
    try {
      if (typeof window !== "undefined" && window.hljs) {
        window.hljs.highlightElement(codeEl);
      }
    } catch (e) { /* highlight.js not loaded — code still visible */ }
  });

  // Copy button wiring
  container.querySelectorAll("pre .code-copy-btn").forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      const codeEl = btn.parentElement.querySelector("code");
      const text = codeEl.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600);
      }).catch(() => {
        // Fallback for non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e2) {}
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600);
        document.body.removeChild(ta);
      });
    });
  });
}

/**
 * Debounced code-block enhancement — avoids re-tokenizing every token during streaming.
 */
export function scheduleHighlight(container) {
  if (!container) return;
  if (container._hlTimer) clearTimeout(container._hlTimer);
  container._hlTimer = setTimeout(() => {
    container._hlTimer = null;
    enhanceCodeBlocks(container);
  }, 150);
}
