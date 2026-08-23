# ⟐ Relay

**One thread. Every model.**

Relay is a **zero-backend BYOK AI harness**: a production chat interface where *nothing about models is hardcoded*. Pick any provider (built-in wire formats or your own OpenAI-compatible endpoints via **+ Add provider**), click it once — Relay fetches its **live model list straight from that provider's API** using your key, on demand, cached 10 minutes. Page load makes zero provider calls.

The hero interaction is still **swapping models mid-conversation** — every answer carries its maker's badge, the *baton trail* shows who carried the thread so far, and ⚡ handoff continues any reply's context with a different model.

Reimagined from scratch as a "paper workbench": warm paper light theme, espresso dark theme, signal-orange accent, sharp 8px radii, Space Grotesk + JetBrains Mono.

## Features

- **Streaming chat** with OpenAI, Anthropic, Google, and any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, LM Studio…) — direct from your browser, no server.
- **Mid-thread model swap** via the ⌘K command palette (search by name, provider, or capability like *vision* / *reasoning* / *voice*), plus one-click **⚡ handoff** from any reply to continue its context with a different model.
- **Encrypted key vault** — AES-GCM-256 at rest (PBKDF2-SHA256, 310k iterations). Your passphrase lives in memory only; keys auto-lock after idle; nothing ever leaves your browser except calls to the provider you chose.
- **Compare arena** — one prompt fans out to 2–3 models side-by-side; promote the winner back into the thread.
- **Voice** — record → provider transcription fills the composer; ▶ listen chips read replies aloud (OpenAI TTS).
- **Lab benches** — embeddings cosine-similarity tester and moderation screener.
- **Vision input** — attach or paste images for multimodal models (client-side downscale).
- **Session compaction (research-backed)** — when history nears the context budget (Settings → adjustable), oldest turns fold into a rolling AI-written memory (Claude-Code-style structured delta summaries; MemGPT-style FIFO-head). Hot recent turns stay verbatim; reactive emergency compaction catches provider "context too long" errors and retries once. Long chats stay cheap on **every** model. See `docs/research/session-compaction.md`.
- **Live voice (realtime)** — select any `/realtime` model (e.g. `gpt-4o-realtime-preview`) and hit **● Live voice**: WebRTC session with ephemeral tokens, pulsing orb, live two-way transcript, mute/end.
- **Thinking & reasoning visuals** — shimmer "Connecting…→Thinking…" phases, collapsible 🧠 Reasoning panels for reasoning models (`reasoning_content` / Claude thinking deltas), language-labeled code headers.
- **Hardened networking** — every request runs through timeout+Retry-After backoff (429/503 auto-retry once), strict CSP, sanitized markdown, https-only bases (localhost exempt).
- **Data portability** — export/import JSON backups (never keys) and export any thread as Markdown.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # type-check + production bundle
```

## Security model

- Plaintext keys exist **only in memory** while unlocked; at rest they're an encrypted blob in `localStorage`.
- Wrong passphrase fails closed. Lock anytime from Settings; auto-lock after 15 min idle (configurable).
- Custom base URLs must be https (localhost exempt for local models).
- Backups contain conversations + settings only — never key material.
- Markdown is rendered through an escape-first sanitize pipeline; links restricted to http(s).

## Security notes

Strict Content-Security-Policy (no inline scripts, no framing), keys AES-GCM at rest with auto-lock, no telemetry anywhere. Roadmap (in `docs/superpowers/plans/2026-08-23-harness-pivot.md`): **Phase P** split-key proxy custody (server-held encrypted provider keys + client pairing keys) and **Phase G** GitHub-native auth/storage (your own repo = your account and database).

## Provider notes

- **Anthropic** requires the `anthropic-dangerous-direct-browser-access` header for direct browser calls — Relay sends it automatically.
- **OpenAI-compatible**: set a custom base URL in Settings (e.g. `http://localhost:11434/v1` for Ollama). Keys are optional for local servers.
- Voice features use OpenAI endpoints (`whisper-1`, `tts-1`) today.

## Architecture

```
src/
  adapters/    one ProviderAdapter contract, four wire formats (+ factory)
  vault/       WebCrypto encryption + zustand key store
  catalog/     curated model lists + capability heuristics
  state/       sessions / ui / settings / stream registry (zustand)
  features/    shell · thread · composer · palette · compare · lab · settings
  lib/         sse parser · markdown · tokens · audio bus · toasts
```

Design spec: `docs/superpowers/specs/2026-08-22-relay-design.md`
Implementation plan: `docs/superpowers/plans/2026-08-22-relay-implementation.md`
