# anymodel

**Live:** <https://abduljawad-ai.github.io/anymodel/>

A zero-backend, bring-your-own-key AI chat app that runs entirely in your browser. Pick a provider, paste your own API key (it never leaves your machine), and chat with streaming responses, vision, audio, and tool use.

## Features

- **Bring-your-own-key** — add your API key in Settings; it is stored only in your browser's `localStorage` and sent only to the provider's API.
- **Multiple providers** — Groq, OpenAI, Anthropic, Google Gemini, Ollama (local), or any custom OpenAI-compatible endpoint.
- **Chat sessions** — create, rename, delete, and switch between conversations from the sidebar (drawer on mobile, panel on desktop). Everything persists across reloads.
- **Model picker** — pick the best model for the job; capability chips show what each model supports (vision, audio, tools, and more).
- **Streaming responses** with markdown rendering and syntax-highlighted code blocks.
- **Attachments** — image and audio uploads, plus voice recording, tucked into the composer's "+" menu.
- **Auto-tools** — the model can use tools for up-to-date answers.
- **Fully responsive** — works on desktop and mobile; no horizontal scrolling.

## Quick start

No build step, no dependencies, no install.

```bash
python3 -m http.server 8899
```

Then open <http://localhost:8899/>, open Settings, paste your API key, and start chatting.

## How it works

- `index.html` — app shell
- `js/` — vanilla JavaScript modules:
  - `config.js` — UI metadata and settings keys
  - `catalog.js` — providers, models, and capabilities (`models-catalog.json`)
  - `state.js` — sessions, messages, settings, and persistence
  - `api.js` — provider API calls (streaming, vision, audio, tools)
  - `components/` — UI components (sidebar, composer, chat, header, model picker, settings, voice recorder)
- `css/` — styles
- `models-catalog.json` — the provider/model catalog, fetched at runtime

## Security note

This app has **no backend**. Your API key is stored in your browser's `localStorage` and sent only to the API provider you chose — it is never uploaded anywhere else. Keys are never hardcoded in the source.

## License

All rights reserved. The code is public for reference; reuse and redistribution are not licensed.
