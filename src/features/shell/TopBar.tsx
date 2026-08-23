import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';

/** Slim top bar: menu toggle + vault status + theme + settings. Navigation lives in the rail. */
export function TopBar() {
  const { theme, toggleTheme, setSettingsOpen, setRailOpen } = useUiStore();
  const vaultStatus = useVaultStore((s) => s.status);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="icon-btn"
          aria-label="Open menu"
          onClick={() => setRailOpen(true)}
        >
          ☰
        </button>
        <span className="rail-brand" style={{ fontSize: 15 }}>
          <span className="glyph">⟐</span> Relay
        </span>
      </div>

      <div className="top-actions">
        <span className="chip" title={`Vault is ${vaultStatus}`}>
          <span className={`vault-dot ${vaultStatus === 'unlocked' ? 'unlocked' : ''}`} />
          {vaultStatus === 'unlocked' ? 'keys live' : vaultStatus}
        </span>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </div>
    </header>
  );
}
