import { useEffect, useState } from 'react';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';

function relTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/** Sessions rail. Provider management lives on the Providers page. */
export function Rail() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const activeModel = useUiStore((s) => s.activeModel);
  const railOpen = useUiStore((s) => s.railOpen);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [, forceTick] = useState(0);
  // Keep relative timestamps fresh.
  useEffect(() => {
    const iv = setInterval(() => forceTick((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <aside className={`rail ${railOpen ? 'open' : ''}`} aria-label="Sessions">
      <div className="rail-brand">
        <span className="glyph">⟐</span> Relay
        <button
          className="icon-btn"
          style={{ marginLeft: 'auto' }}
          aria-label="Close menu"
          onClick={() => useUiStore.getState().setRailOpen(false)}
        >
          ✕
        </button>
      </div>

      <button
        className="btn btn-primary rail-new"
        onClick={() => {
          useSessionStore.getState().createSession(activeModel);
          useUiStore.getState().setView('chat');
          useUiStore.getState().setRailOpen(false);
        }}
      >
        + New thread
      </button>

      <nav aria-label="Navigation" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {([['chat', '💬 Chat'], ['providers', '⟐ Providers & models']] as const).map(([v, label]) => (
          <button
            key={v}
            className="session-item"
            style={{ color: 'var(--ink)' }}
            onClick={() => {
              useUiStore.getState().setView(v);
              useUiStore.getState().setRailOpen(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginTop: 6 }}>THREADS</div>

      <nav className="rail-sessions">
        {sessions.map((s) => (
          <div key={s.id} className={`session-item ${s.id === activeId ? 'active' : ''}`}>
            <button
              className="session-title"
              style={{ all: 'unset', cursor: 'pointer', flex: 1 }}
              onClick={() => {
                useSessionStore.getState().setActive(s.id);
                useUiStore.getState().setView('chat');
                useUiStore.getState().setRailOpen(false);
              }}
              title={s.title}
            >
              {s.title}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>{relTime(s.updatedAt)}</span>
            </button>
            <button
              className={`session-del ${confirmId === s.id ? 'confirm' : ''}`}
              title="Delete session"
              onClick={() => {
                if (confirmId === s.id) {
                  useSessionStore.getState().deleteSession(s.id);
                  setConfirmId(null);
                } else {
                  setConfirmId(s.id);
                  setTimeout(() => setConfirmId((c) => (c === s.id ? null : c)), 2500);
                }
              }}
            >
              {confirmId === s.id ? 'sure?' : '✕'}
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No threads yet.</p>}
      </nav>


    </aside>
  );
}
