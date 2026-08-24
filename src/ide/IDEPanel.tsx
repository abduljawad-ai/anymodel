import { useState, useEffect } from 'react';
import { X, Play, Code2, Copy, Download, MessageSquarePlus } from 'lucide-react';
import { useIDEStore } from './ideStore';
import { Editor } from './Editor';
import { Preview } from './Preview';
import { Button } from '../ui/Button';
import { toast } from '../lib/toast';
import { useUiStore } from '../state/uiStore';

/** IDE panel: editor + live preview for code artifacts. Desktop = right pane, mobile = overlay. */
export function IDEPanel() {
  const buffers = useIDEStore((s) => s.buffers);
  const activeId = useIDEStore((s) => s.activeId);
  const open = useIDEStore((s) => s.open);
  const focusBuffer = useIDEStore((s) => s.focusBuffer);
  const closeBuffer = useIDEStore((s) => s.closeBuffer);
  const updateCode = useIDEStore((s) => s.updateCode);
  const setOpen = useIDEStore((s) => s.setOpen);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  // "run" button in code heads jumps straight to the preview tab.
  useEffect(() => {
    const onPreview = () => setTab('preview');
    window.addEventListener('relay-ide-preview', onPreview);
    return () => window.removeEventListener('relay-ide-preview', onPreview);
  }, []);

  const active = buffers.find((b) => b.id === activeId) ?? null;

  if (!open || !active) return null;

  function copy() {
    void navigator.clipboard
      .writeText(active!.code)
      .then(() => toast('Code copied'))
      .catch(() => toast('Could not copy'));
  }

  function download() {
    const blob = new Blob([active!.code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = active!.title;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function sendToThread() {
    const ta = document.querySelector('.composer textarea') as HTMLTextAreaElement | null;
    if (!ta) {
      toast('Open a chat thread first');
      return;
    }
    const fenced = '```' + active!.language + '\n' + active!.code + '\n```';
    ta.value = ta.value ? `${ta.value}\n${fenced}` : fenced;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    setOpen(false);
    toast('Code added to composer');
  }

  return (
    <aside className="ide-panel" aria-label="Code IDE">
      <div className="ide-head">
        <div className="ide-tabs" role="tablist" aria-label="Open files">
          {buffers.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={b.id === activeId}
              className={`ide-tab ${b.id === activeId ? 'on' : ''}`}
              onClick={() => focusBuffer(b.id)}
              title={b.title}
            >
              <Code2 size={12} aria-hidden />
              {b.title}
              {b.dirty && <span className="ide-dirty" aria-label="unsaved changes" />}
              <span
                className="ide-tab-close"
                role="button"
                aria-label={`Close ${b.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeBuffer(b.id);
                }}
              >
                <X size={10} aria-hidden />
              </span>
            </button>
          ))}
        </div>
        <button className="icon-btn" aria-label="Close IDE" onClick={() => setOpen(false)}>
          <X size={15} aria-hidden />
        </button>
      </div>

      <div className="ide-mode-row">
        <div className="studio-type-row" role="tablist" aria-label="Editor mode">
          <button role="tab" aria-selected={tab === 'edit'} className={`studio-type-btn ${tab === 'edit' ? 'on' : ''}`} onClick={() => setTab('edit')}>
            <Code2 size={13} aria-hidden /> Edit
          </button>
          <button role="tab" aria-selected={tab === 'preview'} className={`studio-type-btn ${tab === 'preview' ? 'on' : ''}`} onClick={() => setTab('preview')}>
            <Play size={13} aria-hidden /> Preview
          </button>
        </div>
        <div className="ide-actions">
          <Button size="sm" variant="secondary" onClick={copy}>
            <Copy size={12} aria-hidden /> Copy
          </Button>
          <Button size="sm" variant="secondary" onClick={download}>
            <Download size={12} aria-hidden /> Save
          </Button>
          <Button size="sm" onClick={sendToThread}>
            <MessageSquarePlus size={12} aria-hidden /> To thread
          </Button>
        </div>
      </div>

      <div className="ide-body">
        {tab === 'edit' ? (
          <Editor
            key={active.id}
            code={active.code}
            language={active.language}
            onChange={(code) => updateCode(active.id, code)}
          />
        ) : (
          <Preview code={active.code} language={active.language} />
        )}
      </div>
    </aside>
  );
}

/** Convenience hook for other surfaces to open code in the IDE. */
export function openInIDE(code: string, language: string, title?: string, messageId?: string): void {
  useIDEStore.getState().openBuffer({ code, language, title, messageId });
  useUiStore.getState().setView('chat');
}
