/**
 * Anthropic provider adapter.
 *
 * Handles Anthropic-specific chat message structure, tool calls,
 * extended thinking, and prompt caching.
 */

import { ProviderAdapter } from "./Adapter.js";
import { parseToolArgs } from "../../api/client.js";
import { getMaxOutputTokens } from "../../api/context.js";

export class AnthropicAdapter extends ProviderAdapter {
  getStreamUrl() {
    return `${this.getBaseUrl()}/messages`;
  }

  /**
   * Prepares the streaming request, stripping internal flags and
   * adding the anthropic-beta header for extended thinking.
   */
  prepareStreamRequest(modelId, body) {
    const url = this.getStreamUrl(modelId);
    const headers = { "Content-Type": "application/json", ...this.getAuthHeaders() };
    if (body._extendedThinking) headers["anthropic-beta"] = "interleaved-thinking-2025-05-14";
    const cleanBody = { ...body };
    delete cleanBody._extendedThinking;
    return { url, headers, body: { ...cleanBody, stream: true } };
  }

  /**
   * @param {object} model  — { id, context, capabilities, provider }
   * @param {object} ctx    — { messages: [{role,content}], singleCapChars }
   * @param {object} opts   — { text, image, audio, systemPrompt, autoTools, demoTools }
   */
  buildChatBody(model, ctx, opts) {
    const { text, image, systemPrompt, autoTools, demoTools } = opts;

    const content = [];
    if (text) content.push({ type: "text", text });
    if (image && model.capabilities?.vision) {
      const [meta, b64] = image.dataUrl.split(",");
      const mime = (meta.match(/^data:(.*?);base64/) || ["", "image/png"])[1];
      content.push({ type: "image", source: { type: "base64", media_type: mime, data: b64 } });
    }

    const messages = [];
    ctx.messages.forEach(mm => {
      if (mm.role === "user" || mm.role === "assistant") messages.push({ role: mm.role, content: [{ type: "text", text: mm.content }] });
    });
    messages.push({ role: "user", content });

    const maxTokens = getMaxOutputTokens(model) || 4096;

    const body = {
      model: model.id,
      max_tokens: maxTokens,
      messages,
      cache_control: { type: "ephemeral" }
    };

    if (systemPrompt) {
      body.system = [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }];
    }

    // Extended thinking for reasoning-capable models
    if (model.capabilities?.reasoning) {
      body.thinking = { type: "enabled", budget_tokens: 8000 };
      body._extendedThinking = true; // internal flag — stripped in prepareStreamRequest
    }

    if (model.capabilities?.function_calling && autoTools) {
      body.tools = demoTools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }

    return body;
  }

  buildToolFollowUpBody(model, ctx, originalBody, streamResult, toolResults, opts) {
    const { runDemoTool } = opts;

    const assistantContent = [];
    if (streamResult.fullText) assistantContent.push({ type: "text", text: streamResult.fullText });
    streamResult.toolCalls.forEach(tc => {
      assistantContent.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: parseToolArgs(tc.arguments)
      });
    });

    const toolResultMessages = streamResult.toolCalls.map((tc, i) => ({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: tc.id,
        content: JSON.stringify(opts.runDemoTool(tc.name, tc.arguments))
      }]
    }));

    const messages = [...originalBody.messages, { role: "assistant", content: assistantContent }, ...toolResultMessages];

    return {
      model: model.id,
      max_tokens: originalBody.max_tokens,
      messages,
      system: originalBody.system,
      tools: originalBody.tools,
      cache_control: originalBody.cache_control
    };
  }

  /**
   * Parse an Anthropic SSE event into normalized events.
   *
   * Anthropic uses: content_block_start, content_block_delta, content_block_stop
   * Each content block has an `index` field to support parallel tool calls.
   */
  parseStreamEvent(json) {
    const events = [];
    const type = json.type;

    if (type === "content_block_start") {
      const block = json.content_block || {};
      const idx = json.index ?? 0;
      if (block.type === "tool_use") {
        events.push({
          type: "tool_call",
          index: idx,
          id: block.id || null,
          name: block.name || null,
          arguments: null
        });
      }
      // text and thinking blocks are handled via delta events
    } else if (type === "content_block_delta") {
      const delta = json.delta || {};
      const idx = json.index ?? 0;
      if (delta.type === "text_delta" && delta.text) {
        events.push({ type: "text", text: delta.text });
      } else if (delta.type === "thinking_delta" && delta.thinking) {
        events.push({ type: "thinking", text: delta.thinking });
      } else if (delta.type === "input_json_delta" && delta.partial_json) {
        events.push({
          type: "tool_call",
          index: idx,
          id: null,
          name: null,
          arguments: delta.partial_json
        });
      }
    }
    // content_block_stop just flushes — the stream loop handles end via stream close

    return events;
  }
}
