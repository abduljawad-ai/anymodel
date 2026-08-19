/**
 * API endpoint implementations: transcription, OCR, TTS, embeddings,
 * moderation, model list fetching, and connection testing.
 *
 * These are provider-agnostic (OpenAI-style endpoints) but use the
 * adapter for auth headers and base URL. Rendering is handled via
 * generic callbacks — the API layer knows nothing about "Chat".
 */

import {
  beginRequest,
  fetchWithTimeout,
  errorMessage,
  safeJson,
  dataUrlToBlob,
  MEDIA_TIMEOUT_MS,
  MODELS_TIMEOUT_MS
} from "./client.js";
import { listModels as catalogListModels } from "../catalog/registry.js";

/**
 * Fetch the model list for a provider, caching in state.
 * Uses the catalog first; falls back to the provider's /models endpoint.
 *
 * @param {object} opts
 *   - provider      — provider id string
 * @param {object} adapter      — ProviderAdapter instance
 * @param {object} state        — AppState (reads/writes models, modelsLoaded, model)
 * @returns {Array} normalized model list
 */
export async function fetchModels(adapter, state, provider) {
  if (state.modelsLoaded) return state.models;
  if (state.provider !== provider) return [];

  // Try catalog first
  const catalogModels = catalogListModels(provider);
  if (catalogModels.length > 0) {
    state.models = catalogModels;
  } else if (adapter.getBaseUrl()) {
    // Fall back to the provider's own /models endpoint
    const ctrl = beginRequest();
    const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/models`, {
      headers: adapter.getAuthHeaders(),
      signal: ctrl.signal,
      ctrl
    }, MODELS_TIMEOUT_MS);
    if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
    const data = await res.json();
    if (state.provider !== provider) return [];
    state.models = (data.data || []).map(md => ({
      id: md.id,
      name: md.id,
      description: md.description || "",
      context: md.context_length || null,
      provider: state.provider,
      capabilities: {}
    }));
  }

  state.modelsLoaded = true;
  return state.models;
}

/**
 * Test a provider connection from Settings.
 * @returns {Promise<boolean>}
 */
export async function testConnection(adapter) {
  if (!adapter.getBaseUrl()) return false;
  try {
    const ctrl = new AbortController();
    const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/models`, {
      headers: adapter.getAuthHeaders(),
      signal: ctrl.signal,
      ctrl
    }, MODELS_TIMEOUT_MS);
    return res.ok || res.status === 429 || res.status === 404;
  } catch (e) {
    return false;
  }
}

// ── Endpoints ────────────────────────────────────────────────────────

/**
 * Transcribe audio via the provider's /audio/transcriptions endpoint.
 */
export async function callTranscription(adapter, dataUrl, modelId, callbacks) {
  const ctrl = beginRequest();
  callbacks.onPhase("audio", "Transcribing audio…");
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append("file", blob, "audio.wav");
  form.append("model", modelId);

  const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/audio/transcriptions`, {
    method: "POST",
    headers: adapter.getAuthHeaders(),
    body: form,
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);

  if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  const text = data.text || "(no transcription returned)";
  callbacks.onToken(text);
  callbacks.onDone();
  return text;
}

/**
 * OCR via the provider's /ocr endpoint (Mistral, OpenAI-compatible).
 */
export async function callOcr(adapter, dataUrl, modelId, callbacks) {
  const ctrl = beginRequest();
  callbacks.onPhase("ocr", "Reading document…");

  const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adapter.getAuthHeaders() },
    body: JSON.stringify({ model: modelId, document: { type: "image_url", image_url: dataUrl } }),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);

  if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  callbacks.onDone();
  const pages = data.pages || [];
  const text = pages.map(p => p.markdown || "").join("\n\n") || "(no text extracted)";
  callbacks.onToken(text);
  return text;
}

/**
 * Text-to-speech via the provider's /audio/speech endpoint.
 */
export async function callTts(adapter, text, modelId, ttsVoice, callbacks) {
  const ctrl = beginRequest();
  callbacks.onPhase("connect", "Generating speech…");
  const fmt = adapter.getTtsResponseFormat() || "wav";
  const body = { model: modelId, input: text, response_format: fmt };
  const voice = (ttsVoice || "").trim();
  if (voice) body.voice = voice;

  const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adapter.getAuthHeaders() },
    body: JSON.stringify(body),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);

  if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  callbacks.onDone();

  const ctype = res.headers.get("content-type") || "";
  let src, blob = null;
  if (ctype.indexOf("json") !== -1) {
    // Nonstandard providers return base64 JSON: { audio_data: "..." }
    const data = await res.json();
    const audioB64 = data.audio_data;
    if (!audioB64) throw new Error("No audio returned.");
    src = "data:audio/" + fmt + ";base64," + audioB64;
  } else {
    blob = await res.blob();
    src = URL.createObjectURL(blob);
  }

  callbacks.onAudio(src, blob, text);
  return { text: "[Audio response — " + text.slice(0, 60) + (text.length > 60 ? "…" : "") + "]" };
}

/**
 * Generate embeddings via the provider's /embeddings endpoint.
 */
export async function callEmbeddings(adapter, text, modelId, callbacks) {
  const ctrl = beginRequest();
  callbacks.onPhase("connect", "Generating embeddings…");

  const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adapter.getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text }),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);

  if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  callbacks.onDone();
  const emb = data.data?.[0]?.embedding || [];
  const dim = emb.length;
  const preview = emb.slice(0, 8).map(v => v.toFixed(6)).join(", ");
  const mdText = "**Embedding generated**\n\n- **Model:** " + (data.model || modelId) + "\n- **Dimension:** " + dim + "\n- **First 8 values:** `" + preview + (dim > 8 ? ", …" : "") + "`\n- **Tokens used:** " + (data.usage?.total_tokens || "N/A");
  callbacks.onToken(mdText);
  return mdText;
}

/**
 * Moderate content via the provider's /moderations endpoint.
 */
export async function callModeration(adapter, text, modelId, callbacks) {
  const ctrl = beginRequest();
  callbacks.onPhase("connect", "Moderating content…");

  const res = await fetchWithTimeout(`${adapter.getBaseUrl()}/moderations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adapter.getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text }),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);

  if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  callbacks.onDone();
  const result = data.results?.[0];
  if (!result) throw new Error("No moderation results.");
  const cats = result.categories || {};
  const scores = result.category_scores || {};
  const flagged = Object.entries(cats).filter(([_, v]) => v).map(([k]) => k);
  let mdText = `**Moderation Results**\n\n- **Model:** ${data.model || modelId}\n- **Flagged categories:** ${flagged.length ? flagged.join(", ") : "None"}\n\n| Category | Flagged | Score |\n|----------|---------|-------|\n`;
  for (const [cat, flag] of Object.entries(cats)) {
    const score = scores[cat] !== undefined ? scores[cat].toFixed(6) : "N/A";
    mdText += `| ${cat} | ${flag ? "Yes" : "No"} | ${score} |\n`;
  }
  callbacks.onToken(mdText);
  return mdText;
}
