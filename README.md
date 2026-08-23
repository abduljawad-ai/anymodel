# ⟐ Relay

**One thread. Every model.**

Relay is a zero-backend, bring-your-own-key AI chat app for people who hold API keys across several providers. One clean interface, every model, and the hero interaction is **swapping models mid-conversation** — every answer carries its maker's badge, and the *baton trail* shows who carried the thread so far.

Reimagined from scratch as a "paper workbench": warm paper light theme, espresso dark theme, signal-orange accent, sharp 8px radii, Space Grotesk + JetBrains Mono.

## Features

- **Streaming chat** with OpenAI, Anthropic, Google, and any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, LM Studio…) — direct from your browser, no server.
- **Mid-thread model swap** via the ⌘K command palette (search by name, provider, or capability like *vision* / *reasoning* / *voice*), plus one-click **⚡ handoff** from any reply to continue its context with a different model.
- **Encrypted key vault** — AES-GCM-256 at rest (PBKDF2-SHA256, 310k iterations). Your passphrase lives in memory only; keys auto-lock after idle; nothing ever leaves your browser except calls to the provider you chose.
- **Compare arena** — one prompt fans out to 2–3 models side-by-side; promote the winner back into the thread.
- **Voice** — record → provider transcription fills the composer; ▶ listen chips read replies aloud (OpenAI TTS).
- **Lab benches** — embeddings cosine-similarity tester and moderation screener.
- **Vision input** — attach or paste images for multimodal models (client-side downscale).
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
