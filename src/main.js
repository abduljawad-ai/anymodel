/**
 * main.js — ESM entry point.
 *
 * Wires together the full app: config → utils → services → state → components.
 * Single <script type="module"> in index.html.
 */

// ── Config ─────────────────────────────────────────────────────────────
import {
  LS_PROVIDER, LS_KEYS, LS_BASES, LS_MODEL_PREFIX, LS_SYS,
  LS_MESSAGES, LS_SESSIONS, LS_ACTIVE, LS_TTS_VOICE, LS_THEME,
  DEFAULT_PROVIDER, PROVIDER_COLORS,
} from "./config/constants.js";

import {
  CAP_META, capIcon, getEndpointType
} from "./config/capabilities.js";

import {
  DEMO_TOOLS, runDemoTool, getModelLabel, getModelColor
} from "./config/demo-tools.js";

import { byId } from "./utils/dom.js";
import { escHtml, focusFirst, trapFocus } from "./utils/dom.js";
import { icon } from "./utils/icons.js";
import { showToast } from "./utils/toasts.js";
import { renderMarkdownish, enhanceCodeBlocks, scheduleHighlight } from "./utils/markdown.js";

// ── Services ───────────────────────────────────────────────────────────
import * as catalog from "./services/catalog/registry.js";
import { Keylock } from "./services/storage/keylock.js";
import { Api } from "./services/api/index.js";
import { IntentRouter } from "./services/intent/router.js";

// ── State ──────────────────────────────────────────────────────────────
import { AppState } from "./state/appState.js";

// ── Components ─────────────────────────────────────────────────────────
import { RobotAvatar } from "./components/RobotAvatar.js";
import { VoiceCapsule } from "./components/VoiceCapsule.js";
import { VoiceRecorder } from "./components/VoiceRecorder.js";
import { Header } from "./components/Header.js";
import { Sidebar } from "./components/Sidebar.js";
import { Chat } from "./components/Chat.js";
import { Composer } from "./components/Composer.js";
import { Settings } from "./components/Settings.js";
import { ModelPicker } from "./components/ModelPicker.js";

// ── Theme init (no flash) ──────────────────────────────────────────────
(function initTheme() {
  try {
    const saved = localStorage.getItem(LS_THEME) || localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
  } catch (e) {}
})();

// ── Frame-busting ──────────────────────────────────────────────────────
(function guardFrame() {
  try {
    if (window.self !== window.top && !window.parent.location.hostname.includes(location.hostname)) {
      window.top.location = window.self.location;
    }
  } catch (e) {}
})();

// ── Module-scoped references (no window globals) ─────────────────────
let _robotAvatar = null;

// ── Theme toggle ───────────────────────────────────────────────────────
function updateThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const dark = (document.documentElement.getAttribute("data-theme") || "light") === "dark";
  btn.innerHTML = icon(dark ? "sun_lightmode" : "moon_darkmode");
  btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  btn.setAttribute("aria-label", btn.title);
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem(LS_THEME, next);
  updateThemeToggle();
  // Rebuild robot hero so its SVG colour reads the new CSS var
  const hero = document.getElementById("emptyGlyph");
  if (hero && _robotAvatar) {
    _robotAvatar.buildHero(hero);
  }
}

// ── Assemble shared utilities ──────────────────────────────────────────
const utils = { byId, escHtml, focusFirst, trapFocus, icon, showToast };
const markdown = { renderMarkdownish, enhanceCodeBlocks, scheduleHighlight };

const config = {
  LS_PROVIDER, LS_KEYS, LS_BASES, LS_MODEL_PREFIX, LS_SYS,
  LS_MESSAGES, LS_SESSIONS, LS_ACTIVE, LS_TTS_VOICE, LS_THEME,
  DEFAULT_PROVIDER, PROVIDER_COLORS,
  CAP_META, capIcon, getEndpointType, getModelLabel, getModelColor,
  DEMO_TOOLS, runDemoTool
};

// ── Services ───────────────────────────────────────────────────────────
const keylock = new Keylock({ $: byId });
const state = new AppState({ catalog, keylock, showToast, config });

// Wire up state callbacks
state.onProviderChange = () => {
  api.fetchModels().catch(() => {});
  header.render();
  composer.render();
  sidebar.render();
  modelPicker.clearAllModelsCache();
  modelPicker.refresh();
};
state.onKeyUnlock = () => {
  header.render();
  sidebar.render();
};

// Re-render subscribers on state changes
state.subscribe((changed) => {
  switch (changed) {
    case "model":
      header.render();
      composer.render();
      break;
    case "model:new":
      modelPicker.refresh();
      break;
    case "keys":
      header.render();
      sidebar.render();
      composer.render();
      break;
    case "session:new":
    case "session:switch":
    case "session:delete":
    case "session:clear":
    case "session:newMessage":
      chat.render();
      composer.render();
      sidebar.render();
      header.render();
      break;
    case "customBase":
      break;
  }
});

const api = new Api({ state, catalog, config, markdown, focusFirst });
const intentRouter = new IntentRouter({ $: byId, config });

// ── Components ─────────────────────────────────────────────────────────
// All components share one deps object; circular refs (settings ↔ header ↔
// sidebar ↔ composer ↔ chat) are resolved after construction by mutating it.
// Components read `this.deps` at method-call time, so this is safe.
const deps = { $: byId, escHtml, focusFirst, trapFocus, icon, showToast, config, markdown, state, catalog, api, intentRouter };

const robotAvatar = new RobotAvatar(deps);
const voiceCapsule = new VoiceCapsule(deps);
const voiceRecorder = new VoiceRecorder(deps);
const header = new Header(deps);
const sidebar = new Sidebar(deps);
const chat = new Chat(deps);
const composer = new Composer(deps);
const settings = new Settings(deps);
const modelPicker = new ModelPicker(deps);

// Resolve circular references now that every component exists.
deps.robotAvatar = robotAvatar;
deps.voiceCapsule = voiceCapsule;
deps.voiceRecorder = voiceRecorder;
deps.header = header;
deps.sidebar = sidebar;
deps.chat = chat;
deps.composer = composer;
deps.settings = settings;
deps.modelPicker = modelPicker;

// Module-scoped reference for theme toggle (no window globals — security)
_robotAvatar = robotAvatar;

// ── Basic error tracking ────────────────────────────────────────────
window.addEventListener("error", (e) => {
  console.error("[anymodel] Uncaught error:", e.message, e.filename, e.lineno);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[anymodel] Unhandled promise rejection:", e.reason);
});

// ── Async init ─────────────────────────────────────────────────────────
let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;

  // Wire keylock DOM events (needs real elements, which are ready now)
  keylock.wireEvents?.();

  // Wire component events
  header.initEvents();
  modelPicker.initEvents();
  settings.initEvents();
  composer.initEvents();
  chat.initScrollHandling();
  voiceRecorder.initEvents();
  sidebar.initEvents();
  sidebar.initBrandGlyph();

  // Theme toggle
  updateThemeToggle();
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  // Show loading state
  const loadingState = byId("loadingState");
  if (loadingState) loadingState.style.display = "block";

  try {
    await state.initKeys();
    await catalog.ensureLoaded();
    await api.fetchModels();

    // Fall back to a chat model if saved model is missing
    const m = state.currentModel();
    if (!m) {
      state.setModel(catalog.pickModel(state.provider, "chat") || state.models[0]?.id || "");
    } else {
      state.setModel(m.id);
    }

    header.render();
    composer.render();
    chat.render();
    sidebar.render();
    settings.render();
  } catch (err) {
    console.error("Failed to initialize:", err);
    settings.open();
    settings.showKeyStatus("err", "Failed to load models. Check your provider in Settings.");
  } finally {
    if (loadingState) loadingState.style.display = "none";
  }

  // Init robot hero in empty state
  chat.initHero();

  // Suggestion buttons
  document.querySelectorAll(".suggestion").forEach((el) => {
    el.addEventListener("click", () => {
      const fill = el.dataset.fill;
      const model = state.currentModel();
      if (!model) {
        settings.open();
        settings.showKeyStatus("err", "No models loaded. Check your provider in Settings.");
        return;
      }
      if (fill === "__IMAGE__") {
        if (!model.capabilities?.vision && !model.capabilities?.ocr) {
          const vm = state.models.find((m) => m.capabilities?.vision || m.capabilities?.ocr);
          if (vm) state.setModel(vm.id);
        }
        const imageInput = byId("imageInput");
        if (imageInput) imageInput.click();
      } else if (fill === "__AUDIO__") {
        if (!model.capabilities?.audio && !model.capabilities?.audio_transcription) {
          const am = state.models.find((m) => m.capabilities?.audio || m.capabilities?.audio_transcription);
          if (am) state.setModel(am.id);
        }
        const audioInput = byId("audioInput");
        if (audioInput) audioInput.click();
      } else {
        const promptInput = byId("promptInput");
        if (promptInput) {
          promptInput.value = fill;
          promptInput.focus();
          composer.autoResizeTextarea();
        }
      }
    });
  });

  // Desktop layout toggle
  const desktopMQ = window.matchMedia("(min-width:860px)");
  desktopMQ.addEventListener("change", toggleLayoutChrome);
  toggleLayoutChrome();

  // Start loading the intent classifier (async, doesn't block the app)
  intentRouter.load().then(() => {
    composer.render();
  }).catch(() => {
    // fail silently — intent routing is a graceful enhancement
  });
}

function toggleLayoutChrome() {
  const desktop = window.matchMedia("(min-width:860px)").matches;
  const headerDesktop = document.getElementById("headerDesktop");
  if (headerDesktop) headerDesktop.style.display = desktop ? "flex" : "none";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
