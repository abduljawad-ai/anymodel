/* ============================================================
   SETTINGS — provider, API keys, system prompt, auto-tools.
============================================================ */
(function(){

/* ============================================================
   HELPERS
============================================================ */

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }

/* ============================================================
   RENDERING
============================================================ */

function render(){
  const providerId = State.provider;

  // Provider dropdown
  const sel = $("providerSelect");
  const providers = window.Catalog ? Catalog.providerList() : [];
  sel.innerHTML = providers.map(p =>
    `<option value="${esc(p.id)}" ${p.id === providerId ? "selected" : ""}>${esc(p.name)}</option>`
  ).join("");
  sel.value = providerId;

  // Base URL row: custom provider, or a catalog provider without a base URL
  const pInfo = window.Catalog ? Catalog.getProvider(providerId) : null;
  const needBase = providerId === "custom" || ((!pInfo || !pInfo.api) && !State.customBases[providerId]);
  $("customUrlRow").style.display = needBase ? "block" : "none";
  $("customBaseUrl").value = State.customBases[providerId] || "";

  $("providerNameLabel").textContent = providerId === "custom"
    ? "API key (optional)"
    : "API key for " + ((pInfo && pInfo.name) || providerId);
  $("apiKeyInput").value = State.apiKeys[providerId] || "";
  $("systemPromptInput").value = State.systemPrompt;
  $("autoToolSwitch").classList.toggle("on", State.autoTools);
  $("keyStatus").style.display = "none";
}

/* ============================================================
   OPEN/CLOSE
============================================================ */

function open(){
  render();
  $("settingsScrim").classList.add("show");
  $("settingsSheet").classList.add("show");
  if(window.Catalog) Catalog.ensureLoaded().then(() => {
    if($("settingsSheet").classList.contains("show")) render();
  });
}

function close(){
  $("settingsScrim").classList.remove("show");
  $("settingsSheet").classList.remove("show");
}

/* ============================================================
   API KEY
============================================================ */

async function saveKey(){
  const providerId = State.provider;
  const key = $("apiKeyInput").value.trim();
  const base = $("customBaseUrl").value.trim();
  if(base) setCustomBase(providerId, base);

  if(providerId === "ollama"){
    saveKeyFor(providerId, key || "ollama");
    Header.render();
    Composer.render();
    showKeyStatus("ok", "Ollama needs no key — connected to your local server.");
    return;
  }

  const noKeyAllowed = providerId === "custom";
  if(!key && !noKeyAllowed){ showKeyStatus("err", "Enter a key first."); return; }
  if(!base && !effectiveBase(providerId)){ showKeyStatus("err", "Set a base URL first (this provider isn't in the catalog)."); return; }

  showKeyStatus("", "Checking…");
  $("saveKeyBtn").disabled = true;
  const ok = await Api.testConnection(providerId, key);
  $("saveKeyBtn").disabled = false;
  if(ok){
    saveKeyFor(providerId, key);
    State.modelsLoaded = false;
    State.models = [];
    try { await Api.fetchModels(); } catch(e) { }
    Header.render();
    Composer.render();
    showKeyStatus("ok", "Connected — key saved to this device only.");
  } else {
    showKeyStatus("err", "Couldn't verify this connection. Check the key/base URL and try again.");
  }
}

function clearKey(){
  const providerId = State.provider;
  saveKeyFor(providerId, "");
  $("apiKeyInput").value = "";
  Header.render();
  showKeyStatus("", "Key removed from this device.");
}

function showKeyStatus(kind, msg){
  $("keyStatus").style.display = "flex";
  $("keyStatus").className = "status-box" + (kind ? " " + kind : "");
  $("keyStatus").textContent = msg;
}

/* ============================================================
   EVENTS
============================================================ */

function initEvents(){
  // Sheet controls
  $("settingsSheetClose").addEventListener("click", close);
  $("settingsScrim").addEventListener("click", close);

  // Provider change
  $("providerSelect").addEventListener("change", () => {
    const id = $("providerSelect").value;
    if(!id) return;
    setProvider(id);
    render();
  });

  // Custom base URL (saved as you type)
  let baseTimeout;
  $("customBaseUrl").addEventListener("input", () => {
    clearTimeout(baseTimeout);
    baseTimeout = setTimeout(() => {
      const base = $("customBaseUrl").value.trim();
      if(base) setCustomBase(State.provider, base);
    }, 400);
  });

  // Key visibility toggle
  let keyVisible = false;
  $("toggleKeyVisibility").addEventListener("click", () => {
    keyVisible = !keyVisible;
    $("apiKeyInput").type = keyVisible ? "text" : "password";
    $("toggleKeyVisibility").textContent = keyVisible ? "Hide" : "Show";
  });

  // Save key
  $("saveKeyBtn").addEventListener("click", saveKey);

  // Clear key
  $("clearKeyBtn").addEventListener("click", clearKey);

  // Auto tools toggle
  $("autoToolSwitch").addEventListener("click", () => {
    State.autoTools = !State.autoTools;
    $("autoToolSwitch").classList.toggle("on", State.autoTools);
    Header.render();
  });

  // System prompt
  let systemPromptTimeout;
  $("systemPromptInput").addEventListener("input", () => {
    clearTimeout(systemPromptTimeout);
    systemPromptTimeout = setTimeout(() => {
      State.systemPrompt = $("systemPromptInput").value;
      localStorage.setItem(Config.LS_SYS, State.systemPrompt);
    }, 300);
  });

  // Clear chat — two-step inline confirm (no blocking confirm())
  let clearChatPending = false;
  let clearChatTimeout = null;
  $("clearChatBtn").addEventListener("click", () => {
    if(clearChatPending){
      clearChatPending = false;
      clearTimeout(clearChatTimeout);
      clearActiveSession();
      Chat.render();
      close();
      $("clearChatBtn").textContent = "Clear conversation";
      $("clearChatBtn").classList.remove("confirm");
    } else {
      $("clearChatBtn").textContent = "Confirm clear?";
      $("clearChatBtn").classList.add("confirm");
      clearChatPending = true;
      clearChatTimeout = setTimeout(() => {
        if(clearChatPending){
          clearChatPending = false;
          $("clearChatBtn").textContent = "Clear conversation";
          $("clearChatBtn").classList.remove("confirm");
        }
      }, 3000);
    }
  });

  // Sheet close on grip/head click
  $("settingsSheet").querySelector(".sheet-grip").addEventListener("click", close);
  $("settingsSheet").querySelector(".sheet-head").addEventListener("click", close);

  // Sheet close on Escape
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && $("settingsSheet").classList.contains("show")){
      close();
    }
  });
}

// Expose globally
window.Settings = {
  open,
  close,
  initEvents,
  showKeyStatus
};

})();