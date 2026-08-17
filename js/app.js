(function initTheme(){
  const html = document.documentElement;
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  html.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
  updateThemeToggle();
})();

function updateThemeToggle(){
  const btn = document.getElementById('themeToggle');
  if(!btn) return;
  const dark = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark';
  btn.innerHTML = icon(dark ? 'sun_lightmode' : 'moon_darkmode');
  btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.setAttribute('aria-label', btn.title);
}

function themeToggle(){
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeToggle();
  // Rebuild robot hero so its SVG colour reads the new CSS var
  if(window.RobotAvatar){
    const g = $("emptyGlyph");
    if(g) RobotAvatar.buildHero(g);
  }
}

let initialized = false;

// Frame-busting: defense in depth — the app holds API keys in memory.
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
  Header.initEvents();
  ModelPicker.initEvents();
  Settings.initEvents();
  Composer.initEvents();
  Chat.initScrollHandling();
  VoiceRecorder.initEvents();
  Sidebar.initEvents();

  const themeBtn = document.getElementById("themeToggle");
  if(themeBtn) themeBtn.addEventListener("click", themeToggle);
  updateThemeToggle();

  State.provider = localStorage.getItem(Config.LS_PROVIDER) || Config.DEFAULT_PROVIDER;
  await initKeys();
  try{ State.customBases = JSON.parse(localStorage.getItem(Config.LS_BASES) || "{}"); }
  catch(e){ State.customBases = {}; }
  State.systemPrompt = localStorage.getItem(Config.LS_SYS) || "";
  try{ State.sessions = JSON.parse(localStorage.getItem(Config.LS_SESSIONS) || "[]"); } catch(e){ State.sessions = []; }
  State.activeSessionId = localStorage.getItem(Config.LS_ACTIVE) || "";
  if(!State.sessions.some(s => s.id === State.activeSessionId)){
    State.activeSessionId = State.sessions[0] ? State.sessions[0].id : "";
  }
  // Purge empty "New chat" ghosts but keep the active one so a current empty chat survives reload.
  const before = State.sessions.length;
  State.sessions = State.sessions.filter(s => (s.messages || []).length > 0 || s.id === State.activeSessionId);
  if(State.sessions.length !== before) localStorage.setItem(Config.LS_SESSIONS, JSON.stringify(State.sessions));
  State.messages = (State.sessions.find(s => s.id === State.activeSessionId) || {}).messages || [];
  State.model = localStorage.getItem(Config.LS_MODEL_PREFIX + State.provider);

  try{
    $("loadingState").style.display = "block";
    if(window.Catalog) await Catalog.ensureLoaded();
    await Api.fetchModels();
    // Only fall back to a chat pick when saved model is missing (e.g. provider switch).
    // Checking before fetchModels() would discard TTS/vision/ocr selections on every reload.
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

  // Init animated robot hero in the empty state
  const emptyGlyph = $("emptyGlyph");
  if(emptyGlyph && window.RobotAvatar){
    if(!emptyGlyph.querySelector('.robot-svg')){
      RobotAvatar.buildHero(emptyGlyph);
    }
  }
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

  const desktopMQ = window.matchMedia("(min-width:860px)");
  desktopMQ.addEventListener("change", toggleLayoutChrome);
  toggleLayoutChrome();

  function toggleLayoutChrome(){
    const desktop = window.matchMedia("(min-width:860px)").matches;
    $("headerDesktop").style.display = desktop ? "flex" : "none";
  }

  Header.render();
  Chat.render();
  Sidebar.render();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.$ = (id) => document.getElementById(id);
