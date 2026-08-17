/**
 * Model normalizer: transforms raw catalog model entries into the app's
 * internal capabilities shape.
 */

/**
 * Detect capabilities from a model's raw catalog entry.
 * @param {string} mid - model id
 * @param {object} m - raw model object from catalog
 * @param {string} providerId - provider this model belongs to
 * @returns {object} normalized model with capabilities
 */
export function normalizeModel(mid, m, providerId) {
  const input = m.input_modalities || [];
  const output = m.output_modalities || [];
  const lowId = mid.toLowerCase();

  const caps = {};

  if (m.attachment || input.includes("image") || input.includes("pdf")) caps.vision = true;
  if (m.tool_call) caps.function_calling = true;
  if (m.reasoning) caps.reasoning = true;
  if (/whisper|transcri|asr|speech-to-text/.test(lowId) || input.includes("audio")) caps.audio_transcription = true;
  if (caps.audio_transcription || input.includes("audio")) caps.audio = true;
  if (/tts|speech|voice|orpheus/.test(lowId) || output.includes("audio")) caps.tts = true;
  if (/embed/.test(lowId)) caps.embeddings = true;
  if (/moderat|guard/.test(lowId)) caps.moderation = true;
  if (/ocr/.test(lowId)) caps.ocr = true;

  return {
    id: mid,
    name: m.name || mid,
    description: m.description || "",
    context: m.context || null,
    provider: providerId,
    capabilities: caps
  };
}

/**
 * List all normalized models for a provider.
 * @param {object} providers - the merged providers map
 * @param {string} providerId - provider to list models for
 */
export function listModels(providers, providerId) {
  const p = providers[providerId];
  if (!p) return [];
  return Object.entries(p.models).map(([mid, m]) => normalizeModel(mid, m, providerId));
}
