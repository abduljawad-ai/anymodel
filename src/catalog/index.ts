import type { ModelInfo, ProviderId } from './types';
import { STARTER_MODELS } from './starter';
import { normalizeModel } from './normalize';

/** Live model ids fetched per provider (merged after the curated starters). */
const liveByProvider = new Map<ProviderId, ModelInfo[]>();

export function listModels(providerId: ProviderId): ModelInfo[] {
  const live = liveByProvider.get(providerId) ?? [];
  const seen = new Set(live.map((m) => m.id));
  const starters = STARTER_MODELS.filter((m) => m.providerId === providerId && !seen.has(m.id));
  return [...starters, ...live];
}

export function getModel(providerId: ProviderId, modelId: string): ModelInfo | undefined {
  return listModels(providerId).find((m) => m.id === modelId);
}

/** Chat-capable = not a dedicated stt/tts/embedding endpoint model. */
export function isChatCapable(m: ModelInfo): boolean {
  return !m.caps.includes('stt') && !m.caps.includes('tts') && !/embed/i.test(m.id);
}

export function pickDefaultModel(providerId: ProviderId): ModelInfo | undefined {
  return listModels(providerId).find(isChatCapable);
}

/**
 * Merge a provider's live /models listing. On failure the previous
 * (curated + any prior live) list is kept — never throws.
 */
export async function refreshProviderModels(
  providerId: ProviderId,
  fetchIds: () => Promise<string[]>,
): Promise<ModelInfo[]> {
  try {
    const ids = await fetchIds();
    liveByProvider.set(providerId, ids.map((id) => normalizeModel(providerId, id)));
  } catch {
    /* keep whatever we had */
  }
  return listModels(providerId);
}
