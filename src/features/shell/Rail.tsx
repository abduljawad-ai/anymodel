import { useEffect, useState } from 'react';
import { MessageCircle, Boxes, Lock, X, Pin } from 'lucide-react';
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

export function Rail() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const activeModel = useUiStore((s) => s.activeModel);
  const railOpen = useUiStore((s) => s.railOpen);
  const view = useUiStore((s) => s.view);
  const vaultStatus = useVaultStore((s) => s.status);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [, forceTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => forceTick((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmId]);

  return (
    <aside className={`rail ${railOpen ? 'open' : ''}`} aria-label="Navigation">
      <div className="rail-header">
        <IconButton
          icon={<X size={16} aria-hidden />}
          aria-label="Close menu"
          onClick={() => useUiStore.getState().setRailOpen(false)}
        />
      </div>

      <div className="rail-brand">
        <span className="glyph">⟐</span> Relay
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
        {(['chat', 'providers'] as const).map((v) => {
          const items: Record<string, { label: string; icon: JSX.Element }> = {
            chat: { label: 'Chat', icon: <MessageCircle size={15} aria-hidden /> },
            providers: { label: 'Providers & models', icon: <Boxes size={15} aria-hidden /> },
          };

          return (
            <button
              key={v}
              className={`rail-nav-item ${view === v ? 'active' : ''}`}
              onClick={() => {
                useUiStore.getState().setView(v);
                useUiStore.getState().setRailOpen(false);
              }}
            >
              {items[v].icon}
              {items[v].label}
            </button>
          );
        })}
      </nav>

      <div className="rail-section-header">THREADS</div>

      {sessions.length > 0 && (
        <div className="rail-search">
          <Input
            placeholder="Search threads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search threads"
          />
        </div>
      )}

      <nav className="rail-sessions">
        {sessions
          .filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()))
          .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.updatedAt - a.updatedAt;
          })
          .map((s) => (
            <div key={s.id} className={`session-item ${s.id === activeId ? 'active' : ''}`}>
              <button
                className="session-action session-pin"
                title={s.pinned ? 'Unpin' : 'Pin'}
                onClick={() => useSessionStore.getState().togglePin(s.id)}
                aria-label={s.pinned ? 'Unpin conversation' : 'Pin conversation'}
              >
                <Pin size={12} aria-hidden style={{ fill: s.pinned ? 'currentColor' : 'none' }} />
              </button>
              <button
                className="session-title"
                onClick={() => {
                  useSessionStore.getState().setActive(s.id);
                  useUiStore.getState().setView('chat');
                  useUiStore.getState().setRailOpen(false);
                }}
                title={s.title}
                aria-current={s.id === activeId ? 'page' : undefined}
                aria-label={s.id === activeId ? `${s.title} (current)` : s.title}
              >
                {s.title}
                <span className="session-time">{relTime(s.updatedAt)}</span>
              </button>
              <button
                className={`session-action session-del ${confirmId === s.id ? 'confirm' : ''}`}
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
                {confirmId === s.id ? 'sure?' : <X size={12} aria-hidden />}
              </button>
            </div>
          ))}
        {sessions.length === 0 && <p className="rail-empty">No threads yet.</p>}
        {sessions.length > 0 && sessions.filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p className="rail-empty">No threads match "{search}".</p>
        )}
      </nav>

      <div className="rail-footer">
        <div className="rail-footer-left">
          <Chip variant={vaultStatus === 'unlocked' ? 'accent' : 'default'}>
            Vault
          </Chip>
        </div>
        <div className="rail-footer-right">
          <IconButton
            icon={<Lock size={16} aria-hidden />}
            aria-label="Lock vault"
            onClick={() => useVaultStore.getState().lock()}
          />
        </div>
      </div>
    </aside>
  );
}
