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
├── index.html              # Main HTML entry point (262 lines)
├── AGENT.md                # Agent instructions (80 lines)
├── README.md               # Project readme
├── PROJECT_SOURCE.md       # This file
├── .gitignore              # Ignores node_modules, .playwright-mcp/, etc.
│
├── js/
│   ├── app.js              # Entry point, theme init, frame-busting (135 lines)
│   ├── config.js           # Constants, helpers, CAP_META, demo tools (219 lines)
│   ├── api.js              # Provider adapters, streaming, all endpoints (792 lines)
│   ├── state.js            # Centralized state, localStorage persistence (550 lines)
│   ├── catalog.js          # Model catalog loader with 24h cache (156 lines)
│   ├── icons.js            # Auto-generated SVG icon map (58 lines) - DO NOT EDIT
│   ├── markdown.js         # Markdown rendering + code highlighting (121 lines)
│   ├── intent-router.js    # fastText WASM intent classifier (132 lines)
│   └── components/
│       ├── chat.js         # Message rendering, streaming, scroll (246 lines)
│       ├── composer.js     # Input, send/stop, attach buttons (345 lines)
│       ├── header.js       # Mobile/desktop header (49 lines)
│       ├── model-picker.js # Provider/model dropdown (366 lines)
│       ├── settings.js     # Settings panel (210 lines)
│       ├── sidebar.js      # Session history drawer (157 lines)
│       ├── voice-recorder.js # Browser audio recording (91 lines)
│       └── voice-capsule.js # Voice message pill with waveform (183 lines)
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

### Loading Order (index.html)
```html
<script src="fasttext.js"></script>         <!-- WASM runtime -->
<script src="js/icons.js"></script>         <!-- Icon map -->
<script src="js/config.js"></script>        <!-- Constants, helpers -->
<script src="models-catalog.json"></script>  <!-- Inline catalog -->
<script src="js/catalog.js"></script>       <!-- Catalog logic -->
<script src="js/state.js"></script>         <!-- State, persistence -->
<script src="js/api.js"></script>           <!-- API adapters -->
<script src="js/markdown.js"></script>      <!-- Markdown renderer -->
<script src="js/components/header.js"></script>
<script src="js/components/sidebar.js"></script>
<script src="js/components/settings.js"></script>
<script src="js/components/model-picker.js"></script>
<script src="js/components/voice-recorder.js"></script>
<script src="js/components/voice-capsule.js"></script>
<script src="js/components/chat.js"></script>
<script src="js/components/composer.js"></script>
<script type="module" src="js/intent-router.js"></script>  <!-- ES module -->
<script src="js/app.js"></script>           <!-- Entry point -->
```

### Global State Pattern
All modules communicate via globals:
- `window.$` → `document.getElementById`
- `window.icon(name)` → SVG string from icons map
- `window.Catalog` → model catalog API
- `window.Config` → constants and helpers
- `window.State` → centralized state object
- `window.Api` → provider adapters
- `window.Header`, `Sidebar`, `Settings`, `ModelPicker`, `Chat`, `Composer` → UI components

### Data Flow
```
User Input → Composer.handleSend()
  ├─ Intent Router (fastText WASM) → auto-switch model if needed
  ├─ Api.callChatStreaming() → provider-specific adapter
  │   ├─ streamOpenAI() / streamAnthropic() / streamGoogle()
  │   └─ SSE parsing → Markdown.renderMarkdownish() → Chat.bubble.innerHTML
  └─ State.messages.push() → saveMessages() → persistSessions()
```

## Key Modules

### config.js (219 lines)
**Purpose**: Constants, localStorage keys, capability metadata, helpers.

**Key exports**:
- `LS_*` → localStorage key names (e.g., `LS_PROVIDER = "anymodel_provider_v1"`)
- `CAP_META` → 40+ capability definitions with labels, icons, short names
- `PROVIDER_COLORS` → accent colors for 11 providers
- `DEMO_TOOLS` → 2 demo tools for function calling (get_current_time, calculate)
- `safeEvaluate(expr)` → safe arithmetic parser (replaces eval)
- `$(id)` → shortcut for `document.getElementById`
- `FOCUSABLE` → CSS selector for focusable elements
- `focusFirst(root)`, `trapFocus(root)` → WCAG focus management

**Globals exposed**: `window.Config`

---

### state.js (550 lines)
**Purpose**: Centralized state, localStorage persistence, legacy migration, API key encryption.

**Key functions**:
- `migrateLegacyKeys()` → one-time migration from "lahooti_*" to "anymodel_*"
- `migrateLegacyMessages()` → moves old messages to sessions format
- `loadJson(key, fallback)`, `saveJson(key, value)` → localStorage helpers
- `encryptKeysBlob(obj, pass)`, `decryptKeysBlob(blob, pass)` → AES-GCM encryption
- `unlockKeys(pass)`, `initKeys()` → key-lock modal flow
- `newSession()`, `switchSession(id)`, `renameSession(id, title)`, `deleteSession(id)`
- `setProvider(id)`, `setModel(id)` → provider/model switching
- `saveMessages()`, `persistSessions()` → persistence
- `showToast(msg)` → transient notifications

**Global state object** (`window.State`):
```javascript
{
  provider: "openai",
  apiKeys: {},        // populated by initKeys() - never from storage directly
  customBases: {},    // per-provider base URL overrides
  apiKey: "",         // current provider's key
  model: "",          // current model ID
  systemPrompt: "",
  ttsVoice: "",
  autoTools: true,
  thinkingEffort: "instant",
  messages: [],       // active session messages
  sessions: [],       // all sessions
  activeSessionId: "",
  models: [],         // current provider's models
  modelsLoaded: false,
  stickToBottom: true,
  sending: false,
  pendingImage: null,
  pendingAudio: null,
  notice: null
}
```

**Globals exposed**: `window.State`, `window.setModel`, `window.setProvider`, `window.currentModel`, `window.currentEndpointType`, `window.saveKeyFor`, `window.setCustomBase`, `window.effectiveBase`, `window.saveMessages`, `window.showToast`, `window.activeSession`, `window.newSession`, `window.switchSession`, `window.renameSession`, `window.deleteSession`, `window.clearActiveSession`, `window.initKeys`, `window.unlockKeys`, `window.keysLocked`

---

### api.js (792 lines)
**Purpose**: Provider adapters, streaming handlers, all endpoint implementations.

**Key functions**:
- `beginRequest()` → creates AbortController, cancels previous request
- `currentProvider()`, `getBaseUrl()`, `getAuthHeaders()` → provider config
- `errorMessage(status, body)` → user-friendly error messages
- `estimateTokens(str)`, `estimateImageTokens(w, h)` → token estimation
- `selectContext(m, currentText, currentMediaTokens)` → context windowing
- `fetchWithTimeout(url, opts, timeoutMs)` → fetch with timeout

**Streaming adapters**:
- `streamOpenAI(turn, body)` → OpenAI SSE format
- `streamAnthropic(turn, body)` → Anthropic SSE format
- `streamGoogle(turn, modelId, body)` → Google SSE format
- `callChatStreaming(turn, text, image, audio, m)` → routes to correct adapter

**Endpoint implementations**:
- `callTranscriptionStreaming(turn, dataUrl, modelId)` → audio → text
- `callOcrStreaming(turn, dataUrl, modelId)` → image → text
- `callTtsStreaming(turn, text, modelId)` → text → audio
- `callEmbeddingsStreaming(turn, text, modelId)` → text → vectors
- `callModerationStreaming(turn, text, modelId)` → text → safety check

**API format differences**:
- OpenAI: `Authorization: Bearer <key>`, `/chat/completions`
- Anthropic: `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `/messages`
- Google: `x-goog-api-key: <key>`, `/models/{id}:streamGenerateContent?alt=sse`

**Timeouts**:
- `REQUEST_TIMEOUT_MS = 120000` (2 min)
- `MEDIA_TIMEOUT_MS = 300000` (5 min)
- `MODELS_TIMEOUT_MS = 30000` (30 sec)

**Globals exposed**: `window.Api`

---

### catalog.js (156 lines)
**Purpose**: Model catalog loading, caching, provider/model enumeration.

**Key functions**:
- `ensureCatalogLoaded()` → loads from localStorage cache (24h TTL) or fetches `models-catalog.json`
- `providerList()` → merged list: catalog + ollama + custom
- `getProvider(id)` → provider metadata
- `listModels(providerId)` → normalized model list with capabilities
- `pickModel(providerId, kind)` → auto-select best model for endpoint type

**Capability detection** (in `normalizeModel`):
- `vision`: input_modalities includes "image" or "pdf"
- `function_calling`: tool_call flag
- `reasoning`: reasoning flag
- `audio_transcription`: id matches /whisper|transcri|asr/
- `tts`: id matches /tts|speech|voice|orpheus/
- `embeddings`: id matches /embed/
- `moderation`: id matches /moderat|guard/
- `ocr`: id matches /ocr/

**Globals exposed**: `window.Catalog`

---

### intent-router.js (132 lines)
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

**Self-tests**: 7 acceptance cases matching train_model.py validation

**Globals exposed**: `window.IntentRouter`

---

### markdown.js (121 lines)
**Purpose**: Markdown rendering with code highlighting.

**Key functions**:
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

**Globals exposed**: `window.Markdown`

---

### components/chat.js (246 lines)
**Purpose**: Message rendering, streaming display, scroll management.

**Key functions**:
- `initScrollHandling()` → tracks stick-to-bottom state
- `scrollIfSticky()` → auto-scrolls if user is at bottom
- `render()` → renders all messages from State.messages
- `createAssistantTurn()` → creates empty assistant bubble for streaming
- `setPhase(turn, key, label)` → shows loading indicator (connect/thinking/tool/audio)
- `collapsePhase(turn)` → collapses loading indicator with animation
- `finalizeTurn(turn, result, m)` → adds tool tag and model tag
- `revealText(turn, text)` → chunked text reveal (prevents O(N²) render freeze)

**Phase types**: `connect`, `thinking`, `tool`, `ocr`, `audio`

**Globals exposed**: `window.Chat`

---

### components/composer.js (345 lines)
**Purpose**: Input handling, send/stop, attachment management.

**Key functions**:
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

**Globals exposed**: `window.Composer`

---

### components/header.js (49 lines)
**Purpose**: Mobile/desktop header rendering.

**Key functions**:
- `render()` → updates model pill, capability strip, placeholder text
- `initEvents()` → wires menu button and key button

**Globals exposed**: `window.Header`

---

### components/model-picker.js (366 lines)
**Purpose**: Provider/model dropdown with filtering.

**Key functions**:
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

**Globals exposed**: `window.ModelPicker`

---

### components/settings.js (210 lines)
**Purpose**: Settings panel with API key management.

**Key functions**:
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

**Globals exposed**: `window.Settings`

---

### components/sidebar.js (157 lines)
**Purpose**: Session history drawer.

**Key functions**:
- `render()` → builds session list (sorted by updatedAt, filtered to non-empty)
- `open()`, `close()`, `toggle()` → drawer management
- `initEvents()` → wires close, new chat, settings buttons

**Session actions**:
- Click → switch session
- Rename → inline edit with enter/escape
- Delete → two-click confirm

**Globals exposed**: `window.Sidebar`

---

### components/voice-recorder.js (91 lines)
**Purpose**: Browser audio recording via MediaRecorder API.

**Key functions**:
- `startRecording()` → requests mic permission, starts recording
- `stopRecording()` → stops, creates data URL, sets State.pendingAudio
- `toggle()` → start/stop toggle
- `initEvents()` → wires cancel and stop buttons

**Globals exposed**: `window.VoiceRecorder`

---

### components/voice-capsule.js (183 lines)
**Purpose**: WhatsApp-style voice message pill with waveform visualization.

**Key functions**:
- `build(container, opts)` → creates capsule with play button, waveform, duration
- `stopCurrent()` → stops any playing audio
- `decodeWaveform(src, raw, count)` → decodes audio to amplitude bars

**Features**:
- Deterministic placeholder bars while decoding
- Shared AudioContext for efficiency
- Play/pause toggle with state management

**Globals exposed**: `window.VoiceCapsule`

---

## Key Patterns

### State Management
- All state in `window.State` object
- Components read directly from State
- Mutations call `saveMessages()` / `persistSessions()` to persist
- UI updates via `Component.render()` calls

### Provider Routing
```javascript
const p = currentProvider();
if(p.format === "anthropic") return chatAnthropic(...);
if(p.format === "google") return chatGoogle(...);
return chatOpenAI(...);  // default
```

### Streaming Pattern
```javascript
const turn = Chat.createAssistantTurn();
Chat.setPhase(turn, "connect", "Connecting...");
const result = await Api.callChatStreaming(turn, text, image, audio, model);
Chat.collapsePhase(turn);
Chat.finalizeTurn(turn, result, model);
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
const intent = IntentRouter.route(text);
// Returns { intent: "chat"|"tts"|"image"|"transcription", confidence, isConfident }
if(intent.confidence >= IntentRouter.autoSwitchFloor) {
  // Auto-switch to capable model
}
```

### Encryption
```javascript
// AES-GCM with PBKDF2 (150k iterations, SHA-256)
// Passphrase lives only in memory for the session
// LS_KEYS stores: { enc:1, iter, salt, iv, data } (base64 fields)
await saveKeyFor(providerId, key);  // prompts for passphrase if needed
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
- **No build step** — files served as-is
- **GitHub Pages**: push to main, auto-deploys
- **CSP headers**: `script-src 'self' cdnjs.cloudflare.com` (for highlight.js)
- **Icons**: auto-generated by `tools/make_icons.py` → `js/icons.js`

## Testing
- `train_model.py` → trains intent model, runs validation
- Intent router self-tests → 7 acceptance cases
- Manual testing via browser

## Known Limitations
- All state in localStorage (5MB limit)
- No server-side processing
- Single-user (no auth)
- No model fine-tuning UI
