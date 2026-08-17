(function(){

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }

function providerName(){
  const p = window.Catalog ? Catalog.getProvider(State.provider) : null;
  return (p && p.name) || State.provider;
}

let filterValue = "";
let highlightedIndex = -1;
let visibleRows = [];
let allModelsCache = null;
let anchorEl = null;
let isOpen = false;

// Capability → search keywords for type-to-filter (e.g. "tts" finds TTS models).
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

// Token-based match: every whitespace-separated token must hit the model
// id/label/provider or its capability keywords.
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
    const pid = m.providerId || m.provider || State.provider;
    visibleRows.push({ id: m.id, providerId: pid });
    const cls = ["picker-row"];
    if(m.id === State.model && pid === State.provider) cls.push("picker-row-selected");
    const caps = Object.keys(m.capabilities || {}).filter(k => m.capabilities[k]);
    const capHtml = caps.length
      ? `<span class="picker-caps">${caps.slice(0,3).map(k => `<span class="picker-cap" title="${esc(Config.CAP_META[k] ? Config.CAP_META[k].label : k)}">${Config.capIcon(k)}</span>`).join("")}</span>`
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
  // Use visual-viewport coords so the panel never hides behind the
  // on-screen keyboard (iOS pans the visual viewport; Android shrinks it).
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const vTop = vv ? vv.offsetTop : 0;
  const vLeft = vv ? vv.offsetLeft : 0;
  const r = pill.getBoundingClientRect();
  const pTop = r.top - vTop;
  const pBottom = r.bottom - vTop;
  const pLeft = r.left - vLeft;
  const w = pop.offsetWidth || Math.min(360, vw - 16);
  const left = Math.max(8, Math.min(pLeft, vw - w - 8));
  pop.style.left = left + "px";

  const above = pTop - 8;
  const below = vh - pBottom - 8;
  const fitsAbove = above >= 180 && pTop <= vh;
  const fitsBelow = below >= 180 && pBottom >= 0;
  let maxH;
  if(fitsAbove){
    pop.style.top = "auto";
    pop.style.bottom = (window.innerHeight - (pTop - 8 + vTop)) + "px";
    maxH = Math.max(180, Math.min(420, above));
  } else if(fitsBelow){
    pop.style.bottom = "auto";
    pop.style.top = (pBottom + 8 + vTop) + "px";
    maxH = Math.max(180, Math.min(420, below));
  } else {
    pop.style.bottom = "auto";
    pop.style.top = (vTop + 8) + "px";
    maxH = Math.max(120, vh - 16);
  }
  pop.style.maxHeight = maxH + "px";
}

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
  if(f){
    f.value = "";
    // Don't auto-focus on touch devices — it pops the keyboard over the panel.
    const coarse = window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches;
    if(!coarse) f.focus({ preventScroll:true });
  }
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
    if(p && p.contains(e.target)) return;
    close();
  });

  // Reposition on viewport changes instead of closing — the on-screen keyboard
  // resizing the viewport would yank the picker away mid-selection on mobile.
  let viewportTimer = null;
  const repositionSoon = () => {
    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => { if(isOpen) position(); }, 60);
  };
  window.addEventListener("resize", repositionSoon);
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", repositionSoon);
    window.visualViewport.addEventListener("scroll", repositionSoon);
  }
  window.addEventListener("scroll", (e) => {
    if(!isOpen) return;
    const pop = $("modelPop");
    if(pop && e.target instanceof Node && pop.contains(e.target)) return;
    // Keyboard-induced page scroll (iOS visual viewport pan while typing
    // in the filter): keep the panel open and re-anchor it.
    if(window.visualViewport &&
       window.visualViewport.height < window.innerHeight - 40){
      repositionSoon();
      return;
    }
    close();
  }, true);
}

window.ModelPicker = {
  open,
  close,
  toggle,
  refresh,
  initEvents
};

})();
