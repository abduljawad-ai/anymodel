/* ============================================================
   STATE — centralized app state and persistence.
   Keys are per-provider; everything stores under anymodel_*.
============================================================ */

/* One-time migration: the app was previously branded "lahooti" and stored
   everything under lahooti_* localStorage keys. Copy any leftover values to
   the new anymodel_* keys (without clobbering newer data), then remove the
   old keys. Runs before State is initialized so the app never reads stale
   keys and existing data (API keys, sessions, models) survives the rename. */
function migrateLegacyKeys(){
  try{
    if(typeof localStorage === 'undefined') return;
    const FIXED = {
      "lahooti_provider_v1":       Config.LS_PROVIDER,
      "lahooti_keys_v1":           Config.LS_KEYS,
      "lahooti_bases_v1":          Config.LS_BASES,
      "lahooti_sysprompt_v1":      Config.LS_SYS,
      "lahooti_messages_v1":       Config.LS_MESSAGES,
      "lahooti_sessions_v1":       Config.LS_SESSIONS,
      "lahooti_active_session_v1": Config.LS_ACTIVE
    };
    for(const [oldKey, newKey] of Object.entries(FIXED)){
      const val = localStorage.getItem(oldKey);
      if(val !== null){
        if(localStorage.getItem(newKey) === null) localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }
    /* Per-provider model selections are stored under a dynamic prefix
       ("lahooti_model_<provider>") — move every one of those too. */
    const OLD_PREFIX = "lahooti_model_";
    const doomed = [];
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf(OLD_PREFIX) === 0) doomed.push(k);
    }
    for(const oldKey of doomed){
      const suffix = oldKey.slice(OLD_PREFIX.length);
      const newKey = Config.LS_MODEL_PREFIX + suffix;
      const val = localStorage.getItem(oldKey);
      if(val !== null){
        if(localStorage.getItem(newKey) === null) localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }
  }catch(e){ /* never block the app on migration */ }
}
migrateLegacyKeys();

function loadJson(key, fallback){
  try{
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}

function saveJson(key, value){
  try{
    if(typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  }catch(e){}
}

const State = {
  provider: (typeof localStorage !== 'undefined' ? localStorage.getItem(Config.LS_PROVIDER) : null) || Config.DEFAULT_PROVIDER,
  apiKeys: loadJson(Config.LS_KEYS, {}),
  customBases: loadJson(Config.LS_BASES, {}),
  apiKey: "",
  model: "",
  systemPrompt: (typeof localStorage !== 'undefined' ? localStorage.getItem(Config.LS_SYS) : null) || "",
  autoTools: true,
  messages: loadJson(Config.LS_MESSAGES, []),
  notice: null,
  pendingImage: null,
  pendingAudio: null,
  sending: false,
  models: [],
  modelsLoaded: false,
  stickToBottom: true,
  sessions: [],
  activeSessionId: ""
};

/* Mirror the active provider's key and saved model. */
State.apiKey = State.apiKeys[State.provider] || "";
State.model = (typeof localStorage !== 'undefined' ? localStorage.getItem(Config.LS_MODEL_PREFIX + State.provider) : null) || "";

/* ============================================================
   SESSIONS — multi-conversation history.
   Each session: { id, title, provider, createdAt, updatedAt, messages }.
   The active session's messages are mirrored in State.messages.
============================================================ */

function genSessionId(){
  return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function freshSession(){
  return {
    id: genSessionId(),
    title: "",
    provider: State.provider,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
}

function activeSession(){
  return State.sessions.find(s => s.id === State.activeSessionId) || null;
}

function maybeAutoTitle(s){
  if(s.title) return;
  const first = (s.messages || []).find(m => m.role === "user" && m.content);
  if(first) s.title = String(first.content).replace(/\s+/g, " ").trim().slice(0, 40);
}

function persistSessions(){
  saveJson(Config.LS_SESSIONS, State.sessions);
}

function migrateLegacyMessages(){
  if(typeof localStorage === 'undefined') return;
  if(localStorage.getItem(Config.LS_SESSIONS)) return;
  const legacy = loadJson(Config.LS_MESSAGES, []);
  if(legacy.length){
    const s = freshSession();
    s.messages = legacy;
    maybeAutoTitle(s);
    State.sessions = [s];
  } else {
    State.sessions = [freshSession()];
  }
  State.activeSessionId = State.sessions[0].id;
  persistSessions();
  localStorage.setItem(Config.LS_ACTIVE, State.activeSessionId);
}

function newSession(){
  if(State.sending) return null;
  const cur = activeSession();
  if(cur){ cur.messages = State.messages; cur.updatedAt = Date.now(); }
  const s = freshSession();
  State.sessions.push(s);
  State.activeSessionId = s.id;
  State.messages = [];
  persistSessions();
  localStorage.setItem(Config.LS_ACTIVE, s.id);
  State.stickToBottom = true;
  if(window.Chat) Chat.render();
  if(window.Composer) Composer.render();
  if(window.Header) Header.render();
  if(window.Sidebar) Sidebar.render();
  return s.id;
}

function switchSession(id){
  if(State.sending || id === State.activeSessionId) return;
  const cur = activeSession();
  if(cur){ cur.messages = State.messages; cur.updatedAt = Date.now(); }
  const next = State.sessions.find(s => s.id === id);
  if(!next) return;
  State.activeSessionId = id;
  State.messages = next.messages || [];
  persistSessions();
  localStorage.setItem(Config.LS_ACTIVE, id);
  State.stickToBottom = true;
  if(window.Chat) Chat.render();
  if(window.Composer) Composer.render();
  if(window.Header) Header.render();
  if(window.Sidebar) Sidebar.render();
}

function renameSession(id, title){
  const s = State.sessions.find(x => x.id === id);
  if(!s) return;
  s.title = String(title || "").trim().slice(0, 80);
  s.updatedAt = Date.now();
  persistSessions();
  if(window.Sidebar) Sidebar.render();
}

function deleteSession(id){
  if(State.sending) return;
  const idx = State.sessions.findIndex(s => s.id === id);
  if(idx < 0) return;
  const wasActive = State.sessions[idx].id === State.activeSessionId;
  State.sessions.splice(idx, 1);
  persistSessions();
  if(wasActive){
    if(!State.sessions.length){
      State.sessions.push(freshSession());
      State.activeSessionId = State.sessions[0].id;
      State.messages = [];
      persistSessions();
      localStorage.setItem(Config.LS_ACTIVE, State.activeSessionId);
      State.stickToBottom = true;
      if(window.Chat) Chat.render();
    } else {
      const sorted = [...State.sessions].sort((a,b) => b.updatedAt - a.updatedAt);
      switchSession(sorted[0].id);
    }
  }
  if(window.Sidebar) Sidebar.render();
}

function clearActiveSession(){
  const s = activeSession();
  if(s){ s.messages = []; s.title = ""; s.updatedAt = Date.now(); persistSessions(); }
  State.messages = [];
}

/* ============================================================
   PROVIDER SWITCHING
============================================================ */

function setProvider(id){
  if(!id || id === State.provider) return;
  State.provider = id;
  State.apiKey = State.apiKeys[id] || "";
  State.model = (typeof localStorage !== 'undefined' ? localStorage.getItem(Config.LS_MODEL_PREFIX + id) : null) || "";
  if(typeof localStorage !== 'undefined') localStorage.setItem(Config.LS_PROVIDER, id);
  State.models = [];
  State.modelsLoaded = false;
  if(window.Api) Api.fetchModels().catch(() => {});
  if(window.Header) Header.render();
  if(window.Composer) Composer.render();
  if(window.ModelPicker && document.getElementById("modelSheet") && document.getElementById("modelSheet").classList.contains("show")) ModelPicker.open();
}

function saveKeyFor(providerId, key){
  if(!key) delete State.apiKeys[providerId];
  else State.apiKeys[providerId] = key;
  saveJson(Config.LS_KEYS, State.apiKeys);
  if(providerId === State.provider) State.apiKey = key || "";
}

function setCustomBase(providerId, url){
  if(!url) delete State.customBases[providerId];
  else State.customBases[providerId] = url;
  saveJson(Config.LS_BASES, State.customBases);
}

/* Effective base URL: saved override > catalog entry > custom provider field. */
function effectiveBase(providerId){
  const id = providerId || State.provider;
  if(State.customBases[id]) return State.customBases[id];
  if(id === "custom") return "";
  const p = window.Catalog ? Catalog.getProvider(id) : null;
  return (p && p.api) || "";
}

/* ============================================================
   MODELS
============================================================ */

function setModel(id){
  State.model = id;
  if(typeof localStorage !== 'undefined') localStorage.setItem(Config.LS_MODEL_PREFIX + State.provider, id);
  const m = State.models.find(model => model.id === id);
  const dropped = [];
  if(m){
    if(!m.capabilities?.vision){ if(State.pendingImage) dropped.push("Image"); State.pendingImage = null; }
    if(!m.capabilities?.audio && !m.capabilities?.audio_transcription){ if(State.pendingAudio) dropped.push("Audio"); State.pendingAudio = null; }
  }
  if(dropped.length) showToast(dropped.join(" and ") + " attachment removed — this model doesn't support it.");
  if(window.Header) Header.render();
  if(window.Composer) Composer.render();
}

function currentModel(){
  if(!State.models.length) return null;
  return State.models.find(m => m.id === State.model) || State.models[0];
}

function currentEndpointType(){
  const m = currentModel();
  return Config.getEndpointType((m && m.capabilities) || {});
}

/* ============================================================
   MESSAGES
============================================================ */

function saveMessages(){
  const s = activeSession();
  if(!s) return;
  s.messages = State.messages;
  s.updatedAt = Date.now();
  maybeAutoTitle(s);
  persistSessions();
}

/* ============================================================
   TOASTS
============================================================ */

let toastTimer = null;
function showToast(msg){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// Expose globally
migrateLegacyMessages();
window.State = State;
window.setModel = setModel;
window.setProvider = setProvider;
window.currentModel = currentModel;
window.currentEndpointType = currentEndpointType;
window.saveKeyFor = saveKeyFor;
window.setCustomBase = setCustomBase;
window.effectiveBase = effectiveBase;
window.saveMessages = saveMessages;
window.showToast = showToast;
window.activeSession = activeSession;
window.newSession = newSession;
window.switchSession = switchSession;
window.renameSession = renameSession;
window.deleteSession = deleteSession;
window.clearActiveSession = clearActiveSession;
