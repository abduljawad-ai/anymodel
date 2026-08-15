/* ============================================================
   MODEL PICKER — Gemini-style dropdown anchored to the composer
   model pill. Provider chip strip + type-to-filter model list;
   Arrow keys + Enter, Escape to close, click-away closes.
============================================================ */
(function(){

/* ============================================================
   HELPERS
============================================================ */

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }

function providerName(){
  const p = window.Catalog ? Catalog.getProvider(State.provider) : null;
  return (p && p.name) || State.provider;
}

/* ============================================================
   MODULE STATE
============================================================ */

let filterValue = "";
let highlightedIndex = -1;
let visibleRows = [];   // flat list of { id, providerId } for keyboard navigation
let allModelsCache = null; // cached cross-provider model list
let anchorEl = null;
let isOpen = false;

/* ============================================================
   RENDERING
============================================================ */

/* Capability → search keywords. Every active capability contributes its
   synonyms to the search space, so queries like "tts", "stt", "vision",
   "tools", "search", "reasoning" find models by type. */
const CAP_KEYWORDS = {
  tts:                   ["tts", "text-to-speech", "speech", "voice"],
  audio_transcription:   ["stt", "transcri", "asr", "speech-to-text", "transcription"],
  vision:                ["vision", "image", "photo", "visual"],
  function_calling:      ["tool", "tools", "function", "functions", "function calling"],
  reasoning:             ["reason", "reasoning"],
  thinking:              ["think", "thinking"],
  web_search:            ["search", "web search", "web"],
  ocr:                   ["ocr", "text extraction"],
  embeddings:            ["embed", "embedding", "embeddings"],
  audio:                 ["audio"],
  moderation:            ["moderat", "guard"],
  code_interpreter:      ["code", "interpreter"],
  image_generation:      ["image gen", "image generation"],
  parallel_tool_calling: ["ptc", "parallel tool"]
};

/* Collect the search keywords a model matches via its capabilities. */
function modelKeywords(m){
  const caps = m.capabilities || {};
  const kws = new Set();
  for(const [k, active] of Object.entries(caps)){
    if(!active) continue;
    (CAP_KEYWORDS[k] || []).forEach(w => kws.add(w));
    const meta = Config.CAP_META[k];
    if(meta){
      kws.add(String(meta.label || "").toLowerCase());
      if(meta.short) kws.add(String(meta.short).toLowerCase());
    }
  }
  return kws;
}

/* Token-based match: every whitespace-separated token in the query must
   hit the model id/label/description, its provider name/id, or one of its
   capability keywords. So "groq tts" lists TTS models from Groq and
   "google reasoning" lists reasoning models from Google. */
function modelMatches(m){
  const q = filterValue.trim().toLowerCase();
  if(!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const id = (m.id || "").toLowerCase();
  const label = (Config.getModelLabel(m) || "").toLowerCase();
  const desc = (m.description || "").toLowerCase();
  const pName = (m.providerName || "").toLowerCase();
  const pId = (m.providerId || m.provider || "").toLowerCase();
  const haystack = [id, label, desc, pName, pId].join(" ");
  const kws = [...modelKeywords(m)];

  return tokens.every(tok => {
    if(haystack.includes(tok)) return true;
    return kws.some(kw => kw && (tok.includes(kw) || kw.includes(tok)));
  });
}

/* Build a flat list of all models across all providers (cached). */
async function getAllModels(){
  if(allModelsCache) return allModelsCache;
  await Catalog.ensureLoaded();
  const providers = Catalog.providerList();
  const all = [];
  for(const p of providers){
    if(p.id === "custom" || p.id === "ollama") continue;
    const models = Catalog.listModels(p.id);
    for(const m of models){
      all.push({ ...m, providerId: p.id, providerName: p.name });
    }
  }
  allModelsCache = all;
  return all;
}

function clearAllModelsCache(){
  allModelsCache = null;
}

function applyHighlight(){
  const rows = $("modelListBody").querySelectorAll(".picker-row");
  rows.forEach(row => row.classList.toggle("picker-row-active", Number(row.dataset.idx) === highlightedIndex));
  const active = $("modelListBody").querySelector(".picker-row-active");
  if(active && active.scrollIntoView) active.scrollIntoView({ block:"nearest" });
}

function providerChipsHtml(){
  const providers = window.Catalog ? Catalog.providerList() : [];
  return providers.map(p =>
    `<button class="model-provider-chip${p.id === State.provider ? " active" : ""}" data-provider="${esc(p.id)}">${esc(p.name)}</button>`
  ).join("");
}

function wireProviderChips(){
  $("modelPopProviders").querySelectorAll(".model-provider-chip").forEach(chip => {
    chip.addEventListener("click", () => setProvider(chip.dataset.provider));
    // setProvider() calls ModelPicker.refresh() via its own hook (state.js)
  });
}

async function buildModelSheet(){
  const q = filterValue.trim().toLowerCase();
  let modelsToShow;
  let isCrossProvider = q.length > 0;

  if(isCrossProvider){
    const all = await getAllModels();
    modelsToShow = all.filter(modelMatches);
  }else{
    modelsToShow = State.models.filter(modelMatches);
  }

  let html = "";
  visibleRows = [];
  
  if(isCrossProvider){
    html += `<div class="picker-group-label">All providers (${modelsToShow.length} results)</div>`;
  }else{
    html += `<div class="picker-group-label">${esc(providerName())}</div>`;
  }

  modelsToShow.forEach(m => {
    const idx = visibleRows.length;
    // normalizeModel() sets `provider`; getAllModels() spreads providerId on top.
    const pid = m.providerId || m.provider || State.provider;
    visibleRows.push({ id: m.id, providerId: pid });
    const cls = ["picker-row"];
    if(m.id === State.model && pid === State.provider) cls.push("picker-row-selected");
    const caps = Object.keys(m.capabilities || {}).filter(k => m.capabilities[k]);
    const capHtml = caps.length
      ? `<span class="picker-caps">${caps.slice(0,3).map(k => `<span class="picker-cap" title="${esc(Config.CAP_META[k] ? Config.CAP_META[k].label : k)}">${Config.CAP_META[k] ? Config.CAP_META[k].icon : "•"}</span>`).join("")}</span>`
      : "";
    const providerBadge = isCrossProvider
      ? `<span class="picker-provider-badge">${esc(m.providerName)}</span>`
      : "";
    html += `<div class="${cls.join(" ")}" data-model="${esc(m.id)}" data-idx="${idx}" data-provider="${esc(pid)}">
      <span class="picker-row-name">${esc(Config.getModelLabel(m))}</span>
      ${capHtml}
      ${providerBadge}
    </div>`;
  });

  if(!modelsToShow.length){
    if(isCrossProvider){
      html = `<div class="picker-empty">No models match '${esc(filterValue)}' across all providers</div>`;
    }else{
      html = State.models.length
        ? `<div class="picker-empty">No results for '${esc(filterValue)}'</div>`
        : `<div class="picker-empty">No models available for this provider. Check Settings.</div>`;
    }
    visibleRows = [];
  }

  $("modelListBody").innerHTML = html;

  highlightedIndex = visibleRows.length ? Math.min(highlightedIndex, visibleRows.length - 1) : -1;
  if(highlightedIndex < 0 && visibleRows.length) highlightedIndex = 0;
  applyHighlight();

  $("modelListBody").querySelectorAll(".picker-row").forEach(row => {
    row.addEventListener("click", async () => {
      const modelId = row.dataset.model;
      const providerId = row.dataset.provider;
      const m = isCrossProvider
        ? (await getAllModels()).find(x => x.id === modelId && x.providerId === providerId)
        : State.models.find(x => x.id === modelId);
      if(m){
        if(providerId !== State.provider){
          await setProvider(providerId);
        }
        setModel(m.id);
      }
      close(true);
    });
  });
}

function renderAll(){
  $("modelPopProviders").innerHTML = providerChipsHtml();
  wireProviderChips();
  buildModelSheet();
}

function position(){
  const pop = $("modelPop"), pill = anchorEl;
  if(!pop || !pill) return;
  const r = pill.getBoundingClientRect();
  const w = pop.offsetWidth || Math.min(360, window.innerWidth - 16);
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  pop.style.left = left + "px";
  pop.style.bottom = (window.innerHeight - r.top + 8) + "px";   // panel above pill
  pop.style.top = "auto";
  pop.style.maxHeight = "min(420px, " + Math.max(120, r.top - 24) + "px)";
  if(r.top - 8 - pop.offsetHeight < 8){                         // not enough room above → below pill
    pop.style.bottom = "auto";
    pop.style.top = (r.bottom + 8) + "px";
    pop.style.maxHeight = "min(420px, " + Math.max(120, window.innerHeight - r.bottom - 24) + "px)";
  }
}

/* ============================================================
   OPEN/CLOSE/TOGGLE/REFRESH
=========================================================== */

function open(anchor){
  if (typeof document === 'undefined') return;
  anchorEl = anchor || $("modelPill");
  filterValue = "";
  highlightedIndex = 0;
  const pop = $("modelPop");
  if(!pop) return;
  pop.hidden = false;
  renderAll();
  position();
  const pill = $("modelPill");
  if(pill){ pill.classList.add("active"); pill.setAttribute("aria-expanded", "true"); }
  isOpen = true;
  const f = $("modelFilter");
  if(f){ f.value = ""; f.focus({ preventScroll:true }); }
}

function close(restoreFocus){
  if (typeof document === 'undefined') return;
  const pop = $("modelPop");
  if(pop) pop.hidden = true;
  const pill = $("modelPill");
  if(pill){ pill.classList.remove("active"); pill.setAttribute("aria-expanded", "false"); }
  if(restoreFocus && pill) pill.focus({ preventScroll:true });
  isOpen = false;
}

function toggle(anchor){
  if(isOpen) close();
  else open(anchor);
}

/* Re-render the open panel after a provider change (setProvider hook). */
function refresh(){
  if (typeof document === 'undefined' || !isOpen) return;
  $("modelListBody").innerHTML = '<div class="picker-empty">Loading models…</div>';
  $("modelPopProviders").innerHTML = providerChipsHtml();
  wireProviderChips();
  Api.fetchModels()
    .then(() => { if(isOpen) renderAll(); })
    .catch(err => {
      if(isOpen) $("modelListBody").innerHTML =
        '<div class="picker-empty">Couldn\'t load models: ' + esc(err && err.message ? err.message : "network error") + '</div>';
    });
}

/* ============================================================
   EVENTS
=========================================================== */

function handleKeydown(e){
  if (typeof document === 'undefined' || !isOpen) return;
  if(e.key === "Escape"){ close(true); return; }
  if(e.key === "Tab"){ trapFocus($("modelPop"))(e); return; }
  if(e.key === "ArrowDown" || e.key === "ArrowUp"){
    e.preventDefault();
    if(!visibleRows.length) return;
    highlightedIndex = e.key === "ArrowDown"
      ? Math.min(highlightedIndex + 1, visibleRows.length - 1)
      : Math.max(highlightedIndex - 1, 0);
    applyHighlight();
  } else if(e.key === "Enter"){
    const row = visibleRows[highlightedIndex];
    if(row){
      e.preventDefault();
      (async () => {
        const providerId = row.providerId || State.provider;
        if(providerId !== State.provider){
          await setProvider(providerId);
        }
        const m = State.models.find(x => x.id === row.id) || (await getAllModels()).find(x => x.id === row.id && x.providerId === providerId);
        if(m) setModel(m.id);
        close(true);
      })();
    }
  }
}

function initEvents(){
  if (typeof document === 'undefined') return;

  const pill = $("modelPill");
  if(pill) pill.addEventListener("click", () => toggle(pill));

  const f = $("modelFilter");
  if(f) f.addEventListener("input", (e) => {
    filterValue = e.target.value;
    highlightedIndex = 0;
    buildModelSheet();
  });

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("mousedown", (e) => {
    if(!isOpen) return;
    const pop = $("modelPop"), p = $("modelPill");
    if(pop && pop.contains(e.target)) return;
    if(p && p.contains(e.target)) return;   // pill click handled by its own listener
    close();
  });
  window.addEventListener("resize", close);
  window.addEventListener("scroll", (e) => {
    if(!isOpen) return;
    const pop = $("modelPop");
    if(pop && pop.contains(e.target)) return;   // scrolling the panel's own list
    close();
  }, true);
}

// Expose globally
window.ModelPicker = {
  open,
  close,
  toggle,
  refresh,
  initEvents
};

})();
