/* ============================================================
   MODEL PICKER — centered OpenCode-style model selector.
   Lists the selected provider's models; type-to-filter,
   arrow keys + Enter, Escape to close.
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
      close();
    });
  });
}

/* ============================================================
   OPEN/CLOSE
============================================================ */

function open(){
  if (typeof document === 'undefined') return;
  filterValue = "";
  highlightedIndex = 0;
  buildModelSheet();
  $("modelScrim").classList.add("show");
  $("modelSheet").classList.add("show");
  const f = $("modelFilter");
  if(f){ f.value = ""; f.focus({ preventScroll:true }); }
}

function close(){
  if (typeof document === 'undefined') return;
  $("modelScrim").classList.remove("show");
  $("modelSheet").classList.remove("show");
  const t = $("modelTriggerDesktop") && $("modelTriggerDesktop").offsetParent ? $("modelTriggerDesktop") : $("modelTrigger");
  if(t) t.focus({ preventScroll:true });
}

/* ============================================================
   EVENTS
============================================================ */

function handleKeydown(e){
  if (typeof document === 'undefined') return;
  if(!$("modelSheet").classList.contains("show")) return;
  if(e.key === "Escape"){ close(); return; }
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
      close();
    }
  }
}

function initEvents(){
  if (typeof document === 'undefined') return;

  $("modelSheetClose").addEventListener("click", close);
  $("modelScrim").addEventListener("click", close);
  $("modelSheet").querySelector(".sheet-head").addEventListener("click", close);

  const f = $("modelFilter");
  if(f) f.addEventListener("input", (e) => {
    filterValue = e.target.value;
    highlightedIndex = 0;
    buildModelSheet();
  });

  [ "modelTriggerDesktop", "modelTrigger" ].forEach(id => {
    const el = $(id);
    if(!el) return;
    el.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); }
    });
  });

  document.addEventListener("keydown", handleKeydown);
}

// Expose globally
window.ModelPicker = {
  open,
  close,
  initEvents
};

})();