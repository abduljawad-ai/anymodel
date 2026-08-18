/**
 * Google provider adapter.
 *
 * Handles Google's Generative Language API format: contents/parts
 * structure, function calls, and the streamGenerateContent endpoint.
 */

import { ProviderAdapter } from "./Adapter.js";
import { parseToolArgs } from "../api/client.js";

export class GoogleAdapter extends ProviderAdapter {
  getStreamUrl(modelId) {
    return `${this.getBaseUrl()}/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`;
  }

  /**
   * Google doesn't use stream:true in the body — streaming is via the
   * alt=sse query parameter.
   */
  prepareStreamRequest(modelId, body) {
    const url = this.getStreamUrl(modelId);
    const headers = { "Content-Type": "application/json", ...this.getAuthHeaders() };
    return { url, headers, body: { ...body } };
  }

  /**
   * @param {object} model  — { id, context, capabilities, provider }
   * @param {object} ctx    — { messages: [{role,content}], singleCapChars }
   * @param {object} opts   — { text, image, audio, systemPrompt, autoTools, demoTools }
   */
  buildChatBody(model, ctx, opts) {
    const { text, image, systemPrompt, autoTools, demoTools } = opts;

    const parts = [];
    if (text) parts.push({ text });
    if (image && model.capabilities?.vision) {
      const [meta, b64] = image.dataUrl.split(",");
      const mime = (meta.match(/^data:(.*?);base64/) || ["", "image/png"])[1];
      parts.push({ inline_data: { mime_type: mime, data: b64 } });
    }

    const contents = [];
    ctx.messages.forEach(mm => {
      if (mm.role === "user" || mm.role === "assistant") {
        contents.push({ role: mm.role === "assistant" ? "model" : "user", parts: [{ text: mm.content }] });
      }
    });
    contents.push({ role: "user", parts });

    const body = { contents };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
    if (model.capabilities?.function_calling && autoTools) {
      body.tools = [{
        functionDeclarations: demoTools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
    }

    return body;
  }

  buildToolFollowUpBody(model, ctx, originalBody, streamResult, toolResults, opts) {
    const modelParts = streamResult.toolCalls.map(tc => ({
      functionCall: { name: tc.name, args: parseToolArgs(tc.arguments) }
    }));
    const userParts = streamResult.toolCalls.map((tc, i) => ({
      functionResponse: {
        name: tc.name,
        response: { result: opts.runDemoTool(tc.name, tc.arguments) }
      }
    }));

    const contents = [
      ...originalBody.contents,
      { role: "model", parts: modelParts },
      { role: "user", parts: userParts }
    ];

    return {
      ...originalBody,
      contents
    };
  }

  /**
   * Parse a Google SSE event into normalized events.
   *
   * Google sends: { candidates: [{ content: { parts: [...] } }] }
   * Parts may contain: { text: "..." } or { functionCall: { name, args } }
   */
  parseStreamEvent(json) {
    const events = [];
    if (json.error) {
      events.push({ type: "text", text: "" }); // no-op, error will surface
      return events;
    }

    (json.candidates || []).forEach((c, ci) => {
      (c.content?.parts || []).forEach((p, pi) => {
        if (p.text) {
          events.push({ type: "text", text: p.text });
        }
        if (p.functionCall) {
          events.push({
            type: "tool_call",
            index: ci * 100 + pi,
            id: null,
            name: p.functionCall.name || null,
            arguments: p.functionCall.args ? JSON.stringify(p.functionCall.args) : null
          });
        }
      });
    });

    return events;
  }
}
