import { useEffect, useRef } from 'react';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { BatonTrail } from './BatonTrail';
import { MessageBubble } from './MessageBubble';

/** The conversation: baton trail + turn list + empty state. */
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
      <div className="empty-state">
        <div className="empty-card">
          <h1>One thread. Every model.</h1>
          <p>
            Swap models mid-conversation — every answer carries its maker's badge.
            <br />
            Press <span className="kbd">⌘K</span> to pick a model, then just start typing.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => useUiStore.getState().setView('providers')}
          >
            ⟐ Set up providers & models
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="thread-wrap">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <BatonTrail turns={turns} />
        {session.memory && (
          <span className="chip" title={session.memory.text}>
            🗜 memory ×{session.memory.compactions}
          </span>
        )}
      </div>
      {turns.map((t) => (
        <MessageBubble key={t.id} turn={t} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
