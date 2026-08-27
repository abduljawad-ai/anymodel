import { useEffect, useRef } from 'react';
import { PenLine, Brain, Lightbulb, Wrench } from 'lucide-react';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { MessageBubble } from './MessageBubble';

/** The conversation: turn list + empty state. */
export function ThreadView() {
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === s.activeId));
  const turns = session?.turns ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Auto-scroll while streaming unless the user scrolled up.
  useEffect(() => {
    const area = document.querySelector('.view-area');
    if (!area) return;
    const onScroll = () => {
      stickToBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 120;
    };
    area.addEventListener('scroll', onScroll);
    return () => area.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns]);

  if (!session || turns.length === 0) {
    return (
      <div className="empty-state" role="main" aria-label="Welcome">
        <div className="empty-card">
          <h1>How can I help you today?</h1>
          <p>
            Bring your own key — chat with any model from OpenAI, Anthropic, Google, Groq and more.
            <br />
            Press <span className="kbd">⌘K</span> to pick a model, then just start typing.
          </p>
          <div className="suggest-grid" role="group" aria-label="Suggested prompts">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                className="suggest-card"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('relay-fill-composer', { detail: s.text }));
                }}
                aria-label={`Use suggestion: ${s.text}`}
              >
                <span className="suggest-icon" aria-hidden><s.icon /></span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 18 }}
            onClick={() => useUiStore.getState().setView('providers')}
            aria-label="Set up providers and models"
          >
            Set up providers & models
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="thread-wrap" role="log" aria-label="Conversation" aria-live="polite">
      {session.memory && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span className="chip" title={session.memory.text} aria-label={`Memory compacted ${session.memory.compactions} times`}>
            memory ×{session.memory.compactions}
          </span>
        </div>
      )}
      {turns.map((t) => (
        <MessageBubble key={t.id} turn={t} />
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

/** ChatGPT-style starter prompts — fill the composer when clicked. */
const SUGGESTIONS = [
  { icon: PenLine, text: 'Help me write an email to my team about a project delay' },
  { icon: Brain, text: 'Explain quantum computing in simple terms' },
  { icon: Lightbulb, text: 'Give me ideas for a weekend side project' },
  { icon: Wrench, text: 'Debug why my JavaScript function returns undefined' },
];
