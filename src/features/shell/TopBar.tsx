import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';

/** Top navigation — view tabs, theme toggle, settings. */
export function TopBar() {
  const { theme, toggleTheme, setSettingsOpen, setRailOpen } = useUiStore();
  const vaultStatus = useVaultStore((s) => s.status);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn menu-btn" aria-label="Open sessions" onClick={() => setRailOpen(true)}>
          ☰
        </button>
        <div className="rail-brand" style={{ fontSize: 14 }}><span className="glyph">⟐</span> harness</div>
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
