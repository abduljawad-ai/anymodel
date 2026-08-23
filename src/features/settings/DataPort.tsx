import { useSessionStore } from '../../state/sessionStore';

function download(filename: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Backup / restore — sessions and settings only; key material is NEVER
 * included in any export.
 */
export function DataPort() {
  const exportJson = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    download(`relay-backup-${stamp}.json`, useSessionStore.getState().exportJson());
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    // Parse first to validate and count sessions before confirming
    try {
      const j = JSON.parse(text) as { sessions?: unknown[] };
      if (!Array.isArray(j.sessions)) {
        alert('That file is not a valid Relay backup.');
        return;
      }
      const existingCount = useSessionStore.getState().sessions.length;
      const importCount = j.sessions.length;
      const confirmed = window.confirm(
        `Import ${importCount} session${importCount !== 1 ? 's' : ''}?\n\n` +
        `This will REPLACE your ${existingCount} existing session${existingCount !== 1 ? 's' : ''}. ` +
        `This action cannot be undone.`
      );
      if (!confirmed) return;
    } catch {
      alert('That file is not a valid Relay backup.');
      return;
    }
    const res = useSessionStore.getState().importJson(text);
    if (res === 'ok') window.location.reload();
    else alert('That file is not a valid Relay backup.');
  };

  const exportThreadMd = () => {
    const s = useSessionStore.getState().active();
    if (!s || s.turns.length === 0) return alert('Nothing to export yet.');
    const lines: string[] = [`# ${s.title}`, ''];
    for (const t of s.turns) {
      if (t.role === 'user') {
        lines.push('## You', '', t.content, '');
        if (t.imageUrl) lines.push('*(image attached)*', '');
      } else {
        lines.push(`> **${t.modelId ?? 'model'}**`, '', t.content, '');
      }
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    download(`${s.title.replace(/[^\w-]+/g, '-').slice(0, 40)}-${stamp}.md`, lines.join('\n'), 'text/markdown');
  };

  return (
    <div className="field">
      <label>Data</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={exportJson}>
          ⭳ Export backup
        </button>
        <button className="btn" onClick={() => document.getElementById('import-json')?.click()}>
          ⭱ Import backup
        </button>
        <input
          id="import-json"
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = '';
          }}
        />
        <button className="btn" onClick={exportThreadMd}>
          ⇩ This thread → Markdown
        </button>
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        Backups contain conversations and settings — never API keys.
      </span>
    </div>
  );
}
