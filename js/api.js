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
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function guessAudioFormat(name){
  const allowedFormats = new Set(['wav', 'mp3', 'webm', 'ogg', 'oga', 'm4a', 'mp4', 'aac', 'flac']);
  const ext = (name.split(".").pop() || "").toLowerCase();
  return allowedFormats.has(ext) ? ext : "wav";
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
    const res = await fetch(`${getBaseUrl()}/models`, { headers: getAuthHeaders() });
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
    const res = await fetch(base + "/models", { headers });
    return res.ok || res.status === 429 || res.status === 404;
  }catch(e){ return false; }
}

/* ============================================================
   CHAT — OpenAI-compatible provider
============================================================ */

async function streamOpenAI(turn, body){
  const res = await fetch(`${getBaseUrl()}/chat/completions`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ ...body, stream:true })
  });

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
          Markdown.enhanceCodeBlocks(turn.bubble);
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
  const content = [];
  if(text) content.push({ type:"text", text });
  if(image && m.capabilities?.vision) content.push({ type:"image_url", image_url:{ url: image.dataUrl } });
  if(audio && m.capabilities?.audio) content.push({ type:"input_audio", input_audio:{ data: audio.dataUrl.split(",")[1], format: guessAudioFormat(audio.name) } });

  const messages = [];
  if(State.systemPrompt) messages.push({ role:"system", content: State.systemPrompt });
  State.messages.slice(0, -1).forEach(mm => {
    if(mm.role === "user" || mm.role === "assistant") messages.push({ role: mm.role, content: mm.content || "" });
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
  const res = await fetch(`${getBaseUrl()}/messages`, {
    method:"POST",
    headers: { "Content-Type": "application/json", "x-api-key": State.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...body, stream:true })
  });

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
            Markdown.enhanceCodeBlocks(turn.bubble);
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
  const messages = [];
  State.messages.slice(0, -1).forEach(mm => {
    if(mm.role === "user" || mm.role === "assistant") messages.push({ role: mm.role, content: mm.content || "" });
  });

  const content = [];
  if(text) content.push({ type:"text", text });
  if(image && m.capabilities?.vision){
    const [meta, b64] = image.dataUrl.split(",");
    const mime = (meta.match(/^data:(.*?);base64/) || [,"image/png"])[1];
    content.push({ type:"image", source:{ type:"base64", media_type: mime, data: b64 } });
  }
  messages.push({ role:"user", content });

  const body = { model: m.id, max_tokens: 4096, messages };
  if(State.systemPrompt) body.system = State.systemPrompt;
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
    const second = await streamAnthropic(turn, { model: m.id, max_tokens: 4096, messages: followUpMessages, system: body.system, tools: body.tools });
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
  const url = `${getBaseUrl()}/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method:"POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": State.apiKey },
    body: JSON.stringify(body)
  });

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
            Markdown.enhanceCodeBlocks(turn.bubble);
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
  const parts = [];
  if(text) parts.push({ text });
  if(image && m.capabilities?.vision){
    const [meta, b64] = image.dataUrl.split(",");
    const mime = (meta.match(/^data:(.*?);base64/) || [,"image/png"])[1];
    parts.push({ inline_data: { mime_type: mime, data: b64 } });
  }

  const contents = [];
  State.messages.slice(0, -1).forEach(mm => {
    if(mm.role === "user" || mm.role === "assistant"){
      contents.push({ role: mm.role === "assistant" ? "model" : "user", parts: [{ text: mm.content || "" }] });
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
  Chat.setPhase(turn, "audio", "🎙️ Transcribing audio…");
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append("file", blob, "audio.wav");
  form.append("model", modelId);
  const res = await fetch(`${getBaseUrl()}/audio/transcriptions`, {
    method:"POST", headers: getAuthHeaders(), body: form
  });
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const text = data.text || "(no transcription returned)";
  await Chat.revealText(turn, text);
  return text;
}

async function callOcrStreaming(turn, dataUrl, modelId){
  Chat.setPhase(turn, "ocr", "📄 Reading document…");
  const res = await fetch(`${getBaseUrl()}/ocr`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, document:{ type:"image_url", image_url: dataUrl } })
  });
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const pages = data.pages || [];
  const text = pages.map(p => p.markdown || "").join("\n\n") || "(no text extracted)";
  await Chat.revealText(turn, text);
  return text;
}

async function callTtsStreaming(turn, text, modelId){
  Chat.setPhase(turn, "connect", "🔊 Generating speech…");
  const res = await fetch(`${getBaseUrl()}/audio/speech`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text, response_format: "mp3" })
  });
  if(!res.ok) throw new Error(errorMessage(res.status, await safeJson(res)));
  const data = await res.json();
  Chat.collapsePhase(turn);
  const audioB64 = data.audio_data;
  if(!audioB64) throw new Error("No audio returned.");
  turn.bubble.innerHTML = "";
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = "data:audio/mp3;base64," + audioB64;
  turn.bubble.appendChild(audio);
  Chat.scrollIfSticky();
  return { text: "🔊 [Audio response — " + text.slice(0,60) + (text.length > 60 ? "…" : "") + "]" };
}

async function callEmbeddingsStreaming(turn, text, modelId){
  Chat.setPhase(turn, "connect", "📐 Generating embeddings…");
  const res = await fetch(`${getBaseUrl()}/embeddings`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text })
  });
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
  Chat.setPhase(turn, "connect", "🛡️ Moderating content…");
  const res = await fetch(`${getBaseUrl()}/moderations`, {
    method:"POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: modelId, input: text })
  });
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
  callModerationStreaming
};
