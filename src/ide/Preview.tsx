import { useMemo } from 'react';

/**
 * Sandboxed live preview. HTML renders as-is; CSS/JS are wrapped in a minimal
 * host document. No network access, no same-origin — `allow-scripts` only.
 */
export function srcdocFor(code: string, language: string): string {
  const lang = language.toLowerCase();
  if (lang.includes('html')) return code;
  if (lang.includes('css')) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head>
<body><div id="app"><h1>Heading</h1><p>Paragraph text — your CSS applies to this sample content.</p>
<button>Button</button> <a href="#">Link</a><input placeholder="Input" /></div></body></html>`;
  }
  // JS / JSON / other: run as script with a console mirror.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: monospace; font-size: 12px; padding: 10px; background: #fff; color: #111; }
.log { border-bottom: 1px solid #eee; padding: 3px 0; white-space: pre-wrap; }
</style></head><body><div id="out"></div><script>
const out = document.getElementById('out');
const write = (cls, args) => { const d = document.createElement('div'); d.className = 'log ' + cls;
  d.textContent = args.map(a => { try { return typeof a === 'object' ? JSON.stringify(a, null, 1) : String(a); } catch { return String(a); } }).join(' ');
  out.appendChild(d); };
['log','info','warn','error'].forEach(k => { const orig = console[k]; console[k] = (...a) => { write(k, a); orig && orig(...a); }; });
window.onerror = (m) => write('error', [m]);
try { ${lang.includes('json') ? `console.log(JSON.parse(${JSON.stringify(code)}))` : code} } catch (e) { write('error', [e.message]); }
</script></body></html>`;
}

export function Preview({ code, language }: { code: string; language: string }) {
  const srcdoc = useMemo(() => srcdocFor(code, language), [code, language]);
  return (
    <iframe
      className="ide-preview-frame"
      title="Live preview"
      sandbox="allow-scripts allow-modals"
      srcDoc={srcdoc}
    />
  );
}
