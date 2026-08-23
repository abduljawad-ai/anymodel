import type { ModelInfo, ProviderId } from './types';
import { normalizeModel } from './normalize';

/**
 * Live model discovery — nothing hardcoded. Models are fetched from each
 * provider's own API on demand (when the user opens that provider) and
 * cached in memory with a short TTL. Page load performs zero provider calls.
 */

const cache = new Map<ProviderId, { at: number; models: ModelInfo[] }>();
const TTL = 10 * 60_000;

export function cachedModels(providerId: ProviderId): ModelInfo[] {
  return cache.get(providerId)?.models ?? [];
}

export function isLoaded(providerId: ProviderId): boolean {
  return cache.has(providerId);
}

/** Chat-capable = not a dedicated stt/tts/embedding endpoint model. */
export function isChatCapable(m: ModelInfo): boolean {
  return !m.caps.includes('stt') && !m.caps.includes('tts') && !/embed/i.test(m.id);
}

export function invalidate(providerId?: ProviderId): void {
  if (providerId) cache.delete(providerId);
  else cache.clear();
}

/** Fetch (or reuse cached) models. Throws on provider error when no cache exists. */
export async function ensureModels(providerId: ProviderId): Promise<ModelInfo[]> {
  const hit = cache.get(providerId);
  if (hit && Date.now() - hit.at < TTL) return hit.models;
  // Dynamic imports keep catalog decoupled from adapters at module-eval time.
  const [{ createAdapter }, { effectiveBase }, { useVaultStore }] = await Promise.all([
    import('../adapters/factory'),
    import('../adapters/base'),
    import('../vault/vaultStore'),
  ]);
  const adapter = createAdapter(providerId, {
    baseUrl: effectiveBase(providerId),
    apiKey: () => useVaultStore.getState().keys[providerId],
  });
  try {
    const ids = await adapter.listModels();
    cache.set(providerId, { at: Date.now(), models: ids.map((id) => normalizeModel(providerId, id)) });
  } catch (e) {
    if (!hit) throw e;
  }
  return cachedModels(providerId);
}
