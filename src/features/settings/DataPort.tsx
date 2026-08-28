import { useRef } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useSessionStore } from '../../state/sessionStore';
import { toast } from '../../lib/toast';

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataPort() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = useSessionStore.getState().exportJson();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadFile(`relay-backup-${stamp}.json`, json, 'application/json');
    toast('Backup exported.');
  }

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { sessions?: unknown[] };
      if (!Array.isArray(parsed.sessions)) {
        toast('Invalid backup file.', { error: true });
        return;
      }

      const existing = useSessionStore.getState().sessions.length;
      const incoming = parsed.sessions.length;
      const ok = window.confirm(
        `Import ${incoming} session${incoming !== 1 ? 's' : ''}?\n\n` +
          `This will REPLACE your ${existing} existing session${existing !== 1 ? 's' : ''}. ` +
          `This cannot be undone.`,
      );
      if (!ok) return;

      const result = useSessionStore.getState().importJson(text);
      if (result === 'ok') {
        toast('Import successful. Reloading…');
        window.location.reload();
      } else {
        toast('Invalid backup file.', { error: true });
      }
    } catch {
      toast('Invalid backup file.', { error: true });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClear() {
    const ok = window.confirm(
      'Delete ALL sessions?\n\nThis cannot be undone.',
    );
    if (!ok) return;

    useSessionStore.setState({ sessions: [], activeId: null });
    toast('All sessions cleared.');
  }

  return (
    <div className="data-port">
      <div className="data-port-actions">
        <button className="btn" onClick={handleExport} type="button">
          <Download size={14} aria-hidden />
          Export backup
        </button>

        <button className="btn" onClick={() => fileInputRef.current?.click()} type="button">
          <Upload size={14} aria-hidden />
          Import backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleImport}
        />

        <button className="btn btn-danger" onClick={handleClear} type="button">
          <Trash2 size={14} aria-hidden />
          Clear all data
        </button>
      </div>

      <span className="data-port-hint">
        Backups contain conversations — API keys are never included.
      </span>
    </div>
  );
}
