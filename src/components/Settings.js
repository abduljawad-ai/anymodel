/**
 * Settings component — provider selection, API key management,
 * custom base URLs, system prompt, TTS voice, auto-tools toggle,
 * and clear-conversation control.
 */

export class Settings {
  constructor(deps) {
    this.deps = deps;
    this.prevFocus = null;
  }

  esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  render() {
    const { $, state, catalog, config, icon } = this.deps;
    const providerId = state.provider;

    const sel = $("providerSelect");
    const providers = catalog ? catalog.providerList() : [];
    sel.innerHTML = providers.map((p) =>
      `<option value="${this.esc(p.id)}" ${p.id === providerId ? "selected" : ""}>${this.esc(p.name)}</option>`
    ).join("");
    sel.value = providerId;

    const pInfo = catalog ? catalog.getProvider(providerId) : null;
    const needBase = providerId === "custom" || ((!pInfo || !pInfo.api) && !state.customBases[providerId]);
    const customUrlRow = $("customUrlRow");
    if (customUrlRow) customUrlRow.style.display = needBase ? "block" : "none";
    const baseUrlInput = $("customBaseUrl");
    if (baseUrlInput) baseUrlInput.value = state.customBases[providerId] || "";

    const nameLabel = $("providerNameLabel");
    if (nameLabel) {
      nameLabel.innerHTML = icon("lock_security") + " " + (providerId === "custom"
        ? "API key (optional)"
        : "API key for " + this.esc((pInfo && pInfo.name) || providerId));
    }
    const keyInput = $("apiKeyInput");
    if (keyInput) keyInput.value = state.apiKeys[providerId] || "";
    const sysPromptInput = $("systemPromptInput");
    if (sysPromptInput) sysPromptInput.value = state.systemPrompt;
    const ttsVoiceInput = $("ttsVoiceInput");
    if (ttsVoiceInput) ttsVoiceInput.value = state.ttsVoice || "";

    const autoToolSwitch = $("autoToolSwitch");
    if (autoToolSwitch) autoToolSwitch.classList.toggle("on", state.autoTools);

    const keyStatus = $("keyStatus");
    if (keyStatus) keyStatus.style.display = "none";
  }

  open() {
    const { $, catalog, focusFirst } = this.deps;
    this.prevFocus = (document.activeElement && document.activeElement !== document.body)
      ? document.activeElement : null;
    this.render();
    const scrim = $("settingsScrim");
    const sheet = $("settingsSheet");
    if (scrim) scrim.classList.add("show");
    if (sheet) sheet.classList.add("show");
    if (sheet && focusFirst) focusFirst(sheet);

    if (catalog && catalog.ensureLoaded) {
      catalog.ensureLoaded().then(() => {
        if ($("settingsSheet").classList.contains("show")) this.render();
      });
    }
  }

  close() {
    const { $ } = this.deps;
    const scrim = $("settingsScrim");
    const sheet = $("settingsSheet");
    if (scrim) scrim.classList.remove("show");
    if (sheet) sheet.classList.remove("show");
    if (this.prevFocus && this.prevFocus.focus) {
      try { this.prevFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    this.prevFocus = null;
  }

  async saveKey() {
    const { $, state, catalog, api, showToast, header, composer, sidebar } = this.deps;
    const providerId = state.provider;
    const key = $("apiKeyInput").value.trim();
    const base = $("customBaseUrl").value.trim();

    if (base && !state.setCustomBase(providerId, base)) {
      this.showKeyStatus("err", "Base URL must be https:// (http allowed only for localhost).");
      return;
    }

    if (providerId === "ollama") {
      await state.saveKeyFor(providerId, key || "ollama");
      if (header) header.render();
      if (composer) composer.render();
      if (sidebar) sidebar.render();
      this.showKeyStatus("ok", "Ollama needs no key — connected to your local server.");
      return;
    }

    const noKeyAllowed = providerId === "custom";
    if (!key && !noKeyAllowed) { this.showKeyStatus("err", "Enter a key first."); return; }
    if (!base && !state.effectiveBase(providerId)) {
      this.showKeyStatus("err", "Set a base URL first (this provider isn't in the catalog).");
      return;
    }

    this.showKeyStatus("", "Checking…");
    const saveKeyBtn = $("saveKeyBtn");
    if (saveKeyBtn) saveKeyBtn.disabled = true;
    const ok = await api.testConnection(providerId, key);
    if (saveKeyBtn) saveKeyBtn.disabled = false;

    if (ok) {
      await state.saveKeyFor(providerId, key);
      state.modelsLoaded = false;
      state.models = [];
      try { await api.fetchModels(); } catch (e) {}
      if (header) header.render();
      if (composer) composer.render();
      if (sidebar) sidebar.render();
      this.showKeyStatus("ok", "Connected — key saved encrypted on this device.");
    } else {
      this.showKeyStatus("err", "Couldn't verify this connection. Check the key/base URL and try again.");
    }
  }

  async clearKey() {
    const { $, state, header, composer, sidebar } = this.deps;
    const providerId = state.provider;
    await state.saveKeyFor(providerId, "");
    $("apiKeyInput").value = "";
    if (header) header.render();
    if (composer) composer.render();
    if (sidebar) sidebar.render();
    this.showKeyStatus("", "Key removed from this device.");
  }

  showKeyStatus(kind, msg) {
    const { $ } = this.deps;
    const el = $("keyStatus");
    if (!el) return;
    el.style.display = "flex";
    el.className = "status-box" + (kind ? " " + kind : "");
    el.textContent = msg;
  }

  initEvents() {
    const { $, state, icon, trapFocus, showToast, settings } = this.deps;

    const sheetClose = $("settingsSheetClose");
    if (sheetClose) {
      const s = sheetClose.querySelector("svg");
      if (s) s.outerHTML = icon("close_x");
    }
    const closeEl = $("settingsSheetClose");
    if (closeEl) closeEl.addEventListener("click", () => settings.close());
    const scrim = $("settingsScrim");
    if (scrim) scrim.addEventListener("click", () => settings.close());

    const providerSelect = $("providerSelect");
    if (providerSelect) {
      providerSelect.addEventListener("change", () => {
        const id = providerSelect.value;
        if (!id) return;
        state.setProvider(id);
        this.render();
      });
    }

    let baseTimeout;
    const customBaseUrl = $("customBaseUrl");
    if (customBaseUrl) {
      customBaseUrl.addEventListener("input", () => {
        clearTimeout(baseTimeout);
        baseTimeout = setTimeout(() => {
          const base = customBaseUrl.value.trim();
          if (base && !state.setCustomBase(state.provider, base)) {
            showToast("Base URL must be https:// (http allowed only for localhost).");
          }
        }, 400);
      });
    }

    let keyVisible = false;
    const toggleKey = $("toggleKeyVisibility");
    const apiKeyInput = $("apiKeyInput");
    if (toggleKey && apiKeyInput) {
      toggleKey.addEventListener("click", () => {
        keyVisible = !keyVisible;
        apiKeyInput.type = keyVisible ? "text" : "password";
        toggleKey.textContent = keyVisible ? "Hide" : "Show";
      });
    }

    const saveKeyBtn = $("saveKeyBtn");
    if (saveKeyBtn) saveKeyBtn.addEventListener("click", () => settings.saveKey());

    const clearKeyBtn = $("clearKeyBtn");
    if (clearKeyBtn) clearKeyBtn.addEventListener("click", () => settings.clearKey());

    const autoToolSwitch = $("autoToolSwitch");
    if (autoToolSwitch) {
      autoToolSwitch.addEventListener("click", () => {
        state.autoTools = !state.autoTools;
        autoToolSwitch.classList.toggle("on", state.autoTools);
        if (this.deps.header) this.deps.header.render();
      });
    }

    let systemPromptTimeout;
    const systemPromptInput = $("systemPromptInput");
    if (systemPromptInput) {
      systemPromptInput.addEventListener("input", () => {
        clearTimeout(systemPromptTimeout);
        systemPromptTimeout = setTimeout(() => {
          state.systemPrompt = systemPromptInput.value;
          localStorage.setItem(this.deps.config.LS_SYS, state.systemPrompt);
        }, 300);
      });
    }

    let ttsVoiceTimeout;
    const ttsVoiceInput = $("ttsVoiceInput");
    if (ttsVoiceInput) {
      ttsVoiceInput.addEventListener("input", () => {
        clearTimeout(ttsVoiceTimeout);
        ttsVoiceTimeout = setTimeout(() => {
          state.ttsVoice = ttsVoiceInput.value.trim();
          localStorage.setItem(this.deps.config.LS_TTS_VOICE, state.ttsVoice);
        }, 300);
      });
    }

    // Two-step inline confirm for clear chat (no blocking confirm()).
    let clearChatPending = false;
    let clearChatTimeout = null;
    const clearChatBtn = $("clearChatBtn");
    if (clearChatBtn) {
      clearChatBtn.addEventListener("click", () => {
        if (clearChatPending) {
          clearChatPending = false;
          clearTimeout(clearChatTimeout);
          state.clearActiveSession();
          if (this.deps.chat) this.deps.chat.render();
          if (this.deps.composer) this.deps.composer.render();
          settings.close();
          clearChatBtn.textContent = "Clear conversation";
          clearChatBtn.classList.remove("confirm");
        } else {
          clearChatBtn.textContent = "Confirm clear?";
          clearChatBtn.classList.add("confirm");
          clearChatPending = true;
          clearChatTimeout = setTimeout(() => {
            if (clearChatPending) {
              clearChatPending = false;
              clearChatBtn.textContent = "Clear conversation";
              clearChatBtn.classList.remove("confirm");
            }
          }, 3000);
        }
      });
    }

    const sheet = $("settingsSheet");
    if (sheet) {
      const grip = sheet.querySelector(".sheet-grip");
      if (grip) grip.addEventListener("click", () => settings.close());
      const head = sheet.querySelector(".sheet-head");
      if (head) head.addEventListener("click", () => settings.close());
    }

    // WCAG 2.4.3: focus trap while settings sheet is open.
    document.addEventListener("keydown", (e) => {
      if (!$("settingsSheet").classList.contains("show")) return;
      if (e.key === "Escape") { settings.close(); return; }
      if (trapFocus) trapFocus($("settingsSheet"))(e);
    });
  }
}
