/* ============================================================
   CONFIG — anymodel constants and helpers.
   Providers and models come from the bundled catalog
   (models-catalog.json). Only UI metadata lives here.
============================================================ */

const LS_PROVIDER = "anymodel_provider_v1";
const LS_KEYS = "anymodel_keys_v1";
const LS_BASES = "anymodel_bases_v1";
const LS_MODEL_PREFIX = "anymodel_model_";
const LS_SYS = "anymodel_sysprompt_v1";
const LS_MESSAGES = "anymodel_messages_v1";
const LS_SESSIONS = "anymodel_sessions_v1";
const LS_ACTIVE = "anymodel_active_session_v1";

const DEFAULT_PROVIDER = "openai";

/* Map normalized capability flags to human-readable metadata. */
const CAP_META = {
  vision:              { label:"Vision",       icon:"🖼️", short:"vision" },
  function_calling:    { label:"Tools",        icon:"🛠️", short:"tools" },
  reasoning:           { label:"Reasoning",    icon:"🧠", short:"reasoning" },
  audio:               { label:"Audio",        icon:"🎙️", short:"audio" },
  audio_transcription: { label:"Transcribe",   icon:"📝", short:"transcription" },
  tts:                 { label:"TTS",          icon:"🔊", short:"tts" },
  ocr:                 { label:"OCR",          icon:"📄", short:"ocr" },
  embeddings:          { label:"Embeddings",   icon:"📐", short:"embeddings" },
  moderation:          { label:"Moderation",   icon:"🛡️", short:"moderation" }
};

/* Accent colors per provider (header swatch). */
const PROVIDER_COLORS = {
  openai:    "#10A37F",
  anthropic: "#D97757",
  google:    "#4285F4",
  mistral:   "#FF7000",
  groq:      "#F55036",
  deepseek:  "#4D6BFE",
  xai:       "#141414",
  meta:      "#0668E1",
  openrouter:"#FF7A00",
  ollama:    "#8A5CF6",
  custom:    "#8A5CF6"
};

/* Determine the endpoint type for a model from its capabilities.
   This drives which API function gets called and which UI to show. */
function getEndpointType(caps){
  if(caps.audio_transcription) return "transcription";
  if(caps.tts) return "tts";
  if(caps.ocr) return "ocr";
  if(caps.moderation) return "moderation";
  if(caps.embeddings) return "embeddings";
  return "chat";
}

/* Pick a swatch color for a model based on its provider. */
function getModelColor(m){
  const id = (m && m.provider) || State.provider;
  return PROVIDER_COLORS[id] || "#FF7000";
}

/* Display label: catalog name if present, else humanize the model id. */
function getModelLabel(m){
  if(m && m.name) return m.name;
  const id = (m && (m.id || m.name)) || "";
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/* Demo tools for function-calling models. */
const DEMO_TOOLS = [
  { type:"function", function:{ name:"get_current_time", description:"Get the current date and time on the user's device.", parameters:{ type:"object", properties:{}, required:[] } } },
  { type:"function", function:{ name:"calculate", description:"Evaluate a basic arithmetic expression.", parameters:{ type:"object", properties:{ expression:{ type:"string", description:"e.g. (12+8)*3" } }, required:["expression"] } } }
];

/* Safe arithmetic evaluator — replaces eval/Function. Only digits, + - * / % ( ) and decimals. */
function safeEvaluate(expr){
  if(typeof expr !== "string" || expr.trim() === "") throw new Error("Empty expression");
  const cleaned = expr.replace(/\s+/g, "");
  if(!/^[\d+\-*/%().]+$/.test(cleaned)) throw new Error("Invalid expression");
  let pos = 0;
  function peek(){ return cleaned[pos]; }
  function parseExpression(){
    let value = parseTerm();
    while(pos < cleaned.length && (peek() === "+" || peek() === "-")){
      const op = peek(); pos++;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }
  function parseTerm(){
    let value = parseFactor();
    while(pos < cleaned.length && (peek() === "*" || peek() === "/" || peek() === "%")){
      const op = peek(); pos++;
      const rhs = parseFactor();
      if(op === "*") value = value * rhs;
      else if(op === "/") value = value / rhs;
      else value = value % rhs;
    }
    return value;
  }
  function parseFactor(){
    if(peek() === "("){ pos++; const v = parseExpression(); if(peek() !== ")") throw new Error("Mismatched parens"); pos++; return v; }
    if(peek() === "-"){ pos++; return -parseFactor(); }
    if(peek() === "+"){ pos++; return parseFactor(); }
    const start = pos;
    while(pos < cleaned.length && /[\d.]/.test(peek())) pos++;
    const num = cleaned.slice(start, pos);
    if(!num) throw new Error("Expected number");
    const val = Number(num);
    if(!Number.isFinite(val)) throw new Error("Invalid number");
    return val;
  }
  const result = parseExpression();
  if(pos !== cleaned.length) throw new Error("Unexpected characters");
  return result;
}

function runDemoTool(name, argsJson){
  let args = {}; try{ args = JSON.parse(argsJson || "{}"); }catch(e){}
  if(name === "get_current_time") return { now: new Date().toString() };
  if(name === "calculate"){
    try {
      const val = safeEvaluate(args.expression);
      return { result: val };
    }
    catch(e){ return { error:"Could not evaluate expression." }; }
  }
  return { error:"Unknown tool" };
}

/* Shared DOM helper — defined once here so every component file can
   use it without re-declaring `const $` (which would throw a SyntaxError
   in classic shared-global scripts). */
const $ = id => document.getElementById(id);
window.$ = $;

// Expose globally
window.Config = {
  LS_PROVIDER, LS_KEYS, LS_BASES, LS_MODEL_PREFIX, LS_SYS, LS_MESSAGES, LS_SESSIONS, LS_ACTIVE,
  DEFAULT_PROVIDER,
  CAP_META, PROVIDER_COLORS,
  getEndpointType, getModelColor, getModelLabel,
  DEMO_TOOLS, runDemoTool
};
