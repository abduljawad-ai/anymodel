import { useEffect, useRef } from 'react';
import { Copy, Download } from 'lucide-react';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { MessageBubble } from './MessageBubble';
import { toast } from '../../lib/toast';

const SUGGESTIONS = [
  'Explain quantum computing in simple terms',
  'Write a Python script to scrape a website',
  'What are the pros and cons of React vs Vue?',
  'Help me debug my TypeScript error',
];

export function ThreadView() {
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === useSessionStore.getState().activeId));
  const turns = session?.turns ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottom.current = distFromBottom < 120;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns.length]);

  function copyAll() {
    const text = turns
      .map((t) => {
        const role = t.role === 'user' ? 'You' : 'Assistant';
        return `${role}:\n${t.content}`;
      })
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'));
  }

  function exportMd() {
    if (!session) return;
    const text = turns
      .map((t) => {
        const role = t.role === 'user' ? '## You' : '## Assistant';
        return `${role}\n\n${t.content}`;
      })
      .join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title || 'chat'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported as Markdown');
  }

  if (turns.length === 0) {
    return (
      <div className="thread-view" role="main" aria-label="Welcome">
        <div className="thread-empty">
          <h1>How can I help you today?</h1>
          <p>
            Pick a model with <span className="hint">⌘K</span> and start chatting
          </p>
          <div className="suggest-grid" role="group" aria-label="Suggested prompts">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="suggest-card"
                onClick={() => window.dispatchEvent(new CustomEvent('relay-fill-composer', { detail: s }))}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => useUiStore.getState().setView('providers')}
          >
            Set up providers & models →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="thread-view" role="log" aria-label="Conversation" aria-live="polite" ref={containerRef}>
      {turns.length > 0 && (
        <div className="thread-actions">
          <button className="icon-btn" title="Copy all" aria-label="Copy all messages" onClick={copyAll}>
            <Copy size={14} />
          </button>
          <button className="icon-btn" title="Export" aria-label="Export as Markdown" onClick={exportMd}>
            <Download size={14} />
          </button>
          {session?.memory?.compactions != null && session.memory.compactions > 0 && (
            <span className="chip chip-default">memory ×{session.memory.compactions}</span>
          )}
        </div>
      )}
      {turns.map((t) => (
        <MessageBubble key={t.id} turn={t} />
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
