import { IconButton } from '../../ui/IconButton';
import { Chip } from '../../ui/Chip';
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
      <div className="topbar-left">
        <IconButton
          icon={railOpen ? '✕' : '☰'}
          aria-label={railOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setRailOpen(!railOpen)}
        />
        <span className="topbar-brand">
          <span className="glyph">⟐</span> Relay
        </span>
      </div>

      <div className="topbar-right">
        {/* Current model chip */}
        <Chip 
          variant="default"
          className="model-chip"
          onClick={() => setPaletteOpen(true)}
        >
          <span className="tint-dot" style={{ ['--tint' as string]: meta?.tint }} />
          {activeModel.modelId}
          <span aria-hidden className="model-chip-arrow">▾</span>
        </Chip>

        {/* Theme toggle */}
        <IconButton
          icon={theme === 'light' ? '🌙' : '☀️'}
          aria-label="Toggle theme"
          onClick={() => useUiStore.getState().toggleTheme()}
        />

        {/* Settings */}
        <IconButton
          icon="⚙"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        />
      </div>
    </header>
  );
}
