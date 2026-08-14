/* ============================================================
   API — provider adapters and streaming handlers.
   Routing is by provider format:
     - openai:    POST /chat/completions  (OpenAI-compatible)
     - anthropic: POST /messages          (x-api-key)
     - google:    POST /models/{id}:streamGenerateContent?alt=sse
   Extras (transcription/tts/ocr/embeddings/moderation) are
   OpenAI-compatible and gated by the catalog.
============================================================ */

/* ============================================================
   HELPERS
============================================================ */

/* Active-request cancellation. A new chat request supersedes any
   in-flight one; the UI's stop button aborts it explicitly. */
let currentAbortController = null;

function abortCurrentRequest(){
  if(currentAbortController){
    currentAbortController.abort();
    currentAbortController = null;
  }
}

function beginRequest(){
  abortCurrentRequest();   // never run two streams at once
  const ctrl = new AbortController();
  currentAbortController = ctrl;
  return ctrl;
}

function currentProvider(){
  return (window.Catalog && Catalog.getProvider(State.provider)) || { id: State.provider, name: State.provider, api: "", format: "openai" };
}

function getBaseUrl(){
  return effectiveBase(State.provider);
}

function getAuthHeaders(){
  const p = currentProvider();
  if(!State.apiKey) return {};
  if(p.format === "anthropic"){
    return { "x-api-key": State.apiKey, "anthropic-version": "2023-06-01" };
  }
  if(p.format === "google"){
    return { "x-goog-api-key": State.apiKey };
  }
  return { "Authorization": `Bearer ${State.apiKey}` };
}

function errorMessage(status, body){
  const apiMsg = body?.message || body?.error?.message || (body?.error && typeof body.error === "string" ? body.error : null);
  if(status === 401) return "Invalid API key. Check it in Settings.";
  if(status === 429) return "Rate limit hit — wait a moment and try again.";
  if(apiMsg) return apiMsg;
  return `Request failed (${status}).`;
}

async function safeJson(res){
  try{ return await res.json(); }
  catch(e){ return null; }
}

function parseToolArgs(args){
  try{ return JSON.parse(args || "{}"); }
  catch(e){ return {}; }
}

function dataUrlToBlob(dataUrl){
  if(!dataUrl || typeof dataUrl !== "string"){
    throw new Error("Invalid data URL");
  }
  const parts = dataUrl.split(",");
  if(parts.length < 2 || !parts[1]) throw new Error("Invalid data URL format");
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  if(!mimeMatch) throw new Error("Invalid data URL mime type");
  const mime = mimeMatch[1];
  try{
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }catch(e){
    throw new Error("Failed to decode data URL");
  }
}

function guessAudioFormat(name){
  const allowedFormats = new Set(['wav', 'mp3', 'webm', 'ogg', 'oga', 'm4a', 'mp4', 'aac', 'flac']);
  const ext = (name.split(".").pop() || "").toLowerCase();
  return allowedFormats.has(ext) ? ext : "wav";
}

/* ============================================================
   TOKEN MANAGEMENT — budget-based context windowing.
   Estimates use the provider-documented "1 token ≈ 4 chars"
   rule plus a per-message overhead (OpenAI). Media token
   estimates are computed once at attach time from the
   downscaled dimensions and stored on the message, so we
   never re-decode images here. When a conversation fits the
   model's context budget nothing changes (identical payload);
   only when it grows past the budget do we drop the oldest
   messages, and only a single oversized message is truncated
   (head + tail kept). See docs/token-management-research.md.
============================================================ */

const TOKEN_CHARS = 4;                // ~1 token per 4 chars
const MSG_OVERHEAD_TOKENS = 4;        // OpenAI per-message overhead
const SAFETY_MARGIN_TOKENS = 2000;    // headroom beyond max_tokens
const MAX_SINGLE_MSG_FRACTION = 0.8;  // single-message cap, as fraction of budget

const REQUEST_TIMEOUT_MS = 120000;    // chat streams
const MEDIA_TIMEOUT_MS = 300000;      // transcription/ocr/tts/embeddings/moderation
const MODELS_TIMEOUT_MS = 30000;      // /models listings

function estimateTokens(str){
  return Math.ceil(String(str || "").length / TOKEN_CHARS);
}

function estimateImageTokens(width, height){
  // Anthropic: ~w*h/750. OpenAI (detail=auto, already ≤1024px): 85 + 170*tiles.
  // Google has no exact public formula; the OpenAI tile model is the closest fit.
  if(window.Catalog && Catalog.getProvider && Catalog.getProvider(State.provider)){
    const p = Catalog.getProvider(State.provider);
    if(p && p.format === "anthropic"){
      return Math.round((width * height) / 750);
    }
  }
  const tiles = Math.max(1, Math.ceil(width / 512)) * Math.max(1, Math.ceil(height / 512));
  return 85 + 170 * tiles;
}

function estimateMessageTokens(mm){
  let t = MSG_OVERHEAD_TOKENS + estimateTokens(mm.content);
  if(mm.tokenEstimate) t += mm.tokenEstimate;   // media tokens recorded at attach time
  return t;
}

/* Context window from the catalog/runtime model list, if known. */
function getContextWindow(m){
  const ctx = m && m.context;
  return (typeof ctx === "number" && ctx > 0) ? ctx : null;
}

/* Reserve output headroom. Anthropic requires max_tokens; the
   derived value is capped at 4096 and floored at 1024. */
function getMaxOutputTokens(m){
  const ctx = getContextWindow(m);
  if(!ctx) return null;
  return Math.min(4096, Math.max(1024, Math.round(ctx * 0.2)));
}

/* Last-resort truncation of a single oversized message:
   keep the head (context) and the tail (the actual ask). */
function truncateText(text, maxChars){
  if(text.length <= maxChars) return text;
  const marker = "\n…[truncated to fit the context window]…\n";
  const headLen = Math.floor(maxChars * 0.6);
  const tailLen = maxChars - headLen - marker.length;
  return text.slice(0, headLen) + marker + text.slice(text.length - tailLen);
}

/* Select the history messages to send (oldest → newest) within the
   model's input budget. Walks newest → oldest so the freshest turns
   survive; the newest history message and the current turn are never
   dropped. With no context info we keep today's behavior (send all).
   Returns { messages, singleCapChars } where singleCapChars is the
   per-message size cap the caller must apply to the current turn. */
function selectContext(m, currentText, currentMediaTokens){
  const ctx = getContextWindow(m);
  const history = State.messages.slice(0, -1);

  if(!ctx){
    return { messages: history.map(mm => ({ role: mm.role, content: mm.content || "" })), singleCapChars: Infinity };
  }

  const maxOutput = getMaxOutputTokens(m) || 4096;
  const budget = ctx - maxOutput - SAFETY_MARGIN_TOKENS;
  const singleCapChars = Math.max(1024, Math.floor(budget * MAX_SINGLE_MSG_FRACTION * TOKEN_CHARS));

  // Fixed cost: system prompt + current user message (+ its media).
  let used = estimateTokens(State.systemPrompt)
           + estimateTokens(currentText)
           + (currentMediaTokens || 0)
           + MSG_OVERHEAD_TOKENS * 2;

  const selected = [];
  for(let i = history.length - 1; i >= 0; i--){
    const mm = history[i];
    let content = String(mm.content || "");
    if(content.length > singleCapChars) content = truncateText(content, singleCapChars);
    const est = MSG_OVERHEAD_TOKENS + estimateTokens(content) + (mm.tokenEstimate || 0);
    if(selected.length > 0 && used + est > budget) break;   // drop this and everything older
    selected.unshift({ role: mm.role, content });
    used += est;
  }

  return { messages: selected, singleCapChars };
}

/* fetch with an abort-triggered timeout. On timeout the underlying
   request is aborted and a plain Error (NOT AbortError) is thrown so
   the caller surfaces a real error instead of treating it as a stop. */
function fetchWithTimeout(url, opts, timeoutMs){
  const ctrl = opts && opts.ctrl;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if(ctrl) ctrl.abort();
      reject(new Error("Request timed out — the provider did not respond in time."));
    }, timeoutMs);
    fetch(url, opts).then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

/* ============================================================
   MODELS
============================================================ */

async function fetchModels(){
  if(State.modelsLoaded) return State.models;
  const provider = State.provider;   // capture; bail if provider changes mid-flight

  await Catalog.ensureLoaded();
  if(State.provider !== provider) return [];
  State.models = Catalog.listModels(State.provider);

  // Providers without a catalog entry (custom, Ollama, exotic setups):
  // ask the API for its model list at runtime.
  if(!State.models.length && getBaseUrl()){
    const ctrl = new AbortController();
    const res = await fetchWithTimeout(`${getBaseUrl()}/models`, { headers: getAuthHeaders(), signal: ctrl.signal, ctrl }, MODELS_TIMEOUT_MS);
    if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
    const data = await res.json();
    if(State.provider !== provider) return [];
    State.models = (data.data || []).map(md => ({
      id: md.id,
      name: md.id,
      description: md.description || "",
      context: md.context_length || null,
      provider: State.provider,
      capabilities: {}
    }));
  }

  State.modelsLoaded = true;
  if(!State.model && State.models.length){
    const smart = (window.Catalog && Catalog.pickModel) ? Catalog.pickModel(State.provider, "chat") : null;
    setModel(smart || State.models[0].id);
  }
  return State.models;
}

/* Verify a provider connection from Settings (key + base URL). */
async function testConnection(providerId, key){
  const p = (window.Catalog && Catalog.getProvider(providerId)) || null;
  const base = State.customBases[providerId] || (p ? p.api : "") || (providerId === "custom" ? (State.customBases.custom || "") : "");
  if(!base) return false;
  let headers = { "Content-Type": "application/json" };
  if(p && p.format === "anthropic"){ headers["x-api-key"] = key; headers["anthropic-version"] = "2023-06-01"; }
  else if(p && p.format === "google"){ headers["x-goog-api-key"] = key; }
  else { headers["Authorization"] = `Bearer ${key}`; }
  try{
    const ctrl = new AbortController();
    const res = await fetchWithTimeout(base + "/models", { headers, signal: ctrl.signal, ctrl }, MODELS_TIMEOUT_MS);
    return res.ok || res.status === 429 || res.status === 404;
  }catch(e){ return false; }
}

/* ============================================================
   CHAT — OpenAI-compatible provider
============================================================ */

async function streamOpenAI(turn, body){
  const ctrl = beginRequest();
  const res = await fetchWithTimeout(`${getBaseUrl()}/chat/completions`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ ...body, stream:true }),
    signal: ctrl.signal,
    ctrl
  }, REQUEST_TIMEOUT_MS);

  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  if(!res.body) throw new Error("Streaming not supported");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";
  let toolCalls = [];
  let firstTokenSeen = false;

  try {
    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buf += decoder.decode(value, { stream:true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if(!payload || payload === "[DONE]") continue;
        let json;
        try{ json = JSON.parse(payload); } catch(e){ continue; }
        const delta = json.choices?.[0]?.delta;
        if(!delta) continue;

        if(delta.content){
          if(!firstTokenSeen){ firstTokenSeen = true; Chat.collapsePhase(turn); }
          fullText += delta.content;
          turn.bubble.innerHTML = Markdown.renderMarkdownish(fullText) + '<span class="type-cursor"></span>';
          Markdown.scheduleHighlight(turn.bubble);
          Chat.scrollIfSticky();
        }
        if(delta.tool_calls){
          delta.tool_calls.forEach(tc => {
            const idx = tc.index ?? 0;
            if(!toolCalls[idx]) toolCalls[idx] = { id:"", name:"", arguments:"" };
            if(tc.id) toolCalls[idx].id = tc.id;
            if(tc.function?.name) toolCalls[idx].name += tc.function.name;
            if(tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
          });
          const names = toolCalls.filter(Boolean).map(t=>t.name).filter(Boolean).join(", ");
          if(names) Chat.setPhase(turn, "tool", "🛠️ Using " + names + "…");
        }
      }
    }

    if(fullText) turn.bubble.innerHTML = Markdown.renderMarkdownish(fullText);
    Markdown.enhanceCodeBlocks(turn.bubble);
    return { fullText, toolCalls: toolCalls.filter(Boolean) };
  } catch(err) {
    throw err;
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function chatOpenAI(turn, text, image, audio, m){
  const mediaTokens = (image && image.tokenEstimate) || 0;
  const ctx = selectContext(m, text, mediaTokens);
  if(text.length > ctx.singleCapChars) text = truncateText(text, ctx.singleCapChars);

  const content = [];
  if(text) content.push({ type:"text", text });
  if(image && m.capabilities?.vision) content.push({ type:"image_url", image_url:{ url: image.dataUrl } });
  if(audio && m.capabilities?.audio) content.push({ type:"input_audio", input_audio:{ data: audio.dataUrl.split(",")[1], format: guessAudioFormat(audio.name) } });

  const messages = [];
  if(State.systemPrompt) messages.push({ role:"system", content: State.systemPrompt });
  ctx.messages.forEach(mm => {
    if(mm.role === "user" || mm.role === "assistant") messages.push({ role: mm.role, content: mm.content });
  });
  messages.push({ role:"user", content: content.length > 1 ? content : (text || "") });

  const body = { model: m.id, messages };
  if(m.capabilities?.function_calling && State.autoTools){ body.tools = Config.DEMO_TOOLS; body.tool_choice = "auto"; }

  Chat.setPhase(turn, m.capabilities?.reasoning ? "thinking" : "connect", m.capabilities?.reasoning ? "🧠 Thinking…" : "💭 Thinking…");

  const first = await streamOpenAI(turn, body);

  if(first.toolCalls.length){
    const toolResults = first.toolCalls.map(tc => ({
      role:"tool", name:tc.name, tool_call_id: tc.id,
      content: JSON.stringify(Config.runDemoTool(tc.name, tc.arguments))
    }));
    const followUpMessages = [
      ...messages,
      { role:"assistant", content: first.fullText || "", tool_calls: first.toolCalls.map(tc => ({ id:tc.id, type:"function", function:{ name:tc.name, arguments:tc.arguments } })) },
      ...toolResults
    ];
    const toolNames = first.toolCalls.map(t => t.name).join(", ");
    Chat.setPhase(turn, "tool", "🛠️ Using " + toolNames + "…");
    const second = await streamOpenAI(turn, { model: m.id, messages: followUpMessages });
    return { text: second.fullText || "(tool call completed)", toolUsed: toolNames };
  }

  return { text: first.fullText || "(no content)" };
}

/* ============================================================
   CHAT — Anthropic
============================================================ */

async function streamAnthropic(turn, body){
  const ctrl = beginRequest();
  const res = await fetchWithTimeout(`${getBaseUrl()}/messages`, {
    method:"POST",
    headers: { "Content-Type": "application/json", "x-api-key": State.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...body, stream:true }),
    signal: ctrl.signal,
    ctrl
  }, REQUEST_TIMEOUT_MS);

  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  if(!res.body) throw new Error("Streaming not supported");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";
  let toolCalls = [];
  let currentBlock = null;   // { type, id, name, args }
  let firstTokenSeen = false;

  function flushBlock(){
    if(currentBlock && currentBlock.type === "tool_use"){
      toolCalls.push({ id: currentBlock.id, name: currentBlock.name, arguments: currentBlock.args });
    }
    currentBlock = null;
  }

  try {
    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buf += decoder.decode(value, { stream:true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if(!payload) continue;
        let json;
        try{ json = JSON.parse(payload); } catch(e){ continue; }

        const type = json.type;
        if(type === "content_block_start"){
          const block = json.content_block || {};
          if(block.type === "tool_use"){
            currentBlock = { type:"tool_use", id: block.id || "", name: block.name || "", args: "" };
            Chat.setPhase(turn, "tool", "🛠️ Using " + block.name + "…");
          } else {
            currentBlock = { type:"text" };
          }
        } else if(type === "content_block_delta"){
          const delta = json.delta || {};
          if(delta.type === "text_delta" && delta.text){
            if(!firstTokenSeen){ firstTokenSeen = true; Chat.collapsePhase(turn); }
            fullText += delta.text;
            turn.bubble.innerHTML = Markdown.renderMarkdownish(fullText) + '<span class="type-cursor"></span>';
            Markdown.scheduleHighlight(turn.bubble);
            Chat.scrollIfSticky();
          } else if(delta.type === "input_json_delta" && currentBlock && currentBlock.type === "tool_use" && delta.partial_json){
            currentBlock.args += delta.partial_json;
          }
        } else if(type === "content_block_stop"){
          flushBlock();
        }
      }
    }
    flushBlock();
    if(fullText) turn.bubble.innerHTML = Markdown.renderMarkdownish(fullText);
    Markdown.enhanceCodeBlocks(turn.bubble);
    return { fullText, toolCalls };
  } catch(err) {
    throw err;
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function chatAnthropic(turn, text, image, audio, m){
  const mediaTokens = (image && image.tokenEstimate) || 0;
  const ctx = selectContext(m, text, mediaTokens);
  if(text.length > ctx.singleCapChars) text = truncateText(text, ctx.singleCapChars);

  const messages = [];
  ctx.messages.forEach(mm => {
    if(mm.role === "user" || mm.role === "assistant") messages.push({ role: mm.role, content: mm.content });
  });

  const content = [];
  if(text) content.push({ type:"text", text });
  if(image && m.capabilities?.vision){
    const [meta, b64] = image.dataUrl.split(",");
    const mime = (meta.match(/^data:(.*?);base64/) || [,"image/png"])[1];
    content.push({ type:"image", source:{ type:"base64", media_type: mime, data: b64 } });
  }
  messages.push({ role:"user", content });

  const body = { model: m.id, max_tokens: getMaxOutputTokens(m) || 4096, messages };
  if(State.systemPrompt){
    // Anthropic prompt caching (ephemeral):
    //  - explicit breakpoint on the system prompt keeps it cached even when
    //    the user switches conversations (system sits at the front of every
    //    request's prefix);
    //  - the top-level automatic breakpoint follows the growing conversation,
    //    moving forward each turn (its 20-block lookback finds the previous
    //    write, so only the new tail is billed).
    // Together they use 2 of the 4 allowed breakpoints. Undersized prompts
    // are silently skipped by the API (no error, no cache), so no threshold
    // logic is needed here. See docs/token-management-research.md D5.
    body.system = [{ type: "text", text: State.systemPrompt, cache_control: { type: "ephemeral" } }];
  }
  body.cache_control = { type: "ephemeral" };
  if(m.capabilities?.function_calling && State.autoTools){
    body.tools = Config.DEMO_TOOLS.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
  }

  Chat.setPhase(turn, m.capabilities?.reasoning ? "thinking" : "connect", m.capabilities?.reasoning ? "🧠 Thinking…" : "💭 Thinking…");

  const first = await streamAnthropic(turn, body);

  if(first.toolCalls.length){
    const assistantContent = [];
    if(first.fullText) assistantContent.push({ type:"text", text: first.fullText });
    first.toolCalls.forEach(tc => assistantContent.push({ type:"tool_use", id: tc.id, name: tc.name, input: parseToolArgs(tc.arguments) }));
    const toolResults = first.toolCalls.map(tc => ({
      role:"user",
      content: [{ type:"tool_result", tool_use_id: tc.id, content: JSON.stringify(Config.runDemoTool(tc.name, tc.arguments)) }]
    }));
    const followUpMessages = [
      ...messages,
      { role:"assistant", content: assistantContent },
      ...toolResults
    ];
    const toolNames = first.toolCalls.map(t => t.name).join(", ");
    Chat.setPhase(turn, "tool", "🛠️ Using " + toolNames + "…");
    const second = await streamAnthropic(turn, { model: m.id, max_tokens: body.max_tokens, messages: followUpMessages, system: body.system, tools: body.tools, cache_control: body.cache_control });
    return { text: second.fullText || "(tool call completed)", toolUsed: toolNames };
  }

  return { text: first.fullText || "(no content)" };
}

/* ============================================================
   CHAT — Google (Gemini)
============================================================ */

function parseGoogleResponse(data){
  let fullText = "";
  const toolCalls = [];
  (data.candidates || []).forEach(c => {
    (c.content?.parts || []).forEach(p => {
      if(p.text) fullText += p.text;
      if(p.functionCall){
        toolCalls.push({ id: "fc_" + toolCalls.length, name: p.functionCall.name || "", arguments: JSON.stringify(p.functionCall.args || {}) });
      }
    });
  });
  if(!fullText && data.error){ throw new Error(data.error.message || "Request failed."); }
  return { fullText, toolCalls };
}

async function streamGoogle(turn, modelId, body){
  const ctrl = beginRequest();
  const url = `${getBaseUrl()}/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`;
  const res = await fetchWithTimeout(url, {
    method:"POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": State.apiKey },
    body: JSON.stringify(body),
    signal: ctrl.signal,
    ctrl
  }, REQUEST_TIMEOUT_MS);

  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));

  if(!res.body){
    // Non-streaming fallback
    const data = await res.json();
    const result = parseGoogleResponse(data);
    if(result.fullText){
      turn.bubble.innerHTML = Markdown.renderMarkdownish(result.fullText);
      Markdown.enhanceCodeBlocks(turn.bubble);
    }
    return result;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";
  let toolCalls = [];
  let firstTokenSeen = false;

  try {
    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buf += decoder.decode(value, { stream:true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if(!payload || payload === "[DONE]") continue;
        let json;
        try{ json = JSON.parse(payload); } catch(e){ continue; }

        const parts = json.candidates?.[0]?.content?.parts;
        if(!parts) continue;
        for(const p of parts){
          if(p.text){
            if(!firstTokenSeen){ firstTokenSeen = true; Chat.collapsePhase(turn); }
            fullText += p.text;
            turn.bubble.innerHTML = Markdown.renderMarkdownish(fullText) + '<span class="type-cursor"></span>';
            Markdown.scheduleHighlight(turn.bubble);
            Chat.scrollIfSticky();
          }
          if(p.functionCall){
            toolCalls.push({ id: "fc_" + toolCalls.length, name: p.functionCall.name || "", arguments: JSON.stringify(p.functionCall.args || {}) });
          }
        }
      }
    }
    if(fullText) turn.bubble.innerHTML = Markdown.renderMarkdownish(fullText);
    Markdown.enhanceCodeBlocks(turn.bubble);
    return { fullText, toolCalls };
  } catch(err) {
    throw err;
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function chatGoogle(turn, text, image, audio, m){
  const mediaTokens = (image && image.tokenEstimate) || 0;
  const ctx = selectContext(m, text, mediaTokens);
  if(text.length > ctx.singleCapChars) text = truncateText(text, ctx.singleCapChars);

  const parts = [];
  if(text) parts.push({ text });
  if(image && m.capabilities?.vision){
    const [meta, b64] = image.dataUrl.split(",");
    const mime = (meta.match(/^data:(.*?);base64/) || [,"image/png"])[1];
    parts.push({ inline_data: { mime_type: mime, data: b64 } });
  }

  const contents = [];
  ctx.messages.forEach(mm => {
    if(mm.role === "user" || mm.role === "assistant"){
      contents.push({ role: mm.role === "assistant" ? "model" : "user", parts: [{ text: mm.content }] });
    }
  });
  contents.push({ role:"user", parts });

  const body = { contents };
  if(State.systemPrompt) body.systemInstruction = { parts: [{ text: State.systemPrompt }] };
  if(m.capabilities?.function_calling && State.autoTools){
    body.tools = [{
      functionDeclarations: Config.DEMO_TOOLS.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters }))
    }];
  }

  Chat.setPhase(turn, m.capabilities?.reasoning ? "thinking" : "connect", m.capabilities?.reasoning ? "🧠 Thinking…" : "💭 Thinking…");

  const first = await streamGoogle(turn, m.id, body);

  if(first.toolCalls.length){
    const followUpContents = [
      ...contents,
      { role:"model", parts: first.toolCalls.map(tc => ({ functionCall: { name: tc.name, args: parseToolArgs(tc.arguments) } })) },
      { role:"user", parts: first.toolCalls.map(tc => ({ functionResponse: { name: tc.name, response: { result: Config.runDemoTool(tc.name, tc.arguments) } } })) }
    ];
    const toolNames = first.toolCalls.map(t => t.name).join(", ");
    Chat.setPhase(turn, "tool", "🛠️ Using " + toolNames + "…");
    const second = await streamGoogle(turn, m.id, { ...body, contents: followUpContents });
    return { text: second.fullText || "(tool call completed)", toolUsed: toolNames };
  }

  return { text: first.fullText || "(no content)" };
}

async function callChatStreaming(turn, text, image, audio, m){
  const p = currentProvider();
  if(p.format === "anthropic") return chatAnthropic(turn, text, image, audio, m);
  if(p.format === "google") return chatGoogle(turn, text, image, audio, m);
  return chatOpenAI(turn, text, image, audio, m);
}

/* ============================================================
   OTHER ENDPOINTS — OpenAI-compatible (provider-gated)
============================================================ */

async function callTranscriptionStreaming(turn, dataUrl, modelId){
  const ctrl = beginRequest();
  Chat.setPhase(turn, "audio", "🎙️ Transcribing audio…");
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append("file", blob, "audio.wav");
  form.append("model", modelId);
  const res = await fetchWithTimeout(`${getBaseUrl()}/audio/transcriptions`, {
    method:"POST", headers: getAuthHeaders(), body: form, signal: ctrl.signal, ctrl
  }, MEDIA_TIMEOUT_MS);
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const text = data.text || "(no transcription returned)";
  await Chat.revealText(turn, text);
  return text;
}

async function callOcrStreaming(turn, dataUrl, modelId){
  const ctrl = beginRequest();
  Chat.setPhase(turn, "ocr", "📄 Reading document…");
  const res = await fetchWithTimeout(`${getBaseUrl()}/ocr`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, document:{ type:"image_url", image_url: dataUrl } }),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const pages = data.pages || [];
  const text = pages.map(p => p.markdown || "").join("\n\n") || "(no text extracted)";
  await Chat.revealText(turn, text);
  return text;
}

async function callTtsStreaming(turn, text, modelId){
  const ctrl = beginRequest();
  Chat.setPhase(turn, "connect", "🔊 Generating speech…");
  const body = { model: modelId, input: text, response_format: "mp3" };
  // Some TTS models (e.g. Orpheus on Groq) require a voice — it's
  // user-configurable in Settings and sent only when set.
  const voice = (State.ttsVoice || "").trim();
  if(voice) body.voice = voice;
  const res = await fetchWithTimeout(`${getBaseUrl()}/audio/speech`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  Chat.collapsePhase(turn);

  const ctype = res.headers.get("content-type") || "";
  let src, raw;
  if(ctype.indexOf("json") !== -1){
    // Nonstandard providers return base64 JSON: { audio_data: "..." }
    const data = await res.json();
    const audioB64 = data.audio_data;
    if(!audioB64) throw new Error("No audio returned.");
    src = "data:audio/mp3;base64," + audioB64;
  } else {
    // OpenAI/Groq standard: raw audio bytes
    const blob = await res.blob();
    src = URL.createObjectURL(blob);
    raw = blob;   // waveform decoding needs bytes — fetch(blob:…) is CSP-blocked
  }

  turn.bubble.innerHTML = "";
  if(window.VoiceCapsule) VoiceCapsule.build(turn.bubble, { src, raw });
  Chat.scrollIfSticky();
  return { text: "🔊 [Audio response — " + text.slice(0,60) + (text.length > 60 ? "…" : "") + "]" };
}

async function callEmbeddingsStreaming(turn, text, modelId){
  const ctrl = beginRequest();
  Chat.setPhase(turn, "connect", "📐 Generating embeddings…");
  const res = await fetchWithTimeout(`${getBaseUrl()}/embeddings`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text }),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const emb = data.data?.[0]?.embedding || [];
  const dim = emb.length;
  const preview = emb.slice(0, 8).map(v => v.toFixed(6)).join(", ");
  const mdText = "**Embedding generated**\n\n- **Model:** " + (data.model || modelId) + "\n- **Dimension:** " + dim + "\n- **First 8 values:** `" + preview + (dim > 8 ? ", …" : "") + "`\n- **Tokens used:** " + (data.usage?.total_tokens || "N/A");
  await Chat.revealText(turn, mdText);
  return mdText;
}

async function callModerationStreaming(turn, text, modelId){
  const ctrl = beginRequest();
  Chat.setPhase(turn, "connect", "🛡️ Moderating content…");
  const res = await fetchWithTimeout(`${getBaseUrl()}/moderations`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text }),
    signal: ctrl.signal,
    ctrl
  }, MEDIA_TIMEOUT_MS);
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const result = data.results?.[0];
  if(!result) throw new Error("No moderation results.");
  const cats = result.categories || {};
  const scores = result.category_scores || {};
  const flagged = Object.entries(cats).filter(([_,v]) => v).map(([k]) => k);
  let mdText = `**Moderation Results**\n\n- **Model:** ${data.model || modelId}\n- **Flagged categories:** ${flagged.length ? flagged.join(", ") : "None ✓"}\n\n| Category | Flagged | Score |\n|----------|---------|-------|\n`;
  for(const [cat, flag] of Object.entries(cats)){
    const score = scores[cat] !== undefined ? scores[cat].toFixed(6) : "N/A";
    mdText += `| ${cat} | ${flag ? "⚠️ Yes" : "✓ No"} | ${score} |\n`;
  }
  await Chat.revealText(turn, mdText);
  return mdText;
}

// Expose globally
window.Api = {
  fetchModels,
  testConnection,
  callChatStreaming,
  callTranscriptionStreaming,
  callOcrStreaming,
  callTtsStreaming,
  callEmbeddingsStreaming,
  callModerationStreaming,
  abortCurrentRequest,
  estimateTokens,
  estimateImageTokens,
  selectContext,
  getMaxOutputTokens,
  getContextWindow,
  truncateText
};
