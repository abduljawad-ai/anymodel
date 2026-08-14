/* ============================================================
   CATALOG — bundled model catalog (models.dev, trimmed).
   Providers, models, and capabilities come from models-catalog.json.
   Extra providers (custom, Ollama) and known extra model ids are
   appended here so every provider works out of the box.
============================================================ */

const CATALOG_URL = "models-catalog.json";

let catalogData = null;
let catalogPromise = null;

async function ensureCatalogLoaded(){
  if(catalogData) return catalogData;
  if(catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    const res = await fetch(CATALOG_URL);
    if(!res.ok) throw new Error("Could not load the model catalog.");
    catalogData = await res.json();
    return catalogData;
  })();
  return catalogPromise;
}

/* Providers not listed in models.dev but supported anyway. */
const EXTRA_PROVIDERS = {
  ollama: { id:"ollama", name:"Ollama (local)", api:"http://localhost:11434/v1", format:"openai", models:{} },
  custom: { id:"custom", name:"Custom provider", api:"", format:"openai", models:{} }
};

/* Extra model ids for providers whose catalog entry omits them.
   "" for moderation on mistral means "use the currently selected model". */
const KNOWN_EXTRAS = {
  openai: {
    transcription: "whisper-1",
    tts: "tts-1",
    embeddings: "text-embedding-3-small",
    moderation: "omni-moderation-latest"
  },
  mistral: {
    transcription: "voxtral-mini-latest",
    tts: "voxtral-mini-tts-latest",
    embeddings: "mistral-embed",
    ocr: "mistral-ocr-latest",
    moderation: ""
  },
  groq: {
    transcription: "whisper-large-v3"
  }
};

function allProviders(){
  const merged = Object.assign({}, catalogData ? catalogData.providers : {}, EXTRA_PROVIDERS);
  for(const [pid, p] of Object.entries(merged)){
    if(!p.models) p.models = {};
    const extras = KNOWN_EXTRAS[pid];
    if(extras){
      for(const [kind, mid] of Object.entries(extras)){
        if(!mid || p.models[mid]) continue;
        p.models[mid] = { name: mid, description: kind, input_modalities: [], output_modalities: [] };
      }
    }
  }
  return merged;
}

function providerList(){
  const providers = Object.values(allProviders())
    .filter(p => p.id !== "custom" && p.id !== "ollama")
    .map(p => ({ id:p.id, name:p.name, api:p.api, format:p.format }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [ EXTRA_PROVIDERS.custom, EXTRA_PROVIDERS.ollama, ...providers ];
}

function getProvider(id){
  return allProviders()[id] || null;
}

/* Normalize a catalog model into the app's capability shape. */
function normalizeModel(mid, m, providerId){
  const input = m.input_modalities || [];
  const output = m.output_modalities || [];
  const lowId = mid.toLowerCase();
  const caps = {};
  if(m.attachment || input.includes("image") || input.includes("pdf")) caps.vision = true;
  if(m.tool_call) caps.function_calling = true;
  if(m.reasoning) caps.reasoning = true;
  if(/whisper|transcri|asr|speech-to-text/.test(lowId) || input.includes("audio")) caps.audio_transcription = true;
  if(caps.audio_transcription || input.includes("audio")) caps.audio = true;
  if(/tts|speech/.test(lowId) || output.includes("audio")) caps.tts = true;
  if(/embed/.test(lowId)) caps.embeddings = true;
  if(/moderat|guard/.test(lowId)) caps.moderation = true;
  if(/ocr/.test(lowId)) caps.ocr = true;
  return { id: mid, name: m.name || mid, description: m.description || "", context: m.context || null, provider: providerId, capabilities: caps };
}

function listModels(providerId){
  const p = allProviders()[providerId];
  if(!p) return [];
  return Object.entries(p.models).map(([mid, m]) => normalizeModel(mid, m, providerId));
}

/* Pick a model for a special endpoint kind, or null if the provider
   lacks one. Only OpenAI-compatible providers expose the extra
   endpoints (transcription/TTS/OCR/embeddings/moderation); the
   chat pick works for any provider. */
function pickModel(providerId, kind){
  const p = getProvider(providerId);
  if(!p) return null;
  const entries = Object.entries(p.models || []);
  if(kind === "chat"){
    // Prefer a text-output chat model; skip image/audio/embed/moderation/ocr
    // model ids so we never land on gpt-image-2 or whisper as the default.
    const skip = /dall-e|image|whisper|tts|speech|voice|audio-speech|embed|moderat|guard|ocr|sdxl|flux|stable-diffusion/i;
    let best = null;
    for(const [mid, mm] of entries){
      if(skip.test(mid)) continue;
      const out = mm.output_modalities || [];
      if(!out.includes("text")) continue;
      if(!best || (mm.tool_call && !best[1].tool_call)) best = [mid, mm];
    }
    if(best) return best[0];
    // Fallback: first non-special model even without text output declared.
    const any = entries.find(([mid]) => !skip.test(mid));
    return any ? any[0] : (entries[0] ? entries[0][0] : null);
  }
  if(p.format !== "openai") return null;
  const extras = KNOWN_EXTRAS[providerId];
  if(extras && extras[kind] !== undefined) return extras[kind];
  if(!entries.length) return null;
  const rx = {
    transcription: /whisper|transcri|asr|speech-to-text/i,
    tts: /tts|speech|voice|audio-speech/i,
    ocr: /ocr/i,
    embeddings: /embed/i,
    moderation: /moderat|guard/i
  }[kind];
  const hit = rx ? entries.find(([mid]) => rx.test(mid)) : null;
  if(hit) return hit[0];
  if(kind === "transcription"){
    const m = entries.find(([mid, mm]) => (mm.input_modalities || []).includes("audio"));
    return m ? m[0] : null;
  }
  if(kind === "tts"){
    const m = entries.find(([mid, mm]) => (mm.output_modalities || []).includes("audio"));
    return m ? m[0] : null;
  }
  return null;
}

// Expose globally
window.Catalog = {
  ensureLoaded: ensureCatalogLoaded,
  providerList,
  getProvider,
  listModels,
  pickModel
};
