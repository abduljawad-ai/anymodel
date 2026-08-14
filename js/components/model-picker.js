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
let visibleRows = [];   // flat list of { id } for keyboard navigation
let anchorEl = null;
let isOpen = false;

/* ============================================================
   RENDERING
============================================================ */

function modelMatches(m){
  const q = filterValue.trim().toLowerCase();
  if(!q) return true;
  return (m.id + " " + (Config.getModelLabel(m) || "")).toLowerCase().includes(q);
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

function buildModelSheet(){
  const filtered = State.models.filter(modelMatches);

  let html = "";
  visibleRows = [];
  html += `<div class="picker-group-label">${esc(providerName())}</div>`;
  filtered.forEach(m => {
    const idx = visibleRows.length;
    visibleRows.push({ id: m.id });
    const cls = ["picker-row"];
    if(m.id === State.model) cls.push("picker-row-selected");
    const caps = Object.keys(m.capabilities || {}).filter(k => m.capabilities[k]);
    const capHtml = caps.length
      ? `<span class="picker-caps">${caps.slice(0,3).map(k => `<span class="picker-cap" title="${esc(Config.CAP_META[k] ? Config.CAP_META[k].label : k)}">${Config.CAP_META[k] ? Config.CAP_META[k].icon : "•"}</span>`).join("")}</span>`
      : "";
    html += `<div class="${cls.join(" ")}" data-model="${esc(m.id)}" data-idx="${idx}">
      <span class="picker-row-name">${esc(Config.getModelLabel(m))}</span>
      ${capHtml}
    </div>`;
  });

  if(!filtered.length){
    html = State.models.length
      ? `<div class="picker-empty">No results for '${esc(filterValue)}'</div>`
      : `<div class="picker-empty">No models available for this provider. Check Settings.</div>`;
    visibleRows = [];
  }

  $("modelListBody").innerHTML = html;

  highlightedIndex = visibleRows.length ? Math.min(highlightedIndex, visibleRows.length - 1) : -1;
  if(highlightedIndex < 0 && visibleRows.length) highlightedIndex = 0;
  applyHighlight();

  $("modelListBody").querySelectorAll(".picker-row").forEach(row => {
    row.addEventListener("click", () => {
      const m = State.models.find(x => x.id === row.dataset.model);
      if(m) setModel(m.id);
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
      const m = State.models.find(x => x.id === row.id);
      if(m) setModel(m.id);
      close(true);
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
