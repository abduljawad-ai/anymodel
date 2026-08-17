/**
 * AppState — reactive application state container.
 *
 * Replaces the original `js/state.js` module-level `State` object with a class
 * that uses dependency injection, pub/sub for re-renders, and the extracted
 * storage/encryption/keylock services.
 *
 * Constructed with:
 *   new AppState({ catalog, keylock, showToast, storage, encryption, constants })
 *
 * Then `state.initKeys()` must be called (returns a promise) to handle
 * encrypted key unlocking before the app becomes usable.
 *
 * External hooks (set after construction):
 *   state.onProviderChange = () => void
 *   state.onKeyUnlock      = () => void
 */

import {
  LS_PROVIDER, LS_KEYS, LS_BASES, LS_MODEL_PREFIX, LS_SYS,
  LS_MESSAGES, LS_SESSIONS, LS_ACTIVE, LS_TTS_VOICE, LS_THEME,
  DEFAULT_PROVIDER
} from "../../config/constants.js";

import {
  loadJson, saveJson, migrateLegacyKeys
} from "./localStorage.js";

import {
  encryptKeysBlob, decryptKeysBlob, keysBlob, keysLocked as isKeysLocked
} from "./encryption.js";

import { getEndpointType } from "../../config/capabilities.js";

export class AppState {
  constructor(deps) {
    this._deps = deps;
    this._subscribers = new Set();

    // External hooks
    this.onProviderChange = null;
    this.onKeyUnlock = null;

    // Run legacy key migration before reading anything from storage
    migrateLegacyKeys({
      LS_PROVIDER, LS_KEYS, LS_BASES, LS_SYS, LS_MESSAGES,
      LS_SESSIONS, LS_ACTIVE, LS_MODEL_PREFIX, LS_TTS_VOICE
    });

    // ── Mutable state (matches original State shape) ───────────────
    this.provider = loadJson(LS_PROVIDER, null) || DEFAULT_PROVIDER;
    this.apiKeys = {};       // populated by initKeys()/unlockKeys()
    this.apiKey = "";        // active provider's key (derived)
    this.customBases = loadJson(LS_BASES, {});
    this.model = loadJson(LS_MODEL_PREFIX + this.provider, null) || "";
    this.systemPrompt = loadJson(LS_SYS, null) || "";
    this.ttsVoice = loadJson(LS_TTS_VOICE, null) || null;
    this.autoTools = true;
    this.thinkingEffort = "instant";
    this.messages = loadJson(LS_MESSAGES, []);
    this.notice = null;
    this.pendingImage = null;
    this.pendingAudio = null;
    this.sending = false;
    this.models = [];
    this.modelsLoaded = false;
    this.stickToBottom = true;
    this.sessions = [];
    this.activeSessionId = "";

    // Internal — session-only passphrase for encryption
    this._keyPassphrase = null;

    // Migrate legacy single-session messages to multi-session format
    this._migrateSessions();
    this._restoreSession();
  }

  // ── Pub/sub ───────────────────────────────────────────────────────
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  _notify(changed) {
    for (const fn of this._subscribers) fn(changed);
  }

  // ── Storage helpers ───────────────────────────────────────────────
  _load(key, fallback) {
    return loadJson(key, fallback);
  }

  _save(key, value) {
    const self = this;
    return saveJson(key, value, (msg) => {
      self.notice = msg;
    });
  }

  // ── Session management ────────────────────────────────────────────
  _migrateSessions() {
    try {
      if (typeof localStorage === "undefined") return;
      if (localStorage.getItem(LS_SESSIONS)) return; // already migrated

      const legacy = loadJson(LS_MESSAGES, []);
      if (legacy.length) {
        const s = this._freshSession();
        s.messages = legacy;
        this._maybeAutoTitle(s);
        this.sessions = [s];
      } else {
        this.sessions = [this._freshSession()];
      }
      this.activeSessionId = this.sessions[0].id;
      this._persistSessions();
      localStorage.setItem(LS_ACTIVE, this.activeSessionId);
    } catch (e) { /* never block */ }
  }

  _restoreSession() {
    try {
      const saved = loadJson(LS_ACTIVE, null);
      if (saved && this.sessions.some(s => s.id === saved)) {
        this.activeSessionId = saved;
        const s = this.sessions.find(s => s.id === saved);
        this.messages = s.messages || [];
      } else if (this.sessions.length) {
        this.activeSessionId = this.sessions[0].id;
        this.messages = this.sessions[0].messages || [];
      }
    } catch (e) { /* keep defaults */ }
  }

  _genSessionId() {
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  _freshSession() {
    return {
      id: this._genSessionId(),
      title: "",
      provider: this.provider,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
  }

  _activeSession() {
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }

  _maybeAutoTitle(s) {
    if (s.title) return;
    const msgs = Array.isArray(s.messages) ? s.messages : [];
    const first = msgs.find(m => m.role === "user");
    if (!first) return;
    let t = String(first.content || "").replace(/\s+/g, " ").trim();
    if (!t && first.imageDataUrl) t = "Image attachment";
    t = t.replace(/[….,:;]+$/g, "").trim();
    if (t.length > 40) t = t.slice(0, 40).replace(/\s+\S*$/, "").trim();
    if (t) s.title = t;
  }

  _persistSessions() {
    this._save(LS_SESSIONS, this.sessions);
  }

  newSession() {
    if (this.sending) return null;
    const cur = this._activeSession();
    if (cur) { cur.messages = this.messages; cur.updatedAt = Date.now(); }
    // Drop empty sessions so they never pile up in storage or sidebar
    this.sessions = this.sessions.filter(s => (s.messages || []).length > 0);
    const s = this._freshSession();
    this.sessions.push(s);
    this.activeSessionId = s.id;
    this.messages = [];
    this._persistSessions();
    localStorage.setItem(LS_ACTIVE, s.id);
    this.stickToBottom = true;
    this._notify("session:new");
    return s.id;
  }

  switchSession(id) {
    if (this.sending || id === this.activeSessionId) return;
    const cur = this._activeSession();
    if (cur) { cur.messages = this.messages; cur.updatedAt = Date.now(); }
    const next = this.sessions.find(s => s.id === id);
    if (!next) return;
    this.activeSessionId = id;
    this.messages = next.messages || [];
    this._persistSessions();
    localStorage.setItem(LS_ACTIVE, id);
    this.stickToBottom = true;
    this._notify("session:switch");
  }

  renameSession(id, title) {
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    s.title = String(title || "").trim().slice(0, 80);
    s.updatedAt = Date.now();
    this._persistSessions();
    this._notify("session:rename");
  }

  deleteSession(id) {
    if (this.sending) return;
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx < 0) return;
    const wasActive = this.sessions[idx].id === this.activeSessionId;
    this.sessions.splice(idx, 1);
    this._persistSessions();
    if (wasActive) {
      if (!this.sessions.length) {
        this.sessions.push(this._freshSession());
        this.activeSessionId = this.sessions[0].id;
        this.messages = [];
        this._persistSessions();
        localStorage.setItem(LS_ACTIVE, this.activeSessionId);
        this.stickToBottom = true;
        this._notify("session:delete");
      } else {
        const sorted = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
        this.switchSession(sorted[0].id);
        this._notify("session:delete");
      }
    } else {
      this._notify("session:delete");
    }
  }

  clearActiveSession() {
    const s = this._activeSession();
    if (s) { s.messages = []; s.title = ""; s.updatedAt = Date.now(); this._persistSessions(); }
    this.messages = [];
    this._notify("session:clear");
  }

  saveMessages() {
    const s = this._activeSession();
    if (!s) return;
    const wasEmpty = !(s.messages && s.messages.length);
    s.messages = this.messages;
    s.updatedAt = Date.now();
    this._maybeAutoTitle(s);
    this._persistSessions();
    if (wasEmpty && s.messages.length) this._notify("session:newMessage");
  }

  // ── Provider & model management ────────────────────────────────────
  setProvider(id) {
    if (!id || id === this.provider) return;
    this.provider = id;
    this.apiKey = this.apiKeys[id] || "";
    this.model = loadJson(LS_MODEL_PREFIX + id, null) || "";
    localStorage.setItem(LS_PROVIDER, id);
    this.models = [];
    this.modelsLoaded = false;
    if (this.onProviderChange) this.onProviderChange();
    this._notify("provider");
  }

  setModel(id) {
    this.model = id;
    localStorage.setItem(LS_MODEL_PREFIX + this.provider, id);
    const m = this.models.find(model => model.id === id);
    const dropped = [];
    if (m) {
      if (!m.capabilities?.vision) { if (this.pendingImage) dropped.push("Image"); this.pendingImage = null; }
      if (!m.capabilities?.audio && !m.capabilities?.audio_transcription) { if (this.pendingAudio) dropped.push("Audio"); this.pendingAudio = null; }
    }
    if (dropped.length) this._deps.showToast(dropped.join(" and ") + " attachment removed — this model doesn't support it.");
    this._notify("model");
  }

  currentModel() {
    if (!this.models.length) return null;
    return this.models.find(m => m.id === this.model) || this.models[0];
  }

  currentEndpointType() {
    const m = this.currentModel();
    return getEndpointType((m && m.capabilities) || {});
  }

  effectiveBase(providerId) {
    const id = providerId || this.provider;
    if (this.customBases[id]) return this.customBases[id];
    if (id === "custom") return "";
    const p = this._deps.catalog ? this._deps.catalog.getProvider(id) : null;
    return (p && p.api) || "";
  }

  // ── Custom base URL ─────────────────────────────────────────────────
  setCustomBase(providerId, url) {
    if (!url) {
      delete this.customBases[providerId];
      this._save(LS_BASES, this.customBases);
      this._notify("customBase");
      return true;
    }
    const clean = String(url).trim().replace(/\/+$/, "");
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?($|\/)/i.test(clean);
    const isHttps = /^https:\/\//i.test(clean);
    if (!isHttps && !isLocal) return false;
    this.customBases[providerId] = clean;
    this._save(LS_BASES, this.customBases);
    this._notify("customBase");
    return true;
  }

  // ── API key management ──────────────────────────────────────────────
  /** Whether the encrypted key store is locked (requires passphrase). */
  keysLocked() {
    const blob = keysBlob(LS_KEYS);
    return isKeysLocked(blob, !!this._keyPassphrase);
  }

  /**
   * Called at app startup. Checks for encrypted keys in localStorage
   * and prompts for passphrase if needed.
   */
  async initKeys() {
    const blob = keysBlob(LS_KEYS);
    if (!blob) { this.apiKeys = {}; return; }

    if (blob.enc) {
      this.apiKeys = {};
      const keylock = this._deps.keylock;
      if (keylock) {
        const pass = await keylock.show("unlock", async (p) => {
          try {
            const keys = await decryptKeysBlob(blob, p);
            if (keys && typeof keys === "object") {
              this.apiKeys = keys;
              this._keyPassphrase = p;
              this._syncApiKey();
              this._notify("keys");
              if (this.onKeyUnlock) this.onKeyUnlock();
              return true;
            }
            return false;
          } catch (e) {
            return false;
          }
        });
        if (pass) {
          // keylock resolved with passphrase on success
        }
      }
    } else {
      // Legacy plaintext keys — will be migrated to encrypted on next save
      this.apiKeys = blob;
      this._syncApiKey();
    }
  }

  /**
   * Try to decrypt the stored key blob with a passphrase.
   * @returns {Promise<boolean>}
   */
  async unlockKeys(pass) {
    const blob = keysBlob(LS_KEYS);
    if (!blob || !blob.enc) return false;
    try {
      const keys = await decryptKeysBlob(blob, pass);
      if (!keys || typeof keys !== "object") return false;
      this.apiKeys = keys;
      this._keyPassphrase = pass;
      this._syncApiKey();
      this._notify("keys");
      if (this.onKeyUnlock) this.onKeyUnlock();
      return true;
    } catch (e) {
      return false;
    }
  }

  _syncApiKey() {
    this.apiKey = this.apiKeys[this.provider] || "";
  }

  /**
   * Save an API key for a provider: applies to memory immediately, then
   * persists as an encrypted blob. Prompts for passphrase if the store
   * is locked or no passphrase has been created yet.
   * Cancel = session-only key.
   */
  async saveKeyFor(providerId, key) {
    const self = this;
    const apply = () => {
      if (!key) delete this.apiKeys[providerId];
      else this.apiKeys[providerId] = key;
      if (providerId === this.provider) self._syncApiKey();
    };
    apply();

    if (!window.crypto || !crypto.subtle) {
      this._deps.showToast("Encryption isn't available in this browser context — key kept for this session only.");
      return;
    }

    if (!this._keyPassphrase) {
      const keylock = this._deps.keylock;
      if (!keylock) {
        this._deps.showToast("Key kept for this session only (no keylock available).");
        return;
      }
      const blob = keysBlob(LS_KEYS);
      if (blob && blob.enc) {
        const pass = await keylock.show("unlock", async (p) => {
          try {
            const keys = await decryptKeysBlob(blob, p);
            if (keys && typeof keys === "object") {
              self.apiKeys = keys;
              self._keyPassphrase = p;
              return true;
            }
            return false;
          } catch (e) {
            return false;
          }
        });
        if (!pass) { self._deps.showToast("Key kept for this session only (not saved)."); return; }
        apply();
      } else {
        const pass = await keylock.show("create");
        if (!pass) { self._deps.showToast("Key kept for this session only (not saved)."); return; }
        this._keyPassphrase = pass;
      }
    }

    const encBlob = await encryptKeysBlob(this.apiKeys, this._keyPassphrase);
    try {
      localStorage.setItem(LS_KEYS, JSON.stringify(encBlob));
    } catch (e) { /* storage full — ignore */ }
  }
}
