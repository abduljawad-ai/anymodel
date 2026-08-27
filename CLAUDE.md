# Relay - Project Instructions

## Overview
Relay is a bring-your-own-key AI chatbot interface. Users plug in their own API keys for various AI providers (OpenAI, Anthropic, Google, etc.) and chat directly from the browser with no server middleman.

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Framework | React | 18.x |
| State Management | Zustand | 4.x |
| Build Tool | Vite | 5.x |
| Testing | Vitest | 2.x |
| Styling | CSS (vanilla) | - |

## Project Structure
```
src/
  adapters/    Provider adapters (OpenAI, Anthropic, Google, compatible)
  vault/       WebCrypto encryption + zustand key store
  catalog/     Live model discovery + capability heuristics
  state/       Sessions / UI / settings / stream registry (zustand)
  ui/          Design-system primitives (Button, Sheet, Dialog, Dropdown)
  features/    Shell, thread, composer, palette, providers, settings
  lib/         SSE parser, markdown, tokens, audio bus, toasts, net
  types/       Common TypeScript utility types
tests/         Test suites matching src structure
```

## Code Style
- **TypeScript**: Strict mode enabled, no unused locals
- **Components**: Functional components with hooks
- **State**: Zustand stores (sessionStore, uiStore, vaultStore)
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Files**: One component per file, named exports preferred

## Build & Run
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm test             # Run tests
npm run build        # Type-check + production build
```

## Testing
- **Framework**: Vitest with jsdom environment
- **Setup**: tests/setup.ts configures jest-dom matchers
- **Pattern**: *.test.ts(x) files co-located with source
- **Coverage**: Run with `npm run test -- --coverage`

## Key Patterns

### State Management
- **Zustand stores** for global state (sessions, UI, vault)
- **Local state** for component-specific concerns
- **Event-based communication** for cross-component updates

### Security
- **Encrypted vault**: AES-GCM-256 with PBKDF2-SHA256 (310k iterations)
- **Passphrase**: Lives only in memory, never persisted
- **Markdown**: DOMPurify sanitization with rel="noreferrer" on all links
- **Base URLs**: HTTPS required except localhost

### Streaming
- **SSE parsing**: Custom incremental parser in lib/sse.ts
- **Abort support**: Every request supports cancellation
- **Retry logic**: Retry-After-aware backoff on 429/503

## Common Tasks

### Adding a New Provider
1. Add provider metadata to `src/catalog/providers.ts`
2. Create adapter in `src/adapters/` if different wire format
3. Update factory in `src/adapters/factory.ts`
4. Add tests for the new adapter

### Adding a New UI Component
1. Create component in `src/ui/`
2. Export from `src/ui/index.ts`
3. Follow existing patterns (forwardRef, proper aria attributes)
4. Add to CLAUDE.md if it's a reusable primitive

### Modifying State
1. Identify which store owns the state
2. Update store interface and implementation
3. Update any consuming components
4. Add tests for new state logic

## Conventions
- **Commits**: Conventional commits preferred
- **PRs**: One logical change per PR
- **Error handling**: Use toast for user-facing errors
- **Logging**: Use logger utility from lib/logger.ts

## Architecture Notes
- **No server**: All API calls made directly from browser
- **Provider adapters**: Abstract wire format differences
- **Memory compaction**: Automatic context management for long chats
- **Lazy loading**: Settings and Palette loaded on demand
