import { ensureModels, cachedModels, isChatCapable } from '../../catalog';
import { listProviders } from '../../catalog/providers';
import { useVaultStore } from '../../vault/vaultStore';
import { useUiStore } from '../../state/uiStore';

/** Fired whenever a provider's live model list (re)loads. */
export function dispatchModelsChanged(): void {
  window.dispatchEvent(new Event('relay-models-changed'));
}

/**
 * Auto-load models for EVERY provider that has a stored key.
 * Called on vault unlock and after each key save — users never press
 * "Load models" by hand; lists are simply there.
 */
export async function autoLoadKeyedModels(): Promise<void> {
  const keys = useVaultStore.getState().keys;
  await Promise.allSettled(
    Object.keys(keys)
      .filter((pid) => pid !== 'exa')
      .map((pid) => ensureModels(pid)),
  );
  dispatchModelsChanged();
}

/** Subscribe to live model-list updates (returns unsubscribe). */
export function onModelsChanged(fn: () => void): () => void {
  window.addEventListener('relay-models-changed', fn);
  return () => window.removeEventListener('relay-models-changed', fn);
}

/** Providers with a saved key whose model list isn't loaded yet. */
export function keyedButUnloaded(): string[] {
  const keys = useVaultStore.getState().keys;
  return Object.keys(keys).filter((pid) => pid !== 'exa' && cachedModels(pid).length === 0);
}

/**
 * If the active model's provider has no key, move to the first keyed
 * provider that has a usable model — the user should never land on a
 * dead model after setup or refresh.
 */
export function ensureSaneActiveModel(): void {
  const ui = useUiStore.getState();
  const keys = useVaultStore.getState().keys;
  if (keys[ui.activeModel.providerId]) return;
  for (const p of listProviders()) {
    if (!keys[p.id]) continue;
    const models = cachedModels(p.id);
    const m = models.find(isChatCapable) ?? models[0];
    if (m) {
      ui.setActiveModel({ providerId: p.id, modelId: m.id });
      return;
    }
  }
}
