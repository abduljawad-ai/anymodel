/**
 * API facade — the single entry point the rest of the app uses for
 * LLM provider communication.
 *
 * Responsibilities:
 *   - Creates the right ProviderAdapter for the active provider
 *   - Orchestrates the chat streaming flow (context selection, body
 *     building, SSE streaming, tool-call follow-up)
 *   - Delegates sync endpoints (transcription, OCR, TTS, embeddings,
 *     moderation) to services/api/endpoints.js
 *   - Exposes fetchModels, testConnection, abortCurrentRequest
 *
 * Does NOT know about "Chat" — all rendering is via generic callbacks.
 *
 * Constructed with dependency injection:
 *   new Api({ state, catalog, config, markdown })
 */

import { createAdapter } from "../providers/factory.js";
import {
  selectContext,
  estimateTokens,
  estimateImageTokens,
  getMaxOutputTokens,
  getContextWindow,
  truncateText
} from "./context.js";
import { streamSSE, beginRequest, abortCurrentRequest } from "./client.js";

import {
  fetchModels,
  testConnection,
  callTranscription,
  callOcr,
  callTts,
  callEmbeddings,
  callModeration
} from "./endpoints.js";

export class Api {
  /**
   * @param {object} deps
   *   - state   — AppState instance
   *   - catalog — catalog facade (ensureLoaded, providerList, getProvider, pickModel, listModels)
   *   - config  — { DEMO_TOOLS, runDemoTool }
   *   - markdown — { renderMarkdownish, enhanceCodeBlocks, scheduleHighlight }
   *   - focusFirst — (dom util, optional)
   */
  constructor(deps) {
    this.deps = deps;
  }

  _createAdapter(providerId) {
    const { state, catalog } = this.deps;
    const provider = catalog.getProvider(providerId) || {
      id: providerId,
      name: providerId,
      api: "",
      format: "openai"
    };
    const customBase = state.customBases?.[providerId] || "";
    return createAdapter(provider, state.apiKey, customBase);
  }

  // ── Chat streaming ────────────────────────────────────────────────
  /**
   * Stream a chat completion from the active provider.
   *
   * @param {object} opts - { turn, text, image, audio, model, callbacks }
   *   turn      — the turn object ({ phase, bubble, ... })
   *   text      — user's new message text
   *   image     — { dataUrl, tokenEstimate } | null
   *   audio     — { dataUrl, name, tokenEstimate } | null
   *   model     — selected model { id, context, capabilities, provider }
   *   callbacks — rendering callbacks:
   *     onPhase(key, label), onFirstToken(), onToken(text),
   *     onThinking(text), onDone(text), onScroll(), onAudio(src, blob, label)
   * @returns {Promise<{ text: string, toolUsed?: string }>}
   */
  async chatStreaming(opts) {
    const { turn, text, image, audio, model, callbacks } = opts;
    const { state, catalog, config } = this.deps;

    const providerId = state.provider;
    const adapter = this._createAdapter(providerId);

    // Select context (shared logic)
    const mediaTokens = (image && image.tokenEstimate) || (audio && audio.tokenEstimate) || 0;
    const ctx = selectContext(
      model,
      text,
      mediaTokens,
      state.messages,
      state.systemPrompt
    );

    // Build the initial request body
    const chatOpts = {
      text,
      image,
      audio,
      systemPrompt: state.systemPrompt,
      autoTools: state.autoTools,
      demoTools: config.DEMO_TOOLS
    };
    const body = adapter.buildChatBody(model, ctx, chatOpts);

    // Set initial phase
    callbacks.onPhase(model.capabilities?.reasoning ? "thinking" : "connect", "Thinking…");

    // Stream the first response
    const streamReq = adapter.prepareStreamRequest(model.id, body);
    const first = await streamSSE(
      streamReq.url,
      streamReq.headers,
      streamReq.body,
      adapter.parseStreamEvent.bind(adapter),
      callbacks
    );

    // Validate non-empty model response or tool calls
    if (!first.fullText.trim() && !first.toolCalls.length) {
      throw new Error("Model returned an empty response. Please retry your message.");
    }

    // Tool-call follow-up
    if (first.toolCalls.length && state.autoTools) {
      const toolResults = first.toolCalls.map(tc =>
        config.runDemoTool(tc.name, tc.arguments)
      );

      const followUpBody = adapter.buildToolFollowUpBody(
        model, ctx, body, first, toolResults,
        { runDemoTool: config.runDemoTool }
      );

      const toolNames = first.toolCalls.map(tc => tc.name).join(", ");
      callbacks.onPhase("tool", "Using " + toolNames + "…");

      const streamReq2 = adapter.prepareStreamRequest(model.id, followUpBody);
      const second = await streamSSE(
        streamReq2.url,
        streamReq2.headers,
        streamReq2.body,
        adapter.parseStreamEvent.bind(adapter),
        callbacks
      );

      if (!second.fullText.trim() && !second.toolCalls.length) {
        throw new Error("Model returned an empty response during tool execution. Please retry.");
      }

      return {
        text: second.fullText || "(tool call completed)",
        toolUsed: toolNames
      };
    }

    return { text: first.fullText || "(no content)" };
  }

  // ── Sync endpoints ────────────────────────────────────────────────
  async fetchModels() {
    const providerId = this.deps.state.provider;
    const adapter = this._createAdapter(providerId);
    await this.deps.catalog.ensureLoaded?.();
    return fetchModels(adapter, this.deps.state, providerId);
  }

  async testConnection(providerId, key) {
    const { catalog } = this.deps;
    const provider = catalog.getProvider(providerId) || {
      id: providerId,
      name: providerId,
      api: "",
      format: "openai"
    };
    const adapter = createAdapter(
      provider,
      key,
      this.deps.state.customBases?.[providerId] || ""
    );
    return testConnection(adapter);
  }

  async callTranscription(turn, dataUrl, modelId, callbacks) {
    const adapter = this._createAdapter(this.deps.state.provider);
    return callTranscription(adapter, dataUrl, modelId, callbacks);
  }

  async callOcr(turn, dataUrl, modelId, callbacks) {
    const adapter = this._createAdapter(this.deps.state.provider);
    return callOcr(adapter, dataUrl, modelId, callbacks);
  }

  async callTts(turn, text, modelId, callbacks) {
    const adapter = this._createAdapter(this.deps.state.provider);
    return callTts(adapter, text, modelId, this.deps.state.ttsVoice, callbacks);
  }

  async callEmbeddings(turn, text, modelId, callbacks) {
    const adapter = this._createAdapter(this.deps.state.provider);
    return callEmbeddings(adapter, text, modelId, callbacks);
  }

  async callModeration(turn, text, modelId, callbacks) {
    const adapter = this._createAdapter(this.deps.state.provider);
    return callModeration(adapter, text, modelId, callbacks);
  }

  // ── Abort & re-exports ────────────────────────────────────────────
  abortCurrentRequest = abortCurrentRequest;

  // Re-exported for convenience (used by other modules that still call State-level helpers)
  beginRequest = beginRequest;

  // ── Context estimation utilities ──────────────────────────────────
  estimateTokens = estimateTokens;
  estimateImageTokens = estimateImageTokens;
  selectContext = selectContext;
  getMaxOutputTokens = getMaxOutputTokens;
  getContextWindow = getContextWindow;
  truncateText = truncateText;
}
