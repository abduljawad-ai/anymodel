# ⟐ Relay

**One thread. Every model.**

Relay is a **zero-backend BYOK AI harness**: a production chat interface where *nothing about models is hardcoded*. Pick any provider (built-in wire formats or your own OpenAI-compatible endpoints via **+ Add provider**), click it once — Relay fetches its **live model list straight from that provider's API** using your key, on demand, cached 10 minutes. Page load makes zero provider calls.

The hero interaction is still **swapping models mid-conversation** — every answer carries its maker's badge, the *baton trail* shows who carried the thread so far, and ⚡ handoff continues any reply's context with a different model.

## Features

- **Streaming chat** with OpenAI, Anthropic, Google, and any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, LM Studio…) — direct from your browser, no server.
- **Mid-thread model swap** via the ⌘K command palette (search by name, provider, or capability like *vision* / *reasoning* / *image*), plus one-click **⚡ handoff** from any reply to continue its context with a different model.
- **Studio — image & video generation.** Type a prompt, pick any image model (gpt-image-1, DALL·E 3, Flux…) or video model (Sora, Veo…) from your providers' **live model lists**. Jobs stream progress, land in the Studio gallery, and survive reloads.
- **Code IDE.** Every HTML/CSS/JS code block in a reply gets **IDE** and **run** buttons: a CodeMirror editor with a sandboxed live preview, copy / save / send-back-to-thread. Desktop = side panel, mobile = full screen.
- **Encrypted key vault** — AES-GCM-256 at rest (PBKDF2-SHA256, 310k iterations). Your passphrase lives in memory only; keys auto-lock after idle; nothing ever leaves your browser except calls to the provider you chose.
- **Voice** — record → provider transcription fills the composer; ▶ listen chips read replies aloud (OpenAI TTS).
- **Live voice (realtime)** — select any `/realtime` model and hit the live-voice action: WebRTC session with ephemeral tokens, live two-way transcript, mute/end.
- **Vision input** — attach or paste images for multimodal models (client-side downscale).
- **Session compaction (research-backed)** — when history nears the context budget (Settings → adjustable), oldest turns fold into a rolling AI-written memory (Claude-Code-style structured delta summaries; MemGPT-style FIFO-head). Hot recent turns stay verbatim; reactive emergency compaction catches provider "context too long" errors and retries once. Long chats stay cheap on **every** model.
- **Thinking & reasoning visuals** — shimmer "Connecting…→Thinking…" phases, collapsible 🧠 reasoning panels for reasoning models (`reasoning_content` / Claude thinking deltas), language-labeled code headers.
- **Hardened networking** — every request runs through timeout+Retry-After backoff (429/503 auto-retry once), strict CSP, sanitized markdown, https-only bases (localhost exempt).
- **Data portability** — export/import JSON backups (never keys) and export any thread as Markdown.
- **Installable (PWA)** — manifest + icons + OG cards for a native-app feel and clean social shares.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (91 tests)
npm run build      # type-check + production bundle
```

## Security model

- Plaintext keys exist **only in memory** while unlocked; at rest they're an encrypted blob in `localStorage`.
- Wrong passphrase fails closed. Lock anytime from Settings; auto-lock after 15 min idle (configurable).
- Custom base URLs must be https (localhost exempt for local models).
- Backups contain conversations + settings only — never key material.
- Markdown is rendered through an escape-first sanitize pipeline; links restricted to http(s).
- Strict Content-Security-Policy (no inline scripts, no framing), no telemetry anywhere.

## Provider notes

- **Anthropic** requires the `anthropic-dangerous-direct-browser-access` header for direct browser calls — Relay sends it automatically.
- **OpenAI-compatible**: set a custom base URL in Settings (e.g. `http://localhost:11434/v1` for Ollama). Keys are optional for local servers.
- **Image generation** uses the OpenAI wire (`/images/generations`) — works with OpenAI and any compatible endpoint that implements it. **Video** uses OpenAI Sora (`/videos`) and Google Veo (`predictLongRunning`).
- Voice features use OpenAI endpoints (`whisper-1`, `tts-1`) today.

## Architecture

```
src/
  adapters/    one ProviderAdapter contract: 4 wire formats + image/video generation
  vault/       WebCrypto encryption + zustand key store (+ optional relay-gate custody)
  catalog/     live model discovery + capability heuristics (vision/image/video/…)
  state/       sessions / ui / settings / stream registry (zustand)
  studio/      generation engine (job queue, polling, cancel) + store
  ide/         CodeMirror editor, sandboxed live preview, buffer store
  ui/          design-system primitives (Button, Sheet, Dialog, Dropdown, …)
  features/    shell · thread · composer · palette · providers · studio · settings · voice
  lib/         sse parser · markdown · tokens · audio bus · toasts · research · net
```

Design spec: `docs/superpowers/specs/2026-08-24-relay-v3-design.md`
Implementation plan: `docs/superpowers/plans/2026-08-24-relay-v3-implementation.md`
Deploying: **`docs/DEPLOY.md`** (GitHub Pages / Cloudflare Pages / Netlify / Vercel — all free).
