import { useUiStore } from '../../state/uiStore';

/** Slim top bar: just the menu toggle and brand. Controls live in the drawer. */
export function TopBar() {
  const setRailOpen = useUiStore((s) => s.setRailOpen);
  const railOpen = useUiStore((s) => s.railOpen);

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
    </header>
  );
}
