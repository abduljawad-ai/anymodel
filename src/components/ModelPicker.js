/**
 * ModelPicker component — the model selection popover with provider
 * chips, capability-aware filtering, keyboard navigation, and
 * visual-viewport-aware positioning.
 */

export class ModelPicker {
  constructor(deps) {
    this.deps = deps;
    this.filterValue = "";
    this.highlightedIndex = -1;
    this.visibleRows = [];
    this.allModelsCache = null;
    this.anchorEl = null;
    this.isOpen = false;
  }

  providerName() {
    const { state, catalog } = this.deps;
    const p = catalog ? catalog.getProvider(state.provider) : null;
    return (p && p.name) || state.provider;
  }

  // Capability → search keywords for type-to-filter
  CAP_KEYWORDS = {
    tts: ["tts", "text-to-speech", "speech", "voice"],
    audio_transcription: ["stt", "transcri", "asr", "speech-to-text", "transcription"],
    vision: ["vision", "image", "photo", "visual"],
    function_calling: ["tool", "tools", "function", "functions", "function calling"],
    reasoning: ["reason", "reasoning"],
    thinking: ["think", "thinking"],
    web_search: ["search", "web search", "web"],
    ocr: ["ocr", "text extraction"],
    embeddings: ["embed", "embedding", "embeddings"],
    audio: ["audio"],
    moderation: ["moderat", "guard"],
    code_interpreter: ["code", "interpreter"],
    image_generation: ["image gen", "image generation"],
    parallel_tool_calling: ["ptc", "parallel tool"]
  };

  modelKeywords(m) {
    const { config } = this.deps;
    const caps = m.capabilities || {};
    const kws = new Set();
    for (const [k, active] of Object.entries(caps)) {
      if (!active) continue;
      (this.CAP_KEYWORDS[k] || []).forEach((w) => kws.add(w));
      const meta = config.CAP_META[k];
      if (meta) {
        kws.add(String(meta.label || "").toLowerCase());
        if (meta.short) kws.add(String(meta.short).toLowerCase());
      }
    }
    return kws;
  }

  modelMatches(m) {
    const q = this.filterValue.trim().toLowerCase();
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    if (!m._searchableText) {
      const id = (m.id || "").toLowerCase();
      const label = (this.deps.config.getModelLabel(m) || "").toLowerCase();
      const desc = (m.description || "").toLowerCase();
      const pName = (m.providerName || "").toLowerCase();
      const pId = (m.providerId || m.provider || "").toLowerCase();
      const kws = [...this.modelKeywords(m)].join(" ");
      m._searchableText = [id, label, desc, pName, pId, kws].join(" ");
    }

    return tokens.every((tok) => m._searchableText.includes(tok));
  }

  async getAllModels() {
    if (this.allModelsCache) return this.allModelsCache;
    const { catalog } = this.deps;
    await catalog.ensureLoaded();
    const providers = catalog.providerList();
    const all = [];
    for (const p of providers) {
      if (p.id === "custom" || p.id === "ollama") continue;
      const models = catalog.listModels(p.id);
      for (const m of models) {
        all.push({ ...m, providerId: p.id, providerName: p.name });
      }
    }
    this.allModelsCache = all;
    return all;
  }

  clearAllModelsCache() {
    this.allModelsCache = null;
  }

  applyHighlight() {
    const { $ } = this.deps;
    const body = $("modelListBody");
    if (!body) return;
    const rows = body.querySelectorAll(".picker-row");
    rows.forEach((row) => row.classList.toggle("picker-row-active", Number(row.dataset.idx) === this.highlightedIndex));
    const active = body.querySelector(".picker-row-active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  providerChipsHtml() {
    const { state, catalog } = this.deps;
    const providers = catalog ? catalog.providerList() : [];
    return providers.map((p) =>
      `<button class="model-provider-chip${p.id === state.provider ? " active" : ""}" data-provider="${this.deps.escHtml(p.id)}">${this.deps.escHtml(p.name)}</button>`
    ).join("");
  }

  wireProviderChips() {
    const { $ } = this.deps;
    const providersEl = $("modelPopProviders");
    if (!providersEl) return;
    providersEl.querySelectorAll(".model-provider-chip").forEach((chip) => {
      chip.addEventListener("click", () => this.deps.state.setProvider(chip.dataset.provider));
    });
  }

  async buildModelSheet() {
    const { $, state, config, icon } = this.deps;
    const q = this.filterValue.trim().toLowerCase();
    let modelsToShow;
    const isCrossProvider = q.length > 0;

    if (isCrossProvider) {
      const all = await this.getAllModels();
      modelsToShow = all.filter((m) => this.modelMatches(m));
    } else {
      modelsToShow = state.models.filter((m) => this.modelMatches(m));
    }

    let html = "";
    this.visibleRows = [];

    if (isCrossProvider) {
      html += `<div class="picker-group-label">All providers (${modelsToShow.length} results)</div>`;
    } else {
      html += `<div class="picker-group-label">${this.deps.escHtml(this.providerName())}</div>`;
    }

    modelsToShow.forEach((m) => {
      const idx = this.visibleRows.length;
      const pid = m.providerId || m.provider || state.provider;
      this.visibleRows.push({ id: m.id, providerId: pid });
      const cls = ["picker-row"];
      if (m.id === state.model && pid === state.provider) cls.push("picker-row-selected");
      const caps = Object.keys(m.capabilities || {}).filter((k) => m.capabilities[k]);
      const capHtml = caps.length
        ? `<span class="picker-caps">${caps.slice(0, 3).map((k) => `<span class="picker-cap" title="${this.deps.escHtml(config.CAP_META[k] ? config.CAP_META[k].label : k)}">${config.capIcon(k, icon)}</span>`).join("")}</span>`
        : "";
      const providerBadge = isCrossProvider
        ? `<span class="picker-provider-badge">${this.deps.escHtml(m.providerName)}</span>`
        : "";
      html += `<div class="${cls.join(" ")}" data-model="${this.deps.escHtml(m.id)}" data-idx="${idx}" data-provider="${this.deps.escHtml(pid)}">
        <span class="picker-row-name">${this.deps.escHtml(config.getModelLabel(m))}</span>
        ${capHtml}
        ${providerBadge}
      </div>`;
    });

    if (!modelsToShow.length) {
      if (isCrossProvider) {
        html = `<div class="picker-empty">No models match '${this.deps.escHtml(this.filterValue)}' across all providers</div>`;
      } else {
        html = state.models.length
          ? `<div class="picker-empty">No results for '${this.deps.escHtml(this.filterValue)}'</div>`
          : `<div class="picker-empty">No models available for this provider. Check Settings.</div>`;
      }
      this.visibleRows = [];
    }

    const listBody = $("modelListBody");
    if (listBody) listBody.innerHTML = html;

    this.highlightedIndex = this.visibleRows.length ? Math.min(this.highlightedIndex, this.visibleRows.length - 1) : -1;
    if (this.highlightedIndex < 0 && this.visibleRows.length) this.highlightedIndex = 0;
    this.applyHighlight();

    const body = $("modelListBody");
    if (body) {
      body.querySelectorAll(".picker-row").forEach((row) => {
        row.addEventListener("click", async () => {
          const modelId = row.dataset.model;
          const providerId = row.dataset.provider;
          let m = isCrossProvider
            ? (await this.getAllModels()).find((x) => x.id === modelId && x.providerId === providerId)
            : state.models.find((x) => x.id === modelId);
          if (m) {
            if (providerId !== state.provider) {
              state.setProvider(providerId);
            }
            state.setModel(m.id);
          }
          this.close(true);
        });
      });
    }
  }

  renderAll() {
    const { $ } = this.deps;
    const providersEl = $("modelPopProviders");
    if (providersEl) providersEl.innerHTML = this.providerChipsHtml();
    this.wireProviderChips();
    this.buildModelSheet();
  }

  position() {
    if (typeof document === "undefined") return;
    const { $ } = this.deps;
    const pop = $("modelPop"), pill = this.anchorEl;
    if (!pop || !pill) return;

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
    if (fitsAbove) {
      pop.style.top = "auto";
      pop.style.bottom = (window.innerHeight - (pTop - 8 + vTop)) + "px";
      maxH = Math.max(180, Math.min(420, above));
    } else if (fitsBelow) {
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

  open(anchor) {
    if (typeof document === "undefined") return;
    const { $ } = this.deps;
    this.anchorEl = anchor || $("modelPill");
    this.filterValue = "";
    this.highlightedIndex = 0;
    const pop = $("modelPop");
    if (!pop) return;
    pop.hidden = false;
    this.renderAll();
    this.position();
    const pill = $("modelPill");
    if (pill) { pill.classList.add("active"); pill.setAttribute("aria-expanded", "true"); }
    this.isOpen = true;
    const f = $("modelFilter");
    if (f) {
      f.value = "";
      // Don't auto-focus on touch devices — it pops the keyboard over the panel.
      const coarse = window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches;
      if (!coarse) f.focus({ preventScroll: true });
    }
  }

  close(restoreFocus) {
    if (typeof document === "undefined") return;
    const { $ } = this.deps;
    const pop = $("modelPop");
    if (pop) pop.hidden = true;
    const pill = $("modelPill");
    if (pill) { pill.classList.remove("active"); pill.setAttribute("aria-expanded", "false"); }
    if (restoreFocus && pill) pill.focus({ preventScroll: true });
    this.isOpen = false;
  }

  toggle(anchor) {
    if (this.isOpen) this.close();
    else this.open(anchor);
  }

  async refresh() {
    if (typeof document === "undefined" || !this.isOpen) return;
    const { $, api } = this.deps;
    const body = $("modelListBody");
    if (body) body.innerHTML = '<div class="picker-empty">Loading models…</div>';
    const providersEl = $("modelPopProviders");
    if (providersEl) {
      providersEl.innerHTML = this.providerChipsHtml();
      this.wireProviderChips();
    }
    try {
      await api.fetchModels();
      if (this.isOpen) this.renderAll();
    } catch (err) {
      if (this.isOpen && body) {
        body.innerHTML =
          '<div class="picker-empty">Couldn\'t load models: ' + this.deps.escHtml(err && err.message ? err.message : "network error") + '</div>';
      }
    }
  }

  handleKeydown(e) {
    if (typeof document === "undefined" || !this.isOpen) return;
    if (e.key === "Escape") { this.close(true); return; }
    if (e.key === "Tab") { this.deps.trapFocus(this.deps.$("modelPop"))(e); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!this.visibleRows.length) return;
      this.highlightedIndex = e.key === "ArrowDown"
        ? Math.min(this.highlightedIndex + 1, this.visibleRows.length - 1)
        : Math.max(this.highlightedIndex - 1, 0);
      this.applyHighlight();
    } else if (e.key === "Enter") {
      const row = this.visibleRows[this.highlightedIndex];
      if (row) {
        e.preventDefault();
        (async () => {
          const { state, catalog } = this.deps;
          const providerId = row.providerId || state.provider;
          if (providerId !== state.provider) {
            state.setProvider(providerId);
          }
          const m = state.models.find((x) => x.id === row.id) || (await this.getAllModels()).find((x) => x.id === row.id && x.providerId === providerId);
          if (m) state.setModel(m.id);
          this.close(true);
        })();
      }
    }
  }

  initEvents() {
    const { $, trapFocus } = this.deps;
    if (typeof document === "undefined") return;

    const pill = $("modelPill");
    if (pill) pill.addEventListener("click", () => this.toggle(pill));

    const f = $("modelFilter");
    if (f) {
      f.addEventListener("input", (e) => {
        this.filterValue = e.target.value;
        this.highlightedIndex = 0;
        this.buildModelSheet();
      });
    }

    document.addEventListener("keydown", (e) => this.handleKeydown(e));
    document.addEventListener("mousedown", (e) => {
      if (!this.isOpen) return;
      const pop = $("modelPop"), p = $("modelPill");
      if (pop && pop.contains(e.target)) return;
      if (p && p.contains(e.target)) return;
      this.close();
    });

    // Reposition on viewport changes instead of closing — the on-screen keyboard
    // resizing the viewport would yank the picker away mid-selection on mobile.
    let viewportTimer = null;
    const repositionSoon = () => {
      clearTimeout(viewportTimer);
      viewportTimer = setTimeout(() => { if (this.isOpen) this.position(); }, 60);
    };
    window.addEventListener("resize", repositionSoon);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", repositionSoon);
      window.visualViewport.addEventListener("scroll", repositionSoon);
    }
    window.addEventListener("scroll", (e) => {
      if (!this.isOpen) return;
      const pop = $("modelPop");
      if (pop && e.target instanceof Node && pop.contains(e.target)) return;
      // Keyboard-induced page scroll (iOS visual viewport pan while typing
      // in the filter): keep the panel open and re-anchor it.
      if (window.visualViewport &&
        window.visualViewport.height < window.innerHeight - 40) {
        repositionSoon();
        return;
      }
      this.close();
    }, true);
  }
}
