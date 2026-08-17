(function(){

let prevFocus = null;

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }

function render(){
  const providerId = State.provider;

  const sel = $("providerSelect");
  const providers = window.Catalog ? Catalog.providerList() : [];
  sel.innerHTML = providers.map(p =>
    `<option value="${esc(p.id)}" ${p.id === providerId ? "selected" : ""}>${esc(p.name)}</option>`
  ).join("");
  sel.value = providerId;

  const pInfo = window.Catalog ? Catalog.getProvider(providerId) : null;
  const needBase = providerId === "custom" || ((!pInfo || !pInfo.api) && !State.customBases[providerId]);
  $("customUrlRow").style.display = needBase ? "block" : "none";
  $("customBaseUrl").value = State.customBases[providerId] || "";

  $("providerNameLabel").innerHTML = icon('lock_security') + " " + (providerId === "custom"
    ? "API key (optional)"
    : "API key for " + esc((pInfo && pInfo.name) || providerId));
  $("apiKeyInput").value = State.apiKeys[providerId] || "";
  $("systemPromptInput").value = State.systemPrompt;
  $("ttsVoiceInput").value = State.ttsVoice || "";
  $("autoToolSwitch").classList.toggle("on", State.autoTools);
  $("keyStatus").style.display = "none";
}

function open(){
  prevFocus = (document.activeElement && document.activeElement !== document.body)
    ? document.activeElement : null;
  render();
  $("settingsScrim").classList.add("show");
  $("settingsSheet").classList.add("show");
  focusFirst($("settingsSheet"));
  if(window.Catalog) Catalog.ensureLoaded().then(() => {
    if($("settingsSheet").classList.contains("show")) render();
  });
}

function close(){
  $("settingsScrim").classList.remove("show");
  $("settingsSheet").classList.remove("show");
  if(prevFocus && prevFocus.focus){ try{ prevFocus.focus({ preventScroll:true }); }catch(e){} }
  prevFocus = null;
}

async function saveKey(){
  const providerId = State.provider;
  const key = $("apiKeyInput").value.trim();
  const base = $("customBaseUrl").value.trim();
  if(base && !setCustomBase(providerId, base)){
    showKeyStatus("err", "Base URL must be https:// (http allowed only for localhost).");
    return;
  }

  if(providerId === "ollama"){
    await saveKeyFor(providerId, key || "ollama");
    Header.render();
    Composer.render();
    Sidebar.render();
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
    await saveKeyFor(providerId, key);
    State.modelsLoaded = false;
    State.models = [];
    try { await Api.fetchModels(); } catch(e) { }
    Header.render();
    Composer.render();
    Sidebar.render();
    showKeyStatus("ok", "Connected — key saved encrypted on this device.");
  } else {
    showKeyStatus("err", "Couldn't verify this connection. Check the key/base URL and try again.");
  }
}

async function clearKey(){
  const providerId = State.provider;
  await saveKeyFor(providerId, "");
  $("apiKeyInput").value = "";
  Header.render();
  Composer.render();
  Sidebar.render();
  showKeyStatus("", "Key removed from this device.");
}

function showKeyStatus(kind, msg){
  $("keyStatus").style.display = "flex";
  $("keyStatus").className = "status-box" + (kind ? " " + kind : "");
  $("keyStatus").textContent = msg;
}

function initEvents(){
  const sheetClose = $("settingsSheetClose");
  if(sheetClose){ const s = sheetClose.querySelector("svg"); if(s) s.outerHTML = icon('close_x'); }
  $("settingsSheetClose").addEventListener("click", close);
  $("settingsScrim").addEventListener("click", close);

  $("providerSelect").addEventListener("change", () => {
    const id = $("providerSelect").value;
    if(!id) return;
    setProvider(id);
    render();
  });

  let baseTimeout;
  $("customBaseUrl").addEventListener("input", () => {
    clearTimeout(baseTimeout);
    baseTimeout = setTimeout(() => {
      const base = $("customBaseUrl").value.trim();
      if(base && !setCustomBase(State.provider, base)){
        showToast("Base URL must be https:// (http allowed only for localhost).");
      }
    }, 400);
  });

  let keyVisible = false;
  $("toggleKeyVisibility").addEventListener("click", () => {
    keyVisible = !keyVisible;
    $("apiKeyInput").type = keyVisible ? "text" : "password";
    $("toggleKeyVisibility").textContent = keyVisible ? "Hide" : "Show";
  });

  $("saveKeyBtn").addEventListener("click", saveKey);

  $("clearKeyBtn").addEventListener("click", clearKey);

  $("autoToolSwitch").addEventListener("click", () => {
    State.autoTools = !State.autoTools;
    $("autoToolSwitch").classList.toggle("on", State.autoTools);
    Header.render();
  });

  let systemPromptTimeout;
  $("systemPromptInput").addEventListener("input", () => {
    clearTimeout(systemPromptTimeout);
    systemPromptTimeout = setTimeout(() => {
      State.systemPrompt = $("systemPromptInput").value;
      localStorage.setItem(Config.LS_SYS, State.systemPrompt);
    }, 300);
  });

  let ttsVoiceTimeout;
  $("ttsVoiceInput").addEventListener("input", () => {
    clearTimeout(ttsVoiceTimeout);
    ttsVoiceTimeout = setTimeout(() => {
      State.ttsVoice = $("ttsVoiceInput").value.trim();
      localStorage.setItem(Config.LS_TTS_VOICE, State.ttsVoice);
    }, 300);
  });

  // Two-step inline confirm for clear chat (no blocking confirm()).
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

  $("settingsSheet").querySelector(".sheet-grip").addEventListener("click", close);
  $("settingsSheet").querySelector(".sheet-head").addEventListener("click", close);

  // WCAG 2.4.3: focus trap while settings sheet is open.
  document.addEventListener("keydown", (e) => {
    if(!$("settingsSheet").classList.contains("show")) return;
    if(e.key === "Escape"){ close(); return; }
    trapFocus($("settingsSheet"))(e);
  });
}

window.Settings = {
  open,
  close,
  initEvents,
  showKeyStatus
};

})();
