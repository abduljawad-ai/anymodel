# anymodel - Complete Project Source

## Overview
**anymodel** is a client-side AI chat UI that connects to 180+ providers using user-supplied API keys (bring-your-own-key). Pure static site (HTML + vanilla JS, no build tools, no framework). Deployed to GitHub Pages.

### Key Features
- Multi-provider chat (OpenAI, Anthropic, Google, Ollama, custom)
- Streaming responses with SSE
- Voice recording and text-to-speech
- Image attachments with vision/OCR support
- Intent-based auto-routing (fastText WASM classifier)
- Markdown rendering with code highlighting
- Session management with persistent history
- Dark/light themes
- AES-GCM encrypted API key storage

## File Structure
```
anymodel/
├── index.html              # Main HTML entry point — loads src/main.js as ES module
├── AGENT.md                # Agent instructions (80 lines)
├── README.md               # Project readme
├── PROJECT_SOURCE.md       # This file
├── .gitignore              # Ignores node_modules, .playwright-mcp/, etc.
│
├── src/
│   ├── main.js             # ES module entry point — wires config→utils→services→state→components
│   ├── config/
│   │   ├── constants.js    # localStorage keys, timeouts, provider colors
│   │   ├── capabilities.js # CAP_META (40+ caps), capIcon(), getEndpointType()
│   │   └── demo-tools.js   # DEMO_TOOLS, safeEvaluate(), runDemoTool(), model labels/colors
│   ├── utils/
│   │   ├── dom.js          # byId(), escHtml(), FOCUSABLE, focusFirst(), trapFocus()
│   │   ├── icons.js        # Auto-generated SVG icon map - DO NOT EDIT
│   │   ├── markdown.js     # Markdown rendering + code highlighting
│   │   └── toasts.js       # showToast() transient notifications
│   ├── services/
│   │   ├── catalog/        # Model catalog loader + cache (24h TTL), normalization, picking
│   │   │   ├── registry.js # provider/model enumeration facade
│   │   │   ├── loader.js   # ensureCatalogLoaded(), invalidateCatalogCache()
│   │   │   ├── normalizer.js # normalizeModel(), listModels()
│   │   │   └── picker.js   # pickModelFor()
│   │   ├── api/            # Provider API layer
│   │   │   ├── index.js    # Api class — orchestrates client + endpoints
│   │   │   ├── client.js   # fetch helpers, SSE streaming, timeouts, error messages
│   │   │   ├── endpoints.js# fetchModels, testConnection, callTranscription/Ocr/Tts/Embeddings/Moderation
│   │   │   └── context.js  # token estimation, context windowing
│   │   ├── intent/
│   │   │   ├── router.js   # IntentRouter class (fastText WASM classifier)
│   │   │   └── fastText.js # re-exports root vendor fasttext.js (ESM wrapper)
│   │   ├── providers/
│   │   │   ├── Adapter.js              # ProviderAdapter base class
│   │   │   ├── OpenAIAdapter.js        # OpenAI SSE format
│   │   │   ├── AnthropicAdapter.js     # Anthropic SSE format
│   │   │   ├── GoogleAdapter.js        # Google SSE format
│   │   │   └── factory.js              # createAdapter()
│   │   └── storage/
│   │       ├── keylock.js  # Keylock class — passphrase gate for encrypted keys
│   │       ├── localStorage.js # loadJson/saveJson, migrateLegacyKeys
│   │       └── encryption.js # AES-GCM encrypt/decrypt (PBKDF2)
│   ├── state/
│   │   └── appState.js     # AppState class — centralized state + persistence + pub/sub
│   └── components/
│       ├── Chat.js         # Message rendering, streaming, scroll
│       ├── Composer.js     # Input, send/stop, attach buttons
│       ├── Header.js       # Mobile/desktop header
│       ├── ModelPicker.js  # Provider/model dropdown
│       ├── RobotAvatar.js  # Animated SVG robot face
│       ├── Settings.js     # Settings panel
│       ├── Sidebar.js      # Session history drawer
│       ├── VoiceCapsule.js # Voice message pill with waveform
│       └── VoiceRecorder.js # Browser audio recording
│
├── css/
│   ├── styles.css          # Main styles, CSS variables (1544 lines)
│   └── markdown.css        # Markdown/code block styles (86 lines)
│
├── models-catalog.json     # Bundled provider/model catalog (~2MB)
├── intent_model.ftz        # Quantized fastText intent model (binary)
├── intent_train.txt        # Training data for intent classifier
├── train_model.py          # fastText intent model trainer
├── fasttext.js             # fastText WASM JS wrapper (523 lines) - vendor
├── fasttext_wasm.js        # fastText Emscripten build (12069 lines) - vendor
├── fasttext_wasm.wasm      # fastText WASM binary (306KB) - vendor
│
├── tools/
│   └── make_icons.py       # SVG icon pipeline
│
├── assets/
│   └── icon names for each batch.md  # Icon naming conventions
│
└── docs/
    ├── token-management-research.md
    └── ICON-INVENTORY.md
```

## Architecture

### Loading (index.html)
```html
<script type="module" src="src/main.js"></script>
```
A single ES module entry point. The old multi-script `<script>`-tag architecture was refactored into ES modules with **constructor-injected dependencies** — no globals.

The module graph (all static imports):
```
main.js
├── config/  constants.js, capabilities.js, demo-tools.js
├── utils/   dom.js, icons.js, markdown.js, toasts.js
├── services/catalog/  registry.js (→ loader.js, normalizer.js, picker.js)
├── services/storage/  keylock.js (→ localStorage.js, encryption.js)
├── services/api/      index.js (→ client.js, endpoints.js, context.js)
├── services/intent/   router.js (→ fastText.js → ../../../fasttext.js → fasttext_wasm.js)
├── state/             appState.js
└── components/        Chat, Composer, Header, ModelPicker, RobotAvatar, Settings, Sidebar, VoiceCapsule, VoiceRecorder
```

### Dependency Injection Pattern
Instead of communicating through `window.*` globals, every class takes a `deps` object in its constructor and destructures only what it needs at method-call time:

```javascript
// Example — Sidebar uses deps at call time
render() {
  const { $, state, icon } = this.deps;
  ...
}
```

`src/main.js` builds one shared `deps` object and passes it to all components. Circular references (settings ↔ header ↔ sidebar ↔ composer ↔ chat) are resolved by mutating `deps` **after** construction — safe because components read `this.deps` at method-call time, not construction time:

```javascript
const deps = { $: byId, escHtml, focusFirst, trapFocus, icon, showToast, config, markdown, state, catalog, api, intentRouter };

const robotAvatar = new RobotAvatar(deps);
const header = new Header(deps);
const sidebar = new Sidebar(deps);
const chat = new Chat(deps);
const composer = new Composer(deps);
const settings = new Settings(deps);

// Resolve circular refs
deps.robotAvatar = robotAvatar;
deps.header = header;
deps.sidebar = sidebar;
deps.chat = chat;
deps.composer = composer;
deps.settings = settings;
```

**Key deps entries**:
- `$` → `byId` (document.getElementById shortcut) — exposed as `$` so components destructure `const { $ } = this.deps`
- `state` → AppState instance
- `config` → constants + capabilities + demo tools bundle
- `markdown`, `icon`, `showToast`, `escHtml`, `focusFirst`, `trapFocus` → utility functions
- `catalog`, `api`, `intentRouter` → service instances
- `header`, `sidebar`, `chat`, `composer`, `settings`, `modelPicker`, `robotAvatar`, `voiceCapsule`, `voiceRecorder` → sibling components (resolved post-construction)

### Data Flow
```
User Input → Composer.handleSend()
  ├─ IntentRouter (fastText WASM) → auto-switch model if needed
  ├─ Api.callChatStreaming() → createAdapter(provider) → provider-specific adapter
  │   ├─ OpenAIAdapter / AnthropicAdapter / GoogleAdapter
  │   └─ SSE parsing → Markdown.renderMarkdownish() → Chat bubble.innerHTML
  └─ state.saveMessages() → persistSessions()
```

## Key Modules

### src/main.js (entry point)
**Purpose**: Module wiring. Theme init (no-flash), frame-busting guard, theme toggle, dependency injection, async app init.

**Init sequence** (`init()`):
1. `state.initKeys()` — key-lock flow / legacy migration
2. `catalog.ensureLoaded()` — load model catalog (24h cache)
3. `api.fetchModels()` — fetch models for current provider
4. Fall back to a chat-capable model if saved model is missing
5. Render header, composer, chat, sidebar, settings
6. `chat.initHero()` — animated robot in empty state
7. Suggestion button wiring + desktop layout toggle
8. `intentRouter.load()` — async fastText WASM init (non-blocking)

---

### src/config/constants.js
**Purpose**: Constants and localStorage key names.

**Key exports**:
- `LS_PROVIDER`, `LS_KEYS`, `LS_BASES`, `LS_MODEL_PREFIX`, `LS_SYS`, `LS_MESSAGES`, `LS_SESSIONS`, `LS_ACTIVE`, `LS_TTS_VOICE`, `LS_THEME` → localStorage keys (`anymodel_*`)
- `DEFAULT_PROVIDER` = "openai"
- `PROVIDER_COLORS` → accent colors for 11 providers
- `REQUEST_TIMEOUT_MS = 120000` (2 min), `MEDIA_TIMEOUT_MS = 300000` (5 min), `MODELS_TIMEOUT_MS = 30000` (30 sec)

---

### src/config/capabilities.js
**Purpose**: Capability metadata and helpers.

**Key exports**:
- `CAP_META` → 40+ capability definitions with labels, icons, short names
- `capIcon(cap)` → SVG icon for a capability
- `getEndpointType(model)` → endpoint type from model capabilities

---

### src/config/demo-tools.js
**Purpose**: Demo tools for function calling.

**Key exports**:
- `DEMO_TOOLS` → 2 demo tools (get_current_time, calculate)
- `safeEvaluate(expr)` → safe arithmetic parser (replaces eval)
- `runDemoTool(name, args)` → executes a demo tool
- `getModelLabel(m)`, `getModelColor(m)` → model pill label/color helpers

---

### src/state/appState.js (AppState class)
**Purpose**: Centralized state, localStorage persistence, legacy migration, API key encryption, pub/sub.

**Key methods**:
- `subscribe(cb)` / `_notify(changed)` → state-change pub/sub (components re-render on `"model"`, `"keys"`, `"session:*"`, etc.)
- `migrateLegacyKeys()` → one-time migration from "lahooti_*" to "anymodel_*"
- `initKeys()`, `keysLocked()`, `_syncApiKey()` → key-lock modal flow
- `newSession()`, `switchSession(id)`, `renameSession(id, title)`, `deleteSession(id)`, `clearActiveSession()`
- `setProvider(id)`, `setModel(id)`, `currentModel()`, `currentEndpointType()`
- `effectiveBase()`, `setCustomBase()` → per-provider base URL overrides
- `saveMessages()`, `_persistSessions()` → persistence

**Deps**: `{ catalog, keylock, showToast, config }`

---

### src/services/api/ (Api class + client/endpoints/context)
**Purpose**: Provider adapters, streaming handlers, all endpoint implementations.

**Api class** (`index.js`) — orchestrates:
- `fetchModels()` → per-provider model fetch
- `testConnection()` → settings save-key validation
- `callChatStreaming()`, `callTranscription()`, `callOcr()`, `callTts()`, `callEmbeddings()`, `callModeration()` → routes through `createAdapter(provider)`

**client.js**:
- `beginRequest()` / `abortCurrentRequest()` → AbortController lifecycle
- `fetchWithTimeout(url, opts, timeoutMs)`, `streamSSE(url, headers, body, parseEvent, callbacks)`
- `errorMessage(status, body)` → user-friendly error messages
- `safeJson(res)`, `parseToolArgs(args)`, `dataUrlToBlob(dataUrl)`, `guessAudioFormat(name)`

**endpoints.js**:
- `fetchModels(adapter, state, provider)`, `testConnection(adapter)`
- `callTranscription`, `callOcr`, `callTts`, `callEmbeddings`, `callModeration`

**context.js** (token management):
- `estimateTokens(str)`, `estimateImageTokens(w, h)`, `estimateMessageTokens(m)`
- `getContextWindowSize(m)` (exported as `getContextWindow` alias), `getMaxOutputTokens(m)`
- `truncateText(text, maxChars)`, `selectContext(m, currentText, currentMediaTokens)` → context windowing

**API format differences** (handled by adapters):
- OpenAI: `Authorization: Bearer <key>`, `/chat/completions`
- Anthropic: `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `/messages`
- Google: `x-goog-api-key: <key>`, `/models/{id}:streamGenerateContent?alt=sse`

---

### src/services/catalog/ (registry + loader + normalizer + picker)
**Purpose**: Model catalog loading, caching, provider/model enumeration.

**registry.js** — facade:
- `ensureLoaded()` → loads from localStorage cache (24h TTL) or fetches `models-catalog.json`
- `providerList()` → merged list: catalog + `EXTRA_PROVIDERS` (ollama, custom)
- `getProvider(id)`, `listModels(providerId)`, `pickModel(providerId, kind)`

**loader.js**:
- `ensureCatalogLoaded()`, `invalidateCatalogCache()`

**normalizer.js**:
- `normalizeModel(raw)` → normalized model with capability flags
- `listModels(providerId)`

**picker.js**:
- `pickModelFor(providerId, kind, models)` → auto-select best model for endpoint type

**Capability detection** (in `normalizeModel`):
- `vision`: input_modalities includes "image" or "pdf"
- `function_calling`: tool_call flag
- `reasoning`: reasoning flag
- `audio_transcription`: id matches /whisper|transcri|asr/
- `tts`: id matches /tts|speech|voice|orpheus/
- `embeddings`: id matches /embed/
- `moderation`: id matches /moderat|guard/
- `ocr`: id matches /ocr/

---

### src/services/intent/router.js (IntentRouter class)
**Purpose**: Client-side intent classification using fastText WASM.

**Key constants**:
- `MODEL_URL = "intent_model.ftz"`
- `THRESHOLD = 0.65` (confidence threshold for "confident" classification)
- `AUTO_SWITCH_FLOOR = 0.45` (threshold for auto-switching models)
- `LABELS = ["chat", "tts", "image", "transcription"]`

**IntentRouter class**:
- `load(modelUrl)` → initializes fastText WASM, loads model, runs self-tests
- `classify(text)` → returns `{ intent, confidence, isConfident }`
- `route(userMessage)` → classify + attach original message

**Self-tests**: 7 acceptance cases matching train_model.py validation. The fastText ESM wrapper (`src/services/intent/fastText.js`) re-exports the root vendor `fasttext.js`, which loads `fasttext_wasm.js` (Emscripten build).

---

### src/utils/markdown.js
**Purpose**: Markdown rendering with code highlighting.

**Key exports**:
- `renderMarkdownish(text)` → HTML string with:
  - Fenced code blocks (extracted first, re-inserted with copy button)
  - Headings (h1-h6)
  - Horizontal rules
  - Blockquotes
  - Bold/italic
  - Inline code
  - Links (http/https only)
  - Unordered/ordered lists
  - DOMPurify sanitization
- `enhanceCodeBlocks(container)` → highlight.js + copy button wiring
- `scheduleHighlight(container)` → debounced highlighting (150ms)

---

### src/components/Chat.js
**Purpose**: Message rendering, streaming display, scroll management.

**Key methods**:
- `initScrollHandling()` → tracks stick-to-bottom state
- `scrollIfSticky()` → auto-scrolls if user is at bottom
- `render()` → renders all messages from state
- `createAssistantTurn()` → creates empty assistant bubble for streaming
- `setPhase(turn, key, label)` → shows loading indicator (connect/thinking/tool/audio)
- `collapsePhase(turn)` → collapses loading indicator with animation
- `finalizeTurn(turn, result, m)` → adds tool tag and model tag
- `revealText(turn, text)` → chunked text reveal (prevents O(N²) render freeze)

**Phase types**: `connect`, `thinking`, `tool`, `ocr`, `audio`

---

### src/components/Composer.js
**Purpose**: Input handling, send/stop, attachment management.

**Key methods**:
- `autoResizeTextarea()` → grows textarea up to 200px
- `updateSendButton()` → toggles send/stop icon
- `render()` → updates button states, thinking pills, capability checks
- `handleSend()` → main send flow:
  1. Validates model and key
  2. Auto-switches to capable model for attachments
  3. Client-side intent routing (fastText)
  4. Routes to correct endpoint (chat/transcription/ocr/tts/embeddings/moderation)
  5. Handles streaming and errors
  6. Reverts model if auto-switched for intent
- `handleFileSelected(kind)` → processes image/audio files
- `cancelAttachment(kind)` → clears pending image/audio
- `initEvents()` → wires all event listeners

---

### src/components/Header.js
**Purpose**: Mobile/desktop header rendering.

**Key methods**:
- `render()` → updates model pill, capability strip, placeholder text
- `initEvents()` → wires menu button (`sidebar.toggle()`) and key button (`settings.open()`)

---

### src/components/ModelPicker.js
**Purpose**: Provider/model dropdown with filtering.

**Key methods**:
- `open(anchor)`, `close(restoreFocus)`, `toggle(anchor)` → panel management
- `renderAll()` → builds provider chips and model list
- `buildModelSheet()` → renders filtered model rows
- `position()` → positions panel relative to anchor (handles keyboard on mobile)
- `refresh()` → re-fetches models while open
- `handleKeydown(e)` → keyboard navigation (arrows, enter, escape)

**Filtering**:
- Token-based: every token must match id/label/description/provider or capability keywords
- Cross-provider search when filter is active
- Capability keywords map (e.g., "tts" → ["tts", "text-to-speech", "speech", "voice"])

---

### src/components/RobotAvatar.js
**Purpose**: Animated SVG robot face.

**Key methods**:
- `buildHero(containerEl)` → large hero on empty state
- `buildInline(containerEl)` → small 24px avatar on message row
- `setState(el, 'idle' | 'thinking' | 'speaking')`

**States**: idle (slow blink loop), thinking (eyes darting), speaking (mouth moves). Palette pulled from CSS vars at call time.

---

### src/components/Settings.js
**Purpose**: Settings panel with API key management.

**Key methods**:
- `render()` → populates provider select, key input, system prompt, TTS voice
- `open()`, `close()` → sheet management with focus trap
- `saveKey()` → validates connection, encrypts and saves key
- `clearKey()` → removes key from encrypted store
- `showKeyStatus(kind, msg)` → displays connection status
- `initEvents()` → wires all inputs and buttons

**Key behaviors**:
- Provider switching triggers model re-fetch
- Base URL validation (https required, http for localhost only)
- Two-step inline confirm for clear chat
- WCAG 2.4.3 focus trap

---

### src/components/Sidebar.js
**Purpose**: Session history drawer.

**Key methods**:
- `render()` → builds session list (sorted by updatedAt, filtered to non-empty)
- `open()`, `close()`, `toggle()` → drawer management
- `initEvents()` → wires close, new chat, settings buttons
- `initBrandGlyph()` → renders robot glyph in brand area

**Session actions**:
- Click → switch session
- Rename → inline edit with enter/escape
- Delete → two-click confirm

---

### src/components/VoiceRecorder.js
**Purpose**: Browser audio recording via MediaRecorder API.

**Key methods**:
- `startRecording()` → requests mic permission, starts recording
- `stopRecording()` → stops, creates data URL, sets pending audio state
- `toggle()` → start/stop toggle
- `initEvents()` → wires cancel and stop buttons

---

### src/components/VoiceCapsule.js
**Purpose**: WhatsApp-style voice message pill with waveform visualization.

**Key methods**:
- `build(container, opts)` → creates capsule with play button, waveform, duration
- `stopCurrent()` → stops any playing audio
- `decodeWaveform(src, raw, count)` → decodes audio to amplitude bars

**Features**:
- Deterministic placeholder bars while decoding
- Shared AudioContext for efficiency
- Play/pause toggle with state management

---

### src/services/storage/ (Keylock + localStorage + encryption)
**Purpose**: Persistent, encrypted API key storage.

**Keylock class** (`keylock.js`):
- Passphrase-gated unlock flow. Holds the decrypted keys blob in memory only.
- `initKeys()`, `unlock(pass)`, `lock()`, `wireEvents()`

**localStorage.js**:
- `loadJson(key, fallback)`, `saveJson(key, value)` → localStorage helpers
- `migrateLegacyKeys()` → one-time "lahooti_*" → "anymodel_*" migration

**encryption.js**:
- `encryptKeysBlob(keysObj, pass)`, `decryptKeysBlob(blob, pass)` → AES-GCM (PBKDF2, 150k iterations, SHA-256)
- `keysBlob(getItem)`, `keysLocked(blob, hasPassphrase)`

---

### src/services/providers/ (Adapter base + OpenAI/Anthropic/Google + factory)
**Purpose**: Provider-specific API format handling.

**ProviderAdapter base class** (`Adapter.js`): shared request/response plumbing, streaming, error handling.

**Concrete adapters**: `OpenAIAdapter.js`, `AnthropicAdapter.js`, `GoogleAdapter.js` — each implements the provider's auth headers, URL shapes, and SSE event parsing.

**factory.js**: `createAdapter(provider)` → returns the right adapter for a provider's format.

---

## Key Patterns

### Dependency Injection
```javascript
// All components receive a deps object; read at method-call time
class Sidebar {
  constructor(deps) { this.deps = deps; }
  render() {
    const { $, state, icon } = this.deps;
    ...
  }
}
```

### State Pub/Sub
```javascript
// AppState notifies subscribers on changes
state.subscribe((changed) => {
  switch (changed) {
    case "model": header.render(); composer.render(); break;
    case "session:new":
    case "session:switch":
      chat.render(); composer.render(); sidebar.render(); header.render(); break;
  }
});
```

### Provider Routing
```javascript
const adapter = createAdapter(provider);
const turn = chat.createAssistantTurn();
chat.setPhase(turn, "connect", "Connecting...");
const result = await api.callChatStreaming(turn, text, image, audio, model);
chat.collapsePhase(turn);
chat.finalizeTurn(turn, result, model);
```

### Context Windowing
```javascript
// Walks newest→oldest, truncates long messages, respects budget
const ctx = selectContext(model, currentText, currentMediaTokens);
// Returns { messages, singleCapChars }
```

### Intent Routing
```javascript
// Client-side fastText WASM classifier
const intent = intentRouter.route(text);
// Returns { intent: "chat"|"tts"|"image"|"transcription", confidence, isConfident }
if (intent.confidence >= intentRouter.autoSwitchFloor) {
  // Auto-switch to capable model
}
```

### Encryption
```javascript
// AES-GCM with PBKDF2 (150k iterations, SHA-256)
// Passphrase lives only in memory for the session
// LS_KEYS stores: { enc:1, iter, salt, iv, data } (base64 fields)
await state.saveKeyFor(providerId, key);  // prompts for passphrase if needed
```

## CSS Architecture

### Theme System (css/styles.css)
```css
:root, [data-theme="light"] {
  --bg: #f4f4f5; --bg2: #ffffff; --fg: #18181b;
  --accent: #6d28d9; --accent2: #7c3aed;
  /* ... 20+ CSS variables */
}
[data-theme="dark"] {
  --bg: #09090b; --bg2: #18181b; --fg: #fafafa;
  --accent: #a78bfa; --accent2: #8b5cf6;
}
```

### Layout
- Mobile: single column, hamburger menu
- Desktop (≥860px): sidebar + header visible
- Flexbox-based, responsive

### Key Classes
- `.msg.user` / `.msg.assistant` → message bubbles
- `.bubble` → message content container
- `.phase-window` → loading indicator
- `.voice-capsule` → voice message pill
- `.model-pop` → model picker dropdown
- `.settings-sheet` → settings panel

## Build & Deploy
- **No build step** — files served as-is; ES modules natively
- **GitHub Pages**: push to main, auto-deploys
- **CSP headers**: `script-src 'self' cdnjs.cloudflare.com` (for highlight.js + DOMPurify)
- **Icons**: auto-generated by `tools/make_icons.py` → `src/utils/icons.js`

## Testing
- `train_model.py` → trains intent model, runs validation
- Intent router self-tests → 7 acceptance cases (run in-browser at boot)
- Manual testing via browser

## Known Limitations
- All state in localStorage (5MB limit)
- No server-side processing
- Single-user (no auth)
- No model fine-tuning UI