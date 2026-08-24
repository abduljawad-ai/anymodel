import { useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Chip } from '../../ui/Chip';
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
  const view = useUiStore((s) => s.view);
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
    <aside className={`rail ${railOpen ? 'open' : ''}`} aria-label="Navigation">
      <div className="rail-brand">
        <span className="glyph">⟐</span> Relay
        <IconButton
          icon="✕"
          aria-label="Close menu"
          onClick={() => useUiStore.getState().setRailOpen(false)}
        />
      </div>

      <Button
        variant="primary"
        size="md"
        className="rail-new"
        onClick={() => {
          useSessionStore.getState().createSession(activeModel);
          useUiStore.getState().setView('chat');
          useUiStore.getState().setRailOpen(false);
        }}
      >
        + New thread
      </Button>

      <nav aria-label="Navigation" className="rail-nav">
        {(['chat', 'providers', 'studio'] as const).map((v) => {
          const labels: Record<string, string> = {
            chat: '💬 Chat',
            providers: '⟐ Providers & models',
            studio: '✦ Studio'
          };
          
          return (
            <Button
              key={v}
              variant="ghost"
              size="md"
              className={`rail-nav-item ${view === v ? 'active' : ''}`}
              onClick={() => {
                useUiStore.getState().setView(v);
                useUiStore.getState().setRailOpen(false);
              }}
            >
              {labels[v]}
            </Button>
          );
        })}
      </nav>

      <div className="rail-section-header">THREADS</div>

      {sessions.length > 0 && (
        <Input
          placeholder="Search threads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search threads"
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
              <span className="session-time">{relTime(s.updatedAt)}</span>
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
        {sessions.length === 0 && <p className="rail-empty">No threads yet.</p>}
        {sessions.length > 0 && sessions.filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p className="rail-empty">No threads match "{search}".</p>
        )}
      </nav>

      {/* Footer: vault status, settings, theme toggle, lock */}
      <div className="rail-footer">
        <div className="rail-footer-left">
          <Chip variant={vaultStatus === 'unlocked' ? 'accent' : 'default'}>
            Vault
          </Chip>
        </div>
        <div className="rail-footer-right">
          <IconButton
            icon="⚙"
            aria-label="Settings"
            onClick={() => {
              useUiStore.getState().setSettingsOpen(true);
              useUiStore.getState().setRailOpen(false);
            }}
          />
          <IconButton
            icon={theme === 'light' ? '🌙' : '☀️'}
            aria-label="Toggle theme"
            onClick={() => useUiStore.getState().toggleTheme()}
          />
          <IconButton
            icon="🔒"
            aria-label="Lock vault"
            onClick={() => useVaultStore.getState().lock()}
          />
        </div>
      </div>
    </aside>
  );
}
