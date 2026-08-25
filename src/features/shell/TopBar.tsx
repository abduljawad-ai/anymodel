import { Menu, X, Moon, Sun, Settings } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { useUiStore } from '../../state/uiStore';
import { getProviderMeta } from '../../catalog/providers';
import { cachedModels } from '../../catalog';

/** Top bar: menu toggle, brand, current model, theme toggle, settings. */
export function TopBar() {
  const setRailOpen = useUiStore((s) => s.setRailOpen);
  const railOpen = useUiStore((s) => s.railOpen);
  const theme = useUiStore((s) => s.theme);
  const activeModel = useUiStore((s) => s.activeModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const meta = getProviderMeta(activeModel.providerId);
  // Prefer the catalog's friendly label over the raw model id.
  const label =
    cachedModels(activeModel.providerId).find((m) => m.id === activeModel.modelId)?.label ??
    activeModel.modelId;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton
          icon={railOpen ? <X size={16} aria-hidden /> : <Menu size={16} aria-hidden />}
          aria-label={railOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setRailOpen(!railOpen)}
        />
        <span className="topbar-brand">
          <span className="glyph">⟐</span> Relay
        </span>
      </div>

      <div className="topbar-right">
        {/* Current model chip */}
        <button
          className="chip model-chip"
          onClick={() => setPaletteOpen(true)}
          title="Switch model (⌘K)"
          aria-label={`Current model ${activeModel.modelId}. Open model picker`}
        >
          <span className="tint-dot" style={{ ['--tint' as string]: meta?.tint }} />
          {label}
          <span aria-hidden className="model-chip-arrow">▾</span>
        </button>

        {/* Theme toggle */}
        <IconButton
          icon={theme === 'light' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
          aria-label="Toggle theme"
          onClick={() => useUiStore.getState().toggleTheme()}
        />

        {/* Settings */}
        <IconButton
          icon={<Settings size={16} aria-hidden />}
          aria-label="Settings"
          onClick={() => {
            setRailOpen(false);
            setSettingsOpen(true);
          }}
        />
      </div>
    </header>
  );
}
