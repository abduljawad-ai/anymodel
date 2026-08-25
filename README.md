# ⟐ Relay

**Your chatbot. Your keys. Every model.**

Relay is a **bring-your-own-key AI chatbot** — a clean, fast, production-grade chat interface like ChatGPT, Claude, or Kimi, except *you* plug in the API keys and *nothing about models is hardcoded*. Pick any provider (built-ins or your own OpenAI-compatible endpoints), and Relay fetches its **live model list straight from that provider's API** on demand. Page load makes zero provider calls.

## Features

- **Streaming chat** with OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, and any OpenAI-compatible endpoint (Ollama, LM Studio…) — direct from your browser, no server, no middleman.
- **Conversations sidebar** — new chat, search, auto-titled threads, delete with confirm.
- **Full message toolkit** — copy, edit & resend user messages, regenerate replies, thumbs feedback, share-as-quote.
- **⌘K model palette** — search every model across every keyed provider by name or capability (*vision*, *reasoning*, *voice*…).
- **Custom instructions + temperature** — set a global system prompt and sampling temperature in Settings, like ChatGPT's custom instructions.
- **Vision input** — attach or paste images for multimodal models (client-side downscale to ≤1024px).
- **Voice input & read-aloud** — record → Whisper transcription fills the composer; ▶ listen chips read replies aloud (OpenAI TTS).
- **Reasoning visuals** — collapsible "Think" panels stream `reasoning_content` / Claude thinking deltas live; language-labeled code blocks with copy.
- **Long-chat memory (research-backed)** — when history nears the context budget (Settings → adjustable), oldest turns fold into a rolling AI-written memory so long chats stay cheap on every model; reactive emergency compaction catches "context too long" errors and retries once.
- **Encrypted key vault** — AES-GCM-256 at rest (PBKDF2-SHA256, 310k iterations). Passphrase lives in memory only; auto-lock after idle; wrong passphrase fails closed.
- **Hardened** — strict CSP (zero console errors), timeout + Retry-After backoff on every request, sanitized markdown, https-only bases (localhost exempt), no telemetry.
- **Data portability** — export/import JSON backups (never keys), export threads as Markdown.
- **Installable (PWA)** — manifest, icons, OG cards for clean social shares.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # type-check + production bundle
```

## Security model

- Plaintext keys exist **only in memory** while unlocked; at rest they're an encrypted blob in `localStorage`.
- Lock anytime from Settings; auto-lock after 15 min idle (configurable).
- Custom base URLs must be https (localhost exempt for local models).
- Backups contain conversations + settings only — never key material.
- Markdown renders through an escape-first sanitize pipeline; links restricted to http(s).

## Provider notes

- **Anthropic** requires the `anthropic-dangerous-direct-browser-access` header for direct browser calls — Relay sends it automatically.
- **OpenAI-compatible**: set a custom base URL in Providers (e.g. `http://localhost:11434/v1` for Ollama). Keys are optional for local servers.
- Voice features use OpenAI endpoints (`whisper-1`, `tts-1`).

## Architecture

```
src/
  adapters/    one ProviderAdapter contract, four wire formats (+ factory)
  vault/       WebCrypto encryption + zustand key store
  catalog/     live model discovery + capability heuristics
  state/       sessions / ui / settings / stream registry (zustand)
  ui/          design-system primitives (Button, Sheet, Dialog, Dropdown, …)
  features/    shell · thread · composer · palette · providers · settings
  lib/         sse parser · markdown · tokens · audio bus · toasts · net
```

Deploying: **`docs/DEPLOY.md`** (GitHub Pages / Cloudflare Pages / Netlify / Vercel — all free).
