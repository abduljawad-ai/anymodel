/**
 * Provider registry: merges the catalog providers with extra (Ollama, Custom),
 * applies known extra model IDs, and exposes enumeration helpers.
 *
 * Also serves as the catalog facade — other modules import from this file.
 */

import { ensureCatalogLoaded, invalidateCatalogCache } from "./loader.js";
import { normalizeModel } from "./normalizer.js";
import { pickModelFor } from "./picker.js";

// Extra providers not in the catalog
export const EXTRA_PROVIDERS = {
  ollama: { id: "ollama", name: "Ollama (local)", api: "http://localhost:11434/v1", format: "openai", models: {} },
  custom: { id: "custom", name: "Custom provider", api: "", format: "openai", models: {} }
};

// Known extra model IDs for providers (used for transcription/TTS/etc endpoints)
// "" for moderation on mistral means "use the currently selected model"
export const KNOWN_EXTRAS = {
  openai:  { transcription: "whisper-1", tts: "tts-1", embeddings: "text-embedding-3-small", moderation: "omni-moderation-latest" },
  mistral: { transcription: "voxtral-mini-latest", tts: "voxtral-mini-tts-latest", embeddings: "mistral-embed", ocr: "mistral-ocr-latest", moderation: "" },
  groq:    { transcription: "whisper-large-v3" }
};

// ── Module-level caches ──────────────────────────────────────────────
let catalogData = null;
let providersCache = null;

/**
 * Load the catalog from cache/network (if not already loaded),
 * then build and cache the merged providers map.
 */
export async function ensureLoaded() {
  catalogData = await ensureCatalogLoaded();
  providersCache = null; // force rebuild with fresh data
  getProviders(); // warm the cache
  return catalogData;
}

/**
 * Build (or return cached) merged providers map: catalog + extras,
 * with known extra model IDs injected into each provider's models.
 */
function getProviders() {
  if (providersCache) return providersCache;

  const merged = Object.assign({}, catalogData ? catalogData.providers : {}, EXTRA_PROVIDERS);

  for (const [pid, p] of Object.entries(merged)) {
    if (!p.models) p.models = {};
    const extras = KNOWN_EXTRAS[pid];
    if (extras) {
      for (const [kind, mid] of Object.entries(extras)) {
        if (!mid || p.models[mid]) continue;
        p.models[mid] = { name: mid, description: kind, input_modalities: [], output_modalities: [] };
      }
    }
  }

  providersCache = merged;
  return merged;
}

/** @returns {Array} ordered provider list for UI dropdowns */
export function providerList() {
  const merged = getProviders();
  const list = Object.values(merged)
    .filter(p => p.id !== "custom" && p.id !== "ollama")
    .map(p => ({ id: p.id, name: p.name, api: p.api, format: p.format }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [EXTRA_PROVIDERS.custom, EXTRA_PROVIDERS.ollama, ...list];
}

/** @returns {object|null} provider metadata by id */
export function getProvider(id) {
  return getProviders()[id] || null;
}

/** @returns {Array} normalized models for a provider */
export function listModels(providerId) {
  const p = getProviders()[providerId];
  if (!p) return [];
  return Object.entries(p.models).map(([mid, m]) => normalizeModel(mid, m, providerId));
}

/** @returns {string|null} best model id for a given endpoint kind */
export function pickModel(providerId, kind) {
  return pickModelFor(getProviders(), providerId, kind, KNOWN_EXTRAS);
}

export { invalidateCatalogCache };
