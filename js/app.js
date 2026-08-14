/* ============================================================
    APP — main entry point that wires everything together.
============================================================ */

/* ============================================================
    INITIALIZATION
============================================================ */

let initialized = false;

/* Frame-busting (defense in depth — the app holds API keys in memory).
   If we are embedded in a cross-origin iframe, break out. */
(function(){
  try{
    if(window.self !== window.top && !window.parent.location.hostname.includes(location.hostname)){
      window.top.location = window.self.location;
    }
  }catch(e){ /* cross-origin parent: forced redirect is the only option */ }
})();

async function init(){
  if(initialized) return;
  initialized = true;
  // Initialize components
  Header.initEvents();
  ModelPicker.initEvents();
  Settings.initEvents();
  Composer.initEvents();
  Chat.initScrollHandling();
  VoiceRecorder.initEvents();
  Sidebar.initEvents();

  // Hydrate State from localStorage
  State.provider = localStorage.getItem(Config.LS_PROVIDER) || Config.DEFAULT_PROVIDER;
  await initKeys();   // loads encrypted key store (unlock prompt) or migrates legacy plaintext
  try{ State.customBases = JSON.parse(localStorage.getItem(Config.LS_BASES) || "{}"); }
  catch(e){ State.customBases = {}; }   // corrupted storage must never block the app
  State.systemPrompt = localStorage.getItem(Config.LS_SYS) || "";
  try{ State.sessions = JSON.parse(localStorage.getItem(Config.LS_SESSIONS) || "[]"); } catch(e){ State.sessions = []; }
  State.activeSessionId = localStorage.getItem(Config.LS_ACTIVE) || "";
  if(!State.sessions.some(s => s.id === State.activeSessionId)){
    State.activeSessionId = State.sessions[0] ? State.sessions[0].id : "";
  }
  // Clean up empty "New chat" ghosts from before sessions needed a first
  // message. Keep the active one so the current empty chat survives a reload.
  const before = State.sessions.length;
  State.sessions = State.sessions.filter(s => (s.messages || []).length > 0 || s.id === State.activeSessionId);
  if(State.sessions.length !== before) localStorage.setItem(Config.LS_SESSIONS, JSON.stringify(State.sessions));
  State.messages = (State.sessions.find(s => s.id === State.activeSessionId) || {}).messages || [];
  State.model = localStorage.getItem(Config.LS_MODEL_PREFIX + State.provider);

  // Fetch models
  try{
    $("loadingState").style.display = "block";
    if(window.Catalog) await Catalog.ensureLoaded();
    await Api.fetchModels();
    // Models are loaded now — only fall back to a chat pick when the saved
    // model is missing (e.g. provider switch). Checking before fetchModels()
    // would discard TTS/vision/ocr selections on every reload.
    if(!State.model || !State.models.some(m => m.id === State.model)){
      State.model = Catalog.pickModel(State.provider, "chat");
    }
    Header.render();
    Composer.render();
    Chat.render();
  } catch(err){
    console.error("Failed to fetch models:", err);
    Settings.open(); Settings.showKeyStatus("err", "Failed to load models. Check your provider in Settings.");
  } finally {
    $("loadingState").style.display = "none";
  }

  // Handle suggestion clicks
  document.querySelectorAll(".suggestion").forEach(el => {
    el.addEventListener("click", () => {
      const fill = el.dataset.fill;
      if(!currentModel()){
        Settings.open();
        Settings.showKeyStatus("err", "No models loaded. Check your provider in Settings.");
        return;
      }
      if(fill === "__IMAGE__"){
        if(!currentModel().capabilities?.vision && !currentModel().capabilities?.ocr){
          const vm = State.models.find(m => m.capabilities?.vision); if(vm) setModel(vm.id);
        }
        $("imageInput").click();
      } else if(fill === "__AUDIO__"){
        if(!currentModel().capabilities?.audio && !currentModel().capabilities?.audio_transcription){
          const am = State.models.find(m => m.capabilities?.audio || m.capabilities?.audio_transcription); if(am) setModel(am.id);
        }
        $("audioInput").click();
      } else {
        $("promptInput").value = fill;
        $("promptInput").focus();
        Composer.autoResizeTextarea();
      }
    });
  });

  // Handle desktop layout
  const desktopMQ = window.matchMedia("(min-width:860px)");
  desktopMQ.addEventListener("change", toggleLayoutChrome);
  toggleLayoutChrome();

  function toggleLayoutChrome(){
    const desktop = window.matchMedia("(min-width:860px)").matches;
    $("headerDesktop").style.display = desktop ? "flex" : "none";
  }

  // Initialize UI
  Header.render();
  Chat.render();
  Sidebar.render();
}

/* ============================================================
    BOOT
============================================================ */

// Wait for DOM to load
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Convenience
window.$ = (id) => document.getElementById(id);