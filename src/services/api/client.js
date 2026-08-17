/**
 * HTTP client utilities: abort management, fetch-with-timeout, error messages,
 * blob/data-URL helpers, and the shared SSE streaming loop.
 */

// ── Constants ─────────────────────────────────────────────────────────
export const REQUEST_TIMEOUT_MS = 120000;
export const MEDIA_TIMEOUT_MS = 300000;
export const MODELS_TIMEOUT_MS = 30000;

// ── Active request cancellation ───────────────────────────────────────
// A new chat supersedes any in-flight one; the UI's stop button aborts it explicitly.
let currentAbortController = null;

export function abortCurrentRequest() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

export function beginRequest() {
  abortCurrentRequest();
  const ctrl = new AbortController();
  currentAbortController = ctrl;
  return ctrl;
}

// ── Fetch with timeout ──────────────────────────────────────────────
export function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = opts && opts.ctrl;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (ctrl) ctrl.abort();
      reject(new Error("Request timed out — the provider did not respond in time."));
    }, timeoutMs);
    fetch(url, opts).then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

// ── Error formatting ──────────────────────────────────────────────────
export function errorMessage(status, body) {
  const apiMsg = body?.message || body?.error?.message || (body?.error && typeof body.error === "string" ? body.error : null);
  if (status === 401) return "Invalid API key. Check it in Settings.";
  if (status === 429) return "Rate limit hit — wait a moment and try again.";
  if (apiMsg && /requires terms|terms acceptance|accept the terms|terms of use/i.test(apiMsg)) {
    const url = (apiMsg.match(/https?:\/\/\S+/i) || [])[0];
    const name = (apiMsg.match(/`([^`]+)`/) || [])[1] || body?.model || "this model";
    const link = (url || "https://console.groq.com/playground").replace(/[.,;)]+$/, "");
    return `"${name}" needs its terms accepted first — it's a one-time thing, per provider account. Open this and accept: ${link} — if you're on a shared or free key, the account owner has to accept for you.`;
  }
  if (apiMsg) return apiMsg;
  return `Request failed (${status}).`;
}

export async function safeJson(res) {
  try { return await res.json(); }
  catch (e) { return null; }
}

export function parseToolArgs(args) {
  try { return JSON.parse(args || "{}"); }
  catch (e) { return {}; }
}

// ── Data-URL / blob helpers ─────────────────────────────────────────
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Invalid data URL");
  }
  const parts = dataUrl.split(",");
  if (parts.length < 2 || !parts[1]) throw new Error("Invalid data URL format");
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  if (!mimeMatch) throw new Error("Invalid data URL mime type");
  const mime = mimeMatch[1];
  try {
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch (e) {
    throw new Error("Failed to decode data URL");
  }
}

export function guessAudioFormat(name) {
  const allowedFormats = new Set(["wav", "mp3", "webm", "ogg", "oga", "m4a", "mp4", "aac", "flac"]);
  const ext = (name.split(".").pop() || "").toLowerCase();
  return allowedFormats.has(ext) ? ext : "wav";
}

// ── Shared SSE streaming loop ─────────────────────────────────────────
// Parses Server-Sent Events and dispatches normalized events via callbacks.
//
// Normalized event format returned by parseEvent(json):
//   { type: "text", text: "delta content" }
//   { type: "thinking", text: "reasoning content" }
//   { type: "tool_call", index, id|null, name|null, arguments|null }
//   { type: "done" }
//
// Callbacks:
//   onToken(fullText)      — text arrived (render with cursor)
//   onFirstToken()         — first text seen (collapse loading phase)
//   onPhase(key, label)    — phase indicator change
//   onThinking(text)       — thinking/reasoning line
//   onDone(fullText)       — stream ended (final render, enhance code)
//   onScroll()             — scroll if sticky
//
// Returns { fullText, toolCalls: [...] }
export async function streamSSE(url, headers, body, parseEvent, callbacks) {
  const ctrl = beginRequest();

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: ctrl.signal,
    ctrl
  }, REQUEST_TIMEOUT_MS);

  if (!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  if (!res.body) throw new Error("Streaming not supported");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";
  const toolCalls = [];
  let firstTokenSeen = false;

  // For Anthropic-style tool blocks that accumulate input_json_delta
  let pendingToolBlocks = {};

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let json;
        try { json = JSON.parse(payload); } catch (e) { continue; }

        const events = parseEvent(json);

        for (const event of events) {
          switch (event.type) {
            case "text":
              if (event.text) {
                if (!firstTokenSeen) {
                  firstTokenSeen = true;
                  callbacks.onFirstToken && callbacks.onFirstToken();
                }
                fullText += event.text;
                callbacks.onToken && callbacks.onToken(fullText);
                callbacks.onScroll && callbacks.onScroll();
              }
              break;

            case "thinking":
              if (event.text && callbacks.onThinking) {
                callbacks.onThinking(event.text);
              }
              break;

            case "tool_call": {
              const idx = event.index ?? 0;
              if (!toolCalls[idx]) toolCalls[idx] = { id: "", name: "", arguments: "" };
              if (event.id) toolCalls[idx].id = event.id;
              if (event.name) toolCalls[idx].name += event.name;
              if (event.arguments) toolCalls[idx].arguments += event.arguments;
              const names = toolCalls.filter(Boolean).map(t => t.name).filter(Boolean).join(", ");
              if (names) callbacks.onPhase && callbacks.onPhase("tool", "Using " + names + "…");
              break;
            }

            case "done":
              // stream finished (OpenAI only sends this; others just close)
              break;
          }
        }
      }
    }

    callbacks.onDone && callbacks.onDone(fullText);
    return { fullText, toolCalls: toolCalls.filter(Boolean) };
  } finally {
    reader.cancel().catch(() => {});
  }
}
