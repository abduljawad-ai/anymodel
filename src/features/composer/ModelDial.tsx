import { PROVIDERS } from '../../catalog/providers';
import { useUiStore } from '../../state/uiStore';

/** Current-model chip in the composer — opens the ⌘K palette. */
export function ModelDial() {
  const activeModel = useUiStore((s) => s.activeModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const meta = PROVIDERS[activeModel.providerId];

  return (
    <button className="dial-btn" onClick={() => setPaletteOpen(true)} title="Switch model (⌘K)">
      <span className="tint-dot" style={{ ['--tint' as string]: meta.tint }} />
      {activeModel.modelId}
      <span aria-hidden style={{ opacity: 0.5 }}>
        ▾
      </span>
    </button>
  );
}
