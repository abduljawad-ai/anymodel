/**
 * OpenAI-compatible provider adapter.
 *
 * Handles standard OpenAI-format chat completions (used by OpenAI,
 * OpenRouter, Groq, Together, Mistral, etc.).
 */

import { ProviderAdapter } from "./Adapter.js";
import { guessAudioFormat } from "../api/client.js";

export class OpenAIAdapter extends ProviderAdapter {
  getStreamUrl() {
    return `${this.getBaseUrl()}/chat/completions`;
  }

  /**
   * @param {object} model  — { id, context, capabilities, provider }
   * @param {object} ctx    — { messages: [{role,content}], singleCapChars }
   * @param {object} opts   — { text, image, audio, systemPrompt, autoTools, demoTools }
   */
  buildChatBody(model, ctx, opts) {
    const { text, image, audio, systemPrompt, autoTools, demoTools } = opts;

    const content = [];
    if (text) content.push({ type: "text", text });
    if (image && model.capabilities?.vision) content.push({ type: "image_url", image_url: { url: image.dataUrl } });
    if (audio && model.capabilities?.audio) {
      content.push({ type: "input_audio", input_audio: { data: audio.dataUrl.split(",")[1], format: guessAudioFormat(audio.name) } });
    }

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    ctx.messages.forEach(mm => {
      if (mm.role === "user" || mm.role === "assistant") messages.push({ role: mm.role, content: mm.content });
    });
    messages.push({ role: "user", content: content.length > 1 ? content : (text || "") });

    const body = { model: model.id, messages };
    if (model.capabilities?.function_calling && autoTools) {
      body.tools = demoTools;
      body.tool_choice = "auto";
    }

    return body;
  }

  buildToolFollowUpBody(model, ctx, originalBody, streamResult, toolResults, opts) {
    const { runDemoTool } = opts;
    const toolNames = streamResult.toolCalls.map(tc => tc.name).join(", ");

    const messages = [...originalBody.messages];
    messages.push({
      role: "assistant",
      content: streamResult.fullText || "",
      tool_calls: streamResult.toolCalls.map(tc => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments }
      }))
    });

    toolResults.forEach((result, i) => {
      const tc = streamResult.toolCalls[i];
      messages.push({
        role: "tool",
        name: tc.name,
        tool_call_id: tc.id,
        content: JSON.stringify(result)
      });
    });

    const body = { model: model.id, messages };
    if (originalBody.tools) {
      body.tools = originalBody.tools;
      body.tool_choice = originalBody.tool_choice;
    }
    return body;
  }

  /**
   * Parse an OpenAI SSE event into normalized events.
   */
  parseStreamEvent(json) {
    const events = [];
    const delta = json.choices?.[0]?.delta;
    if (!delta) return events;

    if (delta.content) {
      events.push({ type: "text", text: delta.content });
    }
    if (delta.tool_calls) {
      delta.tool_calls.forEach(tc => {
        events.push({
          type: "tool_call",
          index: tc.index ?? 0,
          id: tc.id || null,
          name: tc.function?.name || null,
          arguments: tc.function?.arguments || null
        });
      });
    }
    return events;
  }
}
