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
const LS_TTS_VOICE = "anymodel_tts_voice_v1";

const DEFAULT_PROVIDER = "openai";

/* Map normalized capability flags to human-readable metadata. */
const CAP_META = {
  vision:                 { label:"Image",           icon:"Image",           short:"vision" },
  function_calling:       { label:"Tools",           icon:"Tools",           short:"tools" },
  reasoning:              { label:"Reasoning",       icon:"Reasoning",       short:"reasoning" },
  audio:                  { label:"Audio",           icon:"Audio",           short:"audio" },
  audio_transcription:    { label:"STT",             icon:"STT",             short:"transcription" },
  tts:                    { label:"TTS",             icon:"TTS",             short:"tts" },
  ocr:                    { label:"OCR",             icon:"OCR",             short:"ocr" },
  embeddings:             { label:"Embeddings",      icon:"Embeddings",      short:"embeddings" },
  moderation:             { label:"Moderation",      icon:"Moderation",      short:"moderation" },
  web_search:             { label:"Search",          icon:"Search",          short:"search" },
  parallel_tool_calling:  { label:"PTC",             icon:"PTC",             short:"ptc" },
  image_generation:       { label:"Image Gen",       icon:"Image Gen",       short:"image_gen" },
  code_interpreter:       { label:"Code",            icon:"Code",            short:"code" },
  thinking:               { label:"Thinking",        icon:"Thinking",        short:"thinking" },
  image_editing:          { label:"Image Edit",      icon:"Image Edit",      short:"image_edit" },
  image_understanding:    { label:"Image Under",     icon:"Image Under",     short:"image_under" },
  image_variation:        { label:"Image Var",       icon:"Image Var",       short:"image_var" },
  image_upscaling:        { label:"Image Up",        icon:"Image Up",        short:"image_up" },
  image_inpainting:       { label:"Image In",        icon:"Image In",        short:"image_in" },
  image_outpainting:      { label:"Image Out",       icon:"Image Out",       short:"image_out" },
  image_masking:          { label:"Image Mask",      icon:"Image Mask",      short:"image_mask" },
  image_segmentation:     { label:"Image Seg",       icon:"Image Seg",       short:"image_seg" },
  image_depth:            { label:"Image Depth",     icon:"Image Depth",     short:"image_depth" },
  image_normal:           { label:"Image Norm",      icon:"Image Norm",      short:"image_norm" },
  image_denoising:        { label:"Image Den",       icon:"Image Den",       short:"image_den" },
  image_super_resolution: { label:"Image SR",        icon:"Image SR",        short:"image_sr" },
  image_style_transfer:   { label:"Image Style",     icon:"Image Style",     short:"image_style" },
  image_animation:        { label:"Image Anim",      icon:"Image Anim",      short:"image_anim" },
  image_3d:               { label:"Image 3D",        icon:"Image 3D",        short:"image_3d" },
  image_3d_view:          { label:"Image 3D View",   icon:"Image 3D View",   short:"image_3d_view" },
  image_3d_model:         { label:"Image 3D Mod",    icon:"Image 3D Mod",    short:"image_3d_model" },
  image_3d_texture:       { label:"Image 3D Tex",    icon:"Image 3D Tex",    short:"image_3d_texture" },
  image_3d_render:        { label:"Image 3D Ren",    icon:"Image 3D Ren",    short:"image_3d_render" },
  image_3d_animation:     { label:"Image 3D Anim",   icon:"Image 3D Anim",   short:"image_3d_animation" },
  image_3d_asset:         { label:"Image 3D Asset",  icon:"Image 3D Asset",  short:"image_3d_asset" },
  image_3d_character:     { label:"Image 3D Char",   icon:"Image 3D Char",   short:"image_3d_character" },
  image_3d_environment:   { label:"Image 3D Env",    icon:"Image 3D Env",    short:"image_3d_environment" },
  image_3d_object:        { label:"Image 3D Obj",    icon:"Image 3D Obj",    short:"image_3d_object" },
  image_3d_scene:         { label:"Image 3D Scene",  icon:"Image 3D Scene",  short:"image_3d_scene" },
  image_3d_style:         { label:"Image 3D Style",  icon:"Image 3D Style",  short:"image_3d_style" },
  image_3d_tool:          { label:"Image 3D Tool",   icon:"Image 3D Tool",   short:"image_3d_tool" },
  image_3d_utility:       { label:"Image 3D Util",   icon:"Image 3D Util",   short:"image_3d_utility" },
  image_3d_variation:     { label:"Image 3D Var",    icon:"Image 3D Var",    short:"image_3d_variation" },
  image_3d_viewer:        { label:"Image 3D Viewer", icon:"Image 3D Viewer", short:"image_3d_viewer" },
  image_3d_visualization: { label:"Image 3D Vis",    icon:"Image 3D Vis",    short:"image_3d_visualization" },
  image_3d_voxel:         { label:"Image 3D Vox",    icon:"Image 3D Vox",    short:"image_3d_voxel" },
  image_3d_wireframe:     { label:"Image 3D Wire",   icon:"Image 3D Wire",   short:"image_3d_wireframe" },
  image_3d_xray:          { label:"Image 3D Xray",   icon:"Image 3D Xray",   short:"image_3d_xray" },
  image_3d_zoom:          { label:"Image 3D Zoom",   icon:"Image 3D Zoom",   short:"image_3d_zoom" },
  image_3d_zoom_in:       { label:"Image 3D Zoom In",icon:"Image 3D Zoom In",short:"image_3d_zoom_in" },
  image_3d_zoom_out:      { label:"Image 3D Zoom Out",icon:"Image 3D Zoom Out",short:"image_3d_zoom_out" },
  image_3d_zoom_to:       { label:"Image 3D Zoom To",icon:"Image 3D Zoom To",short:"image_3d_zoom_to" },
  image_3d_zoom_to_fit:   { label:"Image 3D Zoom Fit",icon:"Image 3D Zoom Fit",short:"image_3d_zoom_to_fit" },
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

/* Shared focus helpers for modal dialogs/sheets (role="dialog" aria-modal="true"
   must keep keyboard focus inside while open — WCAG 2.4.3). Same shared-global
   pattern as `$` above. */
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusFirst(root){
  const el = root.querySelector(FOCUSABLE);
  if(el) el.focus({ preventScroll:true });
  return !!el;
}

function trapFocus(root){
  return function(e){
    if(e.key !== "Tab") return;
    const els = Array.prototype.filter.call(
      root.querySelectorAll(FOCUSABLE),
      el => el.offsetParent !== null || el === document.activeElement
    );
    if(!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    const inside = root.contains(document.activeElement);
    if(e.shiftKey && (!inside || document.activeElement === first)){
      e.preventDefault();
      last.focus({ preventScroll:true });
    } else if(!e.shiftKey && (!inside || document.activeElement === last)){
      e.preventDefault();
      first.focus({ preventScroll:true });
    }
  };
}

window.focusFirst = focusFirst;
window.trapFocus = trapFocus;

// Expose globally
window.Config = {
  LS_PROVIDER, LS_KEYS, LS_BASES, LS_MODEL_PREFIX, LS_SYS, LS_MESSAGES, LS_SESSIONS, LS_ACTIVE, LS_TTS_VOICE,
  DEFAULT_PROVIDER,
  CAP_META, PROVIDER_COLORS,
  getEndpointType, getModelColor, getModelLabel,
  DEMO_TOOLS, runDemoTool
};
