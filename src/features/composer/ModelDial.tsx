import { getProviderMeta } from '../../catalog/providers';
import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';

/** Current-model chip in the composer — opens the ⌘K palette. */
export function ModelDial() {
  const activeModel = useUiStore((s) => s.activeModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const hasKey = useVaultStore((s) => !!s.keys[activeModel.providerId]);
  const meta = getProviderMeta(activeModel.providerId);

  return (
    <button
      className="dial-btn"
      style={hasKey ? undefined : { borderColor: 'var(--err)', color: 'var(--err)' }}
      onClick={() => setPaletteOpen(true)}
      title={hasKey ? 'Switch model (⌘K)' : 'No key for this provider — click to pick another (⌘K)'}
    >
      <span className="tint-dot" style={{ ['--tint' as string]: meta?.tint }} />
      {activeModel.modelId}
      {!hasKey && ' ⚠'}
      <span aria-hidden style={{ opacity: 0.5 }}>
        ▾
      </span>
    </button>
  );
}
