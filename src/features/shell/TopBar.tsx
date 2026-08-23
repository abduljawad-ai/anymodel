import { useUiStore, type View } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';

const TABS: Array<{ id: View; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'providers', label: 'Providers' },
];

/** Top navigation — Chat / Providers tabs, theme toggle, settings. */
export function TopBar() {
  const { view, theme, toggleTheme, setView, setSettingsOpen, setRailOpen } = useUiStore();
  const vaultStatus = useVaultStore((s) => s.status);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn menu-btn" aria-label="Open sessions" onClick={() => setRailOpen(true)}>
          ☰
        </button>
        <nav className="top-tabs" aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${view === t.id ? 'active' : ''}`}
              onClick={() => setView(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="top-actions">
        <span className="chip" title={`Vault is ${vaultStatus}`}>
          <span className={`vault-dot ${vaultStatus === 'unlocked' ? 'unlocked' : ''}`} />
          {vaultStatus === 'unlocked' ? 'keys live' : vaultStatus}
        </span>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
