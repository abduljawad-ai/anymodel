import { useUiStore } from '../../state/uiStore';
import { getProviderMeta } from '../../catalog/providers';

/** Top bar: menu toggle, brand, current model, theme toggle, settings. */
export function TopBar() {
  const setRailOpen = useUiStore((s) => s.setRailOpen);
  const railOpen = useUiStore((s) => s.railOpen);
  const theme = useUiStore((s) => s.theme);
  const activeModel = useUiStore((s) => s.activeModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const meta = getProviderMeta(activeModel.providerId);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="icon-btn"
          aria-label={railOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setRailOpen(!railOpen)}
        >
          {railOpen ? '✕' : '☰'}
        </button>
        <span className="rail-brand" style={{ fontSize: 15 }}>
          <span className="glyph">⟐</span> Relay
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Current model chip */}
        <button
          className="dial-btn"
          onClick={() => setPaletteOpen(true)}
          title="Switch model (⌘K)"
        >
          <span className="tint-dot" style={{ ['--tint' as string]: meta?.tint }} />
          {activeModel.modelId}
          <span aria-hidden style={{ opacity: 0.5 }}>▾</span>
        </button>

        {/* Theme toggle */}
        <button
          className="icon-btn"
          title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          aria-label="Toggle theme"
          onClick={() => useUiStore.getState().toggleTheme()}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Settings */}
        <button
          className="icon-btn"
          title="Settings"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
