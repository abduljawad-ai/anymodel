/* ============================================================
   MARKDOWN — markdown rendering and code highlighting.
============================================================ */

/* ============================================================
   MARKDOWN RENDERING
============================================================ */

function renderMarkdownish(text){
  // Escape HTML first
  const esc = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // Extract fenced code blocks so they don't get mangled by inline rules
  const codeBlocks = [];
  let out = esc.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push({ lang: lang || "", code: code.replace(/\n$/,"") });
    return `\u0000CODEBLOCK${i}\u0000`;
  });

  // Headings: ### Title, ## Title, # Title
  out = out.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  out = out.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  out = out.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  out = out.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  out = out.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  out = out.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  out = out.replace(/^---+$/gm, "<hr>");
  out = out.replace(/^\*\*\*+$/gm, "<hr>");

  // Blockquotes
  out = out.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");

  // Bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  // Inline code (after extracting fenced blocks so they're safe)
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links [text](url) — only allow http/https, escape quotes
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = /^https?:\/\//i.test(url) ? url.replace(/["'<>]/g, "") : "#";
    const safeLabel = label.replace(/[<>]/g, "");
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  // Unordered lists
  out = out.replace(/(?:^|\n)((?:[\s]*[-*]\s+.+(?:\n|$))+)/g, (match, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^[\s]*[-*]\s+/, "")).map(l => `<li>${l}</li>`).join("");
    return `\n<ul>${items}</ul>\n`;
  });

  // Ordered lists
  out = out.replace(/(?:^|\n)((?:[\s]*\d+\.\s+.+(?:\n|$))+)/g, (match, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^[\s]*\d+\.\s+/, "")).map(l => `<li>${l}</li>`).join("");
    return `\n<ol>${items}</ol>\n`;
  });

  // Re-insert fenced code blocks with copy button
  out = out.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (match, i) => {
    const cb = codeBlocks[parseInt(i,10)];
    if(!cb) return match;   // placeholder without a real block — leave as-is
    const langClass = cb.lang ? ` class="language-${cb.lang}"` : "";
    const langLabel = cb.lang ? ` data-lang="${cb.lang}"` : "";
    return `<pre${langLabel}><button class="code-copy-btn" aria-label="Copy code">Copy</button><code${langClass}>${cb.code}</code></pre>`;
  });

  // Defense-in-depth: strip any tags/attributes/URLs that slipped past the
  // escape-first pipeline (e.g. javascript: links or stray event handlers).
  if(window.DOMPurify){
    out = window.DOMPurify.sanitize(out, {
      ALLOWED_TAGS: ["h1","h2","h3","h4","h5","h6","p","br","hr","strong","em","code","pre","blockquote","ul","ol","li","a","span","button","img","audio","table","thead","tbody","tr","th","td"],
      ALLOWED_ATTR: ["href","target","rel","class","data-lang","aria-label","src","controls"],
      ALLOW_DATA_ATTR: true
    });
  }

  return out;
}

/* ============================================================
   CODE HIGHLIGHTING
============================================================ */

function enhanceCodeBlocks(container){
  if(!container) return;

  // Highlight code blocks
  container.querySelectorAll("pre > code").forEach(codeEl => {
    try{
      if(window.hljs){
        if(codeEl.className && codeEl.className.indexOf("language-") !== -1){
          window.hljs.highlightElement(codeEl);
        } else {
          window.hljs.highlightElement(codeEl);
        }
      }
    }catch(e){ /* highlight.js not loaded — code still visible, just unstyled */ }
  });

  // Wire up copy buttons (guard against duplicate listeners from
  // repeated enhance passes over the same button element)
  container.querySelectorAll("pre .code-copy-btn").forEach(btn => {
    if(btn.dataset.wired) return;
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
        try{ document.execCommand("copy"); btn.textContent = "Copied!"; btn.classList.add("copied"); setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600); }catch(e2){}
        document.body.removeChild(ta);
      });
    });
  });
}

/* Debounced highlight: during streaming, renderMarkdownish runs on every
   token and re-tokenizing the whole bubble each time thrashes the main
   thread. Schedule the highlight instead, keyed per bubble element. */
function scheduleHighlight(container){
  if(!container) return;
  if(container._hlTimer) clearTimeout(container._hlTimer);
  container._hlTimer = setTimeout(() => {
    container._hlTimer = null;
    enhanceCodeBlocks(container);
  }, 150);
}

// Expose globally
window.Markdown = {
  renderMarkdownish,
  enhanceCodeBlocks,
  scheduleHighlight
};
