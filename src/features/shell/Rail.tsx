import { useEffect, useState } from 'react';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';

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
  const theme = useUiStore((s) => s.theme);
  const vaultStatus = useVaultStore((s) => s.status);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

      {sessions.length > 0 && (
        <input
          className="prov-search"
          placeholder="Search threads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search threads"
          style={{ fontSize: 13, padding: '6px 10px' }}
        />
      )}

      <nav className="rail-sessions">
        {sessions
          .filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()))
          .map((s) => (
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
                }
              }}
            >
              {confirmId === s.id ? 'sure?' : '✕'}
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No threads yet.</p>}
        {sessions.length > 0 && sessions.filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No threads match "{search}".</p>
        )}
      </nav>

      {/* Footer: vault status, settings, theme toggle, lock */}
      <div className="rail-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`vault-dot ${vaultStatus === 'unlocked' ? 'unlocked' : ''}`} />
          <span style={{ fontSize: 12 }}>Vault</span>
        </span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button
            className="icon-btn"
            title="Settings"
            aria-label="Settings"
            onClick={() => {
              useUiStore.getState().setSettingsOpen(true);
              useUiStore.getState().setRailOpen(false);
            }}
          >
            ⚙
          </button>
          <button
            className="icon-btn"
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
            aria-label="Toggle theme"
            onClick={() => useUiStore.getState().toggleTheme()}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            className="icon-btn"
            title="Lock vault"
            aria-label="Lock vault"
            onClick={() => useVaultStore.getState().lock()}
          >
            🔒
          </button>
        </span>
      </div>

    </aside>
  );
}
