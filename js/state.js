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
  }catch(e){
    // Storage full or blocked: surface it once instead of silently
    // swallowing the failure. Values stay in memory for this session.
    try{ State.notice = "⚠️ Storage is full — recent changes may not be saved."; }catch(e2){}
  }
}

/* ============================================================
   API-KEY ENCRYPTION
   Keys are encrypted at rest with AES-GCM (PBKDF2-derived key
   from a user passphrase). The passphrase lives only in memory
   for the session — never persisted. LS_KEYS stores:
     { enc:1, iter, salt, iv, data }   (base64 fields)
   Legacy plaintext {provider: key} objects are kept in memory
   and migrated to an encrypted blob on the next key save.
============================================================ */

let keyPassphrase = null;   // session-only, never written to storage

function b64FromBytes(bytes){
  let bin = "";
  const chunk = 0x8000;
  for(let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function bytesFromB64(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(pass, salt){
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptKeysBlob(keysObj, pass){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(keysObj)));
  return { enc: 1, iter: 150000, salt: b64FromBytes(salt), iv: b64FromBytes(iv), data: b64FromBytes(new Uint8Array(ct)) };
}

async function decryptKeysBlob(blob, pass){
  const key = await deriveKey(pass, bytesFromB64(blob.salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromB64(blob.iv) },
    key,
    bytesFromB64(blob.data)
  );
  return JSON.parse(new TextDecoder().decode(pt));
}

/* Raw stored value for LS_KEYS: encrypted blob | legacy object | null. */
function keysBlob(){
  try{
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(Config.LS_KEYS) : null;
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  }catch(e){ return null; }
}

function keysLocked(){
  const blob = keysBlob();
  return !!(blob && blob.enc) && !keyPassphrase;
}

async function unlockKeys(pass){
  const blob = keysBlob();
  if(!blob || !blob.enc) return false;
  try{
    const keys = await decryptKeysBlob(blob, pass);
    if(!keys || typeof keys !== "object") return false;
    State.apiKeys = keys;
    keyPassphrase = pass;
    State.apiKey = State.apiKeys[State.provider] || "";
    if(window.Header) Header.render();
    if(window.Sidebar) Sidebar.render();
    return true;
  }catch(e){ return false; }
}

/* Load keys at boot: unlock the encrypted store if one exists, else
   keep any legacy plaintext keys in memory for this session. Never
   blocks app startup — resolves immediately if there's nothing to do. */
async function initKeys(){
  const blob = keysBlob();
  if(!blob){ State.apiKeys = {}; return; }
  if(blob.enc){
    State.apiKeys = {};
    wireKeylockEvents();
    const pass = await showKeylock("unlock");
    if(pass) unlockKeys(pass);
  } else {
    State.apiKeys = blob;   // legacy plaintext — migrated on next save
    State.apiKey = State.apiKeys[State.provider] || "";
  }
}

/* ============================================================
   KEY-LOCK MODAL (passphrase prompt)
============================================================ */

let keylockMode = "unlock";    // "unlock" | "create"
let keylockResolver = null;
let keylockWired = false;

function wireKeylockEvents(){
  if(keylockWired) return;
  keylockWired = true;
  document.getElementById("keylockOk").addEventListener("click", submitKeylock);
  document.getElementById("keylockCancel").addEventListener("click", () => resolveKeylock(null));
  document.getElementById("keylockOverlay").addEventListener("click", (e) => {
    if(e.target === e.currentTarget) resolveKeylock(null);
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && !document.getElementById("keylockOverlay").hidden) resolveKeylock(null);
  });
  ["keylockPass", "keylockConfirm"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ e.preventDefault(); submitKeylock(); }
    });
  });
}

function showKeylock(mode){
  keylockMode = mode;
  const ov = document.getElementById("keylockOverlay");
  const pass = document.getElementById("keylockPass");
  const confirm = document.getElementById("keylockConfirm");
  const err = document.getElementById("keylockError");
  const ok = document.getElementById("keylockOk");
  ov.hidden = false;
  err.hidden = true;
  pass.value = "";
  confirm.value = "";
  confirm.hidden = mode !== "create";
  ok.textContent = mode === "create" ? "Save" : "Unlock";
  document.getElementById("keylockTitle").textContent =
    mode === "create" ? "Protect your API keys" : "Unlock your API keys";
  document.getElementById("keylockHint").textContent =
    mode === "create"
      ? "Create a passphrase to encrypt your keys on this device. You'll need it every session — there is no recovery if you forget it."
      : "Enter your passphrase to decrypt the API keys saved on this device.";
  pass.focus();
  return new Promise(resolve => { keylockResolver = resolve; });
}

function resolveKeylock(value){
  const ov = document.getElementById("keylockOverlay");
  if(ov) ov.hidden = true;
  if(keylockResolver){ const r = keylockResolver; keylockResolver = null; r(value); }
}

async function submitKeylock(){
  const pass = document.getElementById("keylockPass").value;
  const err = document.getElementById("keylockError");
  if(keylockMode === "create"){
    const confirm = document.getElementById("keylockConfirm").value;
    if(pass.length < 8){ err.textContent = "Use at least 8 characters."; err.hidden = false; return; }
    if(pass !== confirm){ err.textContent = "Passphrases don't match."; err.hidden = false; return; }
    keyPassphrase = pass;
    resolveKeylock(pass);
    return;
  }
  const ok = await unlockKeys(pass);
  if(ok){
    resolveKeylock(pass);
  } else {
    err.textContent = "Wrong passphrase. Try again.";
    err.hidden = false;
    document.getElementById("keylockPass").value = "";
    document.getElementById("keylockPass").focus();
  }
}

const State = {
  provider: (typeof localStorage !== 'undefined' ? localStorage.getItem(Config.LS_PROVIDER) : null) || Config.DEFAULT_PROVIDER,
  apiKeys: {},   // populated by initKeys()/unlockKeys() — never read from storage directly
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
  const msgs = Array.isArray(s.messages) ? s.messages : [];
  const first = msgs.find(m => m.role === "user");
  if(!first) return;
  let t = String(first.content || "").replace(/\s+/g, " ").trim();
  if(!t && first.imageDataUrl) t = "📷 Image";
  t = t.replace(/[….,:;]+$/g, "").trim();
  if(t.length > 40) t = t.slice(0, 40).replace(/\s+\S*$/, "").trim();
  if(t) s.title = t;
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
  // A chat with no messages isn't a session yet — drop abandoned empty ones
  // so they never pile up in storage or show up in the sidebar.
  State.sessions = State.sessions.filter(s => (s.messages || []).length > 0);
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
  if(window.Sidebar) Sidebar.render();
  if(window.ModelPicker && document.getElementById("modelSheet") && document.getElementById("modelSheet").classList.contains("show")) ModelPicker.open();
}

/* Save a key for a provider. The change is applied to memory immediately
   (so this session can use it), then persisted as an encrypted blob.
   - If an encrypted store exists but isn't unlocked, prompts for the passphrase
     first so the existing blob is never silently clobbered.
   - If no passphrase exists yet, prompts to create one.
   - If the user cancels, the key stays in memory for this session only. */
async function saveKeyFor(providerId, key){
  const apply = () => {
    if(!key) delete State.apiKeys[providerId];
    else State.apiKeys[providerId] = key;
    if(providerId === State.provider) State.apiKey = key || "";
  };
  apply();

  if(!window.crypto || !crypto.subtle){
    showToast("Encryption isn't available in this browser context — key kept for this session only.");
    return;
  }

  if(!keyPassphrase){
    wireKeylockEvents();
    const blob = keysBlob();
    if(blob && blob.enc){
      const pass = await showKeylock("unlock");
      if(!pass){ showToast("Key kept for this session only (not saved)."); return; }
      const ok = await unlockKeys(pass);
      if(!ok){ showToast("Couldn't unlock saved keys — change not saved."); return; }
      apply();   // re-apply the change on top of the decrypted store
    } else {
      const pass = await showKeylock("create");
      if(!pass){ showToast("Key kept for this session only (not saved)."); return; }
      keyPassphrase = pass;
    }
  }

  const encBlob = await encryptKeysBlob(State.apiKeys, keyPassphrase);
  try{
    if(typeof localStorage !== 'undefined') localStorage.setItem(Config.LS_KEYS, JSON.stringify(encBlob));
  }catch(e){}
}

/* Custom base URL override. HTTPS is required; http:// is allowed only for
   local endpoints (localhost / 127.0.0.1) so self-hosted Ollama still works.
   Returns true if the value was accepted, false otherwise. */
function setCustomBase(providerId, url){
  if(!url){
    delete State.customBases[providerId];
    saveJson(Config.LS_BASES, State.customBases);
    return true;
  }
  const clean = String(url).trim().replace(/\/+$/, "");
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?($|\/)/i.test(clean);
  const isHttps = /^https:\/\//i.test(clean);
  if(!isHttps && !isLocal) return false;
  State.customBases[providerId] = clean;
  saveJson(Config.LS_BASES, State.customBases);
  return true;
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
  const wasEmpty = !(s.messages && s.messages.length);
  s.messages = State.messages;
  s.updatedAt = Date.now();
  maybeAutoTitle(s);
  persistSessions();
  // First message makes this a real session — pop it into the sidebar right
  // away (with its auto title) even if the panel is already open.
  if(wasEmpty && s.messages.length && window.Sidebar) Sidebar.render();
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
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 5000);
  t.onclick = () => t.classList.remove("show");   // manual dismiss
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
window.initKeys = initKeys;
window.unlockKeys = unlockKeys;
window.keysLocked = keysLocked;
