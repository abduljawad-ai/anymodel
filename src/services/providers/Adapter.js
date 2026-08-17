/**
 * Abstract provider adapter — defines the interface that concrete
 * provider adapters (OpenAI, Anthropic, Google) implement.
 *
 * Each adapter is responsible for format-specific translation:
 * - Authentication headers
 * - Streaming endpoint URL + headers
 * - Request body construction (chat + tool-call follow-up)
 * - SSE event parsing (into normalized events)
 *
 * The adapter receives a provider config object and the current API key
 * / custom base URL at construction time. It does NOT access global state.
 */

export class ProviderAdapter {
  /**
   * @param {object} provider  — { id, name, api, format, models }
   * @param {string} apiKey    — decrypted API key
   * @param {string} customBase — override base URL from settings, or ""
   */
  constructor(provider, apiKey, customBase) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.customBase = customBase;
  }

  // ── Auth & URL ────────────────────────────────────────────────────
  /** @returns {object} auth headers for this provider format */
  getAuthHeaders() {
    if (!this.apiKey) return {};
    if (this.provider.format === "anthropic") {
      return { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" };
    }
    if (this.provider.format === "google") {
      return { "x-goog-api-key": this.apiKey };
    }
    return { "Authorization": `Bearer ${this.apiKey}` };
  }

  /** @returns {string} effective base URL (custom override or provider api) */
  getBaseUrl() {
    return this.customBase || this.provider.api || "";
  }

  // ── Streaming request prep ────────────────────────────────────────
  /** @returns {string} streaming endpoint URL for a given model */
  getStreamUrl(modelId) {
    throw new Error("getStreamUrl must be implemented by subclass");
  }

  /**
   * Prepare the full streaming request (strip internal flags, add headers).
   * @param {string} modelId
   * @param {object} body — the chat body (may have internal fields like _extendedThinking)
   * @returns {{ url: string, headers: object, body: object }}
   */
  prepareStreamRequest(modelId, body) {
    const url = this.getStreamUrl(modelId);
    const headers = { "Content-Type": "application/json", ...this.getAuthHeaders() };
    return { url, headers, body: { ...body, stream: true } };
  }

  // ── Chat body construction ────────────────────────────────────────
  buildChatBody(model, ctx, opts) {
    // opts: { text, image, audio, systemPrompt, autoTools, demoTools }
    throw new Error("buildChatBody must be implemented by subclass");
  }

  buildToolFollowUpBody(model, ctx, originalBody, streamResult, toolResults, opts) {
    throw new Error("buildToolFollowUpBody must be implemented by subclass");
  }

  // ── Stream event parsing ──────────────────────────────────────────
  parseStreamEvent(json) {
    throw new Error("parseStreamEvent must be implemented by subclass");
  }

  // ── Endpoints ─────────────────────────────────────────────────────
  /** @returns {string} TTS response format */
  getTtsResponseFormat() {
    const TTS_RESPONSE_FORMATS = { groq: "wav" };
    return TTS_RESPONSE_FORMATS[this.provider.id] || "mp3";
  }
}
