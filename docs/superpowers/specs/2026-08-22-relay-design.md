# Relay — Design Spec

**Date:** 2026-08-22
**Status:** Approved by user (both design sections)
**Type:** Ground-up reimagining of a bring-your-own-key multi-provider AI chat app. No code, names, styles, or features reused from any prior implementation.

---

## 1 · Problem & Audience

People who hold API keys across several AI providers (OpenAI, Anthropic, Google, local/self-hosted) have no single private place to use them: every provider has its own site, its own history, its own quirks. Existing aggregators require accounts and server-side key storage.

**Relay** is a zero-backend, privacy-first desktop-class web app: you bring your own keys, they stay encrypted in your browser, and one clean interface chats with *any* model — switching models mid-conversation is the core interaction.

**Audience:** AI power-users, developers, and tinkerers comfortable managing API keys who value privacy and model diversity.

**Tagline:** *One thread. Every model.*

## 2 · Product Shape (decided)

Chat-first, swap-friendly. A familiar conversation thread where **changing models mid-thread is the hero interaction**, with visible model badges on every answer. Secondary modes: Compare (split fan-out), Lab (embeddings/moderation benches), Voice (STT/TTS).

## 3 · Scope

### In scope (v1)
1. Streaming chat with OpenAI, Anthropic, Google, and any OpenAI-compatible endpoint (custom base URL → Ollama, Groq, OpenRouter, LM Studio…).
2. Mid-thread model swap via composer **Model Dial** + ⌘K cross-provider **Palette**; "Hand off to…" on any assistant message continues its context with another model; per-message model badges; "baton trail" of models used in the thread.
3. Encrypted key vault: AES-GCM via WebCrypto, PBKDF2-SHA256 (310k iterations), passphrase memory-only, auto-lock after idle, lock/unlock UI, per-key connection test.
4. Sessions sidebar: create/rename/delete/auto-title (first user message), sorted by recency.
5. Vision input: image attach/paste for vision-capable models (client-side downscale ≤1024px JPEG).
6. Voice: mic recording → provider STT fills composer; TTS playback chips on TTS-capable answers (one audio at a time).
7. Compare mode: 2–3 models, one prompt fans out into streaming columns; "Promote winner" appends chosen answer to main thread.
8. Lab: Embeddings bench (two texts → cosine similarity) and Moderation bench (text → category flags), using selected provider endpoints.
9. Markdown rendering (sanitized; http(s) links only) with code-block copy buttons.
10. Data: JSON export/import of sessions+settings (never keys); export thread as Markdown.
11. Light/dark themes, responsive 375–1280px+, WCAG AA, keyboard navigable, reduced-motion respected.
12. First-run wizard: set passphrase → paste keys → test connection.

### Out of scope (v1)
- Accounts/sync/server anything; separate OCR endpoint (vision models read images natively); ML intent auto-routing; prompt libraries; team features; mobile-native packaging.

## 4 · Architecture

Vite + React 18 + TypeScript SPA. No backend. Direct browser→provider HTTPS with SSE streaming read via `fetch` + `ReadableStream`.

```
src/
  app/            shell, theme boot, routing between Thread/Compare/Lab views
  adapters/       provider contract + implementations
    types.ts      ProviderAdapter interface, chunk/error types
    openai.ts     Bearer auth, /chat/completions stream, /audio/*
    anthropic.ts  x-api-key + anthropic-version, /messages stream
    google.ts     x-goog-api-key, :streamGenerateContent?alt=sse
    compatible.ts OpenAI-shaped, custom base URL (https enforced; localhost exempt)
    factory.ts    adapter selection
  vault/          crypto.ts (AES-GCM/PBKDF2), vaultStore.ts (zustand), Wizard UI hooks
  catalog/        curated starter catalogs w/ capability flags (vision|stt|tts|reasoning|tools),
                  normalizer, live /models refresh where supported
  state/          sessionStore.ts, uiStore.ts (theme/view/toasts), streamRegistry.ts
  features/
    thread/       ThreadView, MessageBubble, BatonTrail, HandoffMenu
    composer/     Composer, ModelDial, ImageAttach, MicRecorder
    palette/      CommandPalette (⌘K, type-to-filter, capability keywords)
    compare/      CompareView, CompareColumn
    lab/          EmbeddingsBench, ModerationBench
    settings/     SettingsSheet, KeyManager, DataPort
  lib/            sse.ts, markdown.ts, tokens.ts (estimator), export.ts, toast.ts, id.ts
```

**Adapter contract (one interface, three wire formats):**

```ts
interface ProviderAdapter {
  streamChat(req: ChatRequest, signals: StreamSignals): Promise<void>;
  transcribe(audio: Blob, modelId: string): Promise<string>;
  speak(text: string, modelId: string): Promise<Blob>;
  embed(inputs: string[], modelId: string): Promise<number[][]>;
  moderate(input: string, modelId: string): Promise<ModerationResult>;
  listModels(): Promise<ModelInfo[]> | null;   // null → catalog only
  testConnection(): Promise<{ ok: boolean; detail?: string }>;
}
```

`StreamSignals`: `{ onDelta(t:string), onDone(meta), onError(e), abortSignal }`.
Google non-stream fallback permitted when SSE unsupported.

## 5 · Data Model & Persistence

```ts
Turn = {
  id: string; role: 'user'|'assistant';
  content: string;
  modelId?: string;            // assistant turns: which model carried the baton
  imageUrl?: string;           // data URL, downscaled
  audioOutUrl?: string;        // TTS result (session-only, not persisted)
  tokensEst?: number;
  error?: { code: string; message: string };
}
Session = { id, title, createdAt, updatedAt, turns: Turn[] }
```

- `localStorage["relay.sessions.v1"]` — sessions array (images included as data URLs; hard cap ~2MB total — when exceeded, oldest images are dropped and a toast explains why).
- `localStorage["relay.vault.v1"]` — `{ salt, iv, iterations, ciphertext }` base64 blob. Plaintext keys exist only in memory while unlocked.
- `localStorage["relay.settings.v1"]` — theme, activeProvider/model per session slot, autoLockMinutes, custom bases.
- Zustand stores with narrow selectors; streaming deltas route through `streamRegistry` so Stop works globally and only the live bubble re-renders.

## 6 · UX Flows

- **Shell:** left rail sessions (drawer <768px) · center thread · sticky composer. Empty state shows blueprint-grid hero + "add a key" CTA if vault empty.
- **Swap:** composer Model Dial chip → Palette. Filter matches name/provider/capability synonyms ("vision", "fast", "reasoning", "cheap"). Enter selects; Esc restores previous.
- **Handoff:** hover assistant bubble → ⚡ menu → pick model → next send replays full context under new modelId.
- **Compare:** composer toggle → column picker → prompt fans out → per-column Stop → Promote winner appends to thread.
- **Voice:** click mic to toggle recording → record overlay (timer, cancel) → STT → composer text. TTS chip ▶ on capable answers; global single-audio rule.
- **Errors:** typed ApiError map — 401 "key rejected — check vault", 429 rate-limit copy + Retry, timeout/network via AbortController, failed turn renders inline error card with Retry action. Global Stop button during stream.
- **Wizard (first run):** passphrase → keys per provider (optional each) → one-click Test → done.

## 7 · Visual Identity

Opposite of violet-dark-pill aesthetics:

- Light-first **paper workbench**: bg `#FAF6EF`, ink `#191714`, hairline rules `#E5DED2`, faint blueprint grid in empty states. Dark: espresso `#14120F`, cream `#F3EDE2`. All pairs AA-checked.
- Accent **signal orange `#E4572E`** sparingly (active dial ring, streaming caret, primary actions). Muted per-provider badge tints.
- Type: **Space Grotesk** (display/UI) + **JetBrains Mono** (badges/code/token counts). System-font fallback stack required offline-safe.
- Radii 8px sharp (no pills). Motion: quick springy `cubic-bezier(.2,.9,.25,1)` 150–250ms; disabled under `prefers-reduced-motion`.

## 8 · Security

- Keys AES-GCM-256 at rest; PBKDF2-SHA256 310k; random 16-byte salt, 12-byte IV per encrypt. Passphrase never persisted; wrong-passphrase unlock fails cleanly.
- Auto-lock clears in-memory keys after configurable idle (default 15min).
- Custom base URLs must be https except localhost/127.0.0.1.
- All rendered markdown sanitized (escape-first pipeline; links restricted to http(s)).
- Strict CSP; markdown rendering via **marked + DOMPurify** (escape-first pipeline; links restricted to http(s)).

## 9 · Testing & Quality

- Vitest unit: `sse.ts` (3 wire formats incl. malformed chunks), `crypto.ts` roundtrip + wrong-password failure, `tokens.ts`, `catalog` normalization, `export.ts`.
- Testing Library: composer send flow (mocked adapter), palette filter/keyboard nav, vault lock/unlock/autolock, compare promote.
- Coverage target ≥80% lines for `lib/`, `adapters/`, `vault/`.
- Manual QA matrix: 375 / 768 / 1280 widths, light+dark, reduced-motion.

## 10 · Success Criteria

1. Fresh clone → `npm i && npm run dev` → wizard → first streamed answer from ≥2 different providers within 3 minutes.
2. Swap model mid-thread; badge + baton trail reflect it; handoff preserves context.
3. Kill network mid-stream → clean error card + retry works.
4. Reload page → sessions persist, vault locked, unlock restores function.
5. Export → wipe → import → identical threads.
