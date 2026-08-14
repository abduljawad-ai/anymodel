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
  out = out.replace(/\['"]([^'"]+)\['"]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = /^https?:\/\//i.test(url) ? url.replace(/['"]/g, "&quot;") : "#";
    return `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
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
out = out.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, i) => {
  const cb = codeBlocks[parseInt(i,10)];
  const langClass = cb.lang ? ` class="language-${cb.lang}"` : "";
  const langLabel = cb.lang ? ` data-lang="${cb.lang}"` : "";
  return `<pre${langLabel}><button class="code-copy-btn">Copy</button><code${langClass}>${cb.code}</code></pre>`;
});

out = out.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, i) => {
  const cb = codeBlocks[parseInt(i,10)];
  const langClass = cb.lang ? ` class="language-${cb.lang}"` : "";
  const langLabel = cb.lang ? ` data-lang="${cb.lang}"` : "";
  return `<pre${langLabel}><button class="code-copy-btn">Copy</button><code${langClass}>${cb.code}</code></pre>`;
});

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

  // Wire up copy buttons
  container.querySelectorAll("pre .code-copy-btn").forEach(btn => {
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

// Expose globally
window.Markdown = {
  renderMarkdownish,
  enhanceCodeBlocks
};
