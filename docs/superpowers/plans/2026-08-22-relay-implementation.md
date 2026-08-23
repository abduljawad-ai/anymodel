# Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Relay — a zero-backend, bring-your-own-key AI chat SPA whose hero interaction is swapping models mid-conversation, per the approved spec (`docs/superpowers/specs/2026-08-22-relay-design.md`).

**Architecture:** Vite + React 18 + TypeScript SPA. Browser talks directly to provider APIs over SSE streaming through one `ProviderAdapter` contract with four wire-format implementations (OpenAI, Anthropic, Google, OpenAI-compatible). AES-GCM encrypted key vault, zustand stores, localStorage persistence. No router — view switching via uiStore.

**Tech Stack:** react@18, zustand@4, marked@14, dompurify@3, vite@5, typescript@5, vitest@2 + @testing-library/react.

## Global Constraints

- Zero backend. Plaintext API keys exist only in memory; never logged, never exported.
- localStorage keys exactly: `relay.sessions.v1`, `relay.vault.v1`, `relay.settings.v1`.
- Crypto: AES-GCM-256; PBKDF2-SHA256 **310000** iterations; salt = random 16 bytes; IV = random 12 bytes, per encryption.
- Auto-lock default **15** minutes idle.
- Custom base URLs must be https, except localhost / 127.0.0.1 which may be http.
- Providers: ids exactly `openai | anthropic | google | compatible`.
- Palette colors: paper `#FAF6EF`, ink `#191714`, hairline `#E5DED2`, espresso `#14120F`, cream `#F3EDE2`, accent `#E4572E`. Radii 8px. Motion `cubic-bezier(.2,.9,.25,1)`, disabled under prefers-reduced-motion. Fonts: Space Grotesk (UI), JetBrains Mono (mono).
- Coverage ≥80% lines for `src/lib/`, `src/adapters/`, `src/vault/`.
- Markdown rendered via marked + DOMPurify; links restricted to http(s).

## File Structure

```
index.html                          fonts, #root
package.json / tsconfig.json / vite.config.ts / .gitignore
tests/setup.ts                      jest-dom matchers
src/main.tsx                        theme boot + render
src/App.tsx                         shell composition + view switch + global keys
src/styles/tokens.css               design tokens light/dark
src/styles/app.css                  layout + components
src/lib/id.ts                       uid()
src/lib/tokens.ts                   estimateTokens(), estimateTurnTokens()
src/lib/math.ts                     cosineSimilarity()
src/lib/dataurl.ts                  parseDataUrl()
src/lib/sse.ts                      SSEFrameParser, readSSE, streamFromStrings
src/lib/markdown.ts                 renderMarkdown(), sanitizeConfig
src/lib/toast.ts                    toast bus (subscribe/emit)
src/vault/crypto.ts                 encryptJson, decryptJson, VaultBlob, PBKDF2_ITERATIONS
src/vault/vaultStore.ts             zustand vault (createVault/unlock/lock/setKey/removeKey/auto-lock)
src/catalog/types.ts                ProviderId, Capability, ModelInfo, ProviderMeta
src/catalog/providers.ts            PROVIDERS meta + tints + defaultBase
src/catalog/starter.ts              STARTER_MODELS curated lists
src/catalog/normalize.ts            normalizeModel()
src/catalog/index.ts                listModels, getModel, refreshProviderModels, pickDefaultModel
src/adapters/types.ts               ChatMessage, ChatRequest, StreamSignals, ApiError, ProviderAdapter, AdapterDeps
src/adapters/http.ts                assertOk, humanize, dataUrlParts
src/adapters/openai.ts              OpenAIAdapter
src/adapters/anthropic.ts           AnthropicAdapter
src/adapters/google.ts              GoogleAdapter
src/adapters/compatible.ts          CompatibleAdapter (extends OpenAIAdapter)
src/adapters/factory.ts             createAdapter()
src/state/settings.ts              loadSettings/saveSettings (theme, autoLockMin, bases, lastModel)
src/state/uiStore.ts               zustand UI (theme, view, overlays, activeModel, compareModels)
src/state/streamRegistry.ts        start/stop/active AbortControllers
src/state/sessionStore.ts          zustand sessions CRUD + turns + persistence + export/import
src/features/shell/Rail.tsx        sessions sidebar
src/features/shell/TopBar.tsx      view tabs, theme, lock, settings buttons
src/features/shell/Wizard.tsx      first-run vault wizard
src/features/shell/ToastStack.tsx
src/features/thread/ThreadView.tsx empty state + BatonTrail + MessageBubble list
src/features/thread/MessageBubble.tsx badges, markdown, images, error card, handoff, TTS chip
src/features/thread/BatonTrail.tsx
src/features/thread/useSend.ts     THE send orchestration hook
src/features/composer/Composer.tsx textarea autosize, image attach/paste, mic, dial, send/stop
src/features/composer/ImageAttach.tsx
src/features/composer/MicRecorder.tsx
src/features/composer/ModelDial.tsx
src/features/palette/Palette.tsx   ⌘K cross-provider switcher
src/features/settings/SettingsSheet.tsx keys, bases, autolock, theme, DataPort
src/features/settings/DataPort.tsx export/import JSON, thread → MD
src/features/compare/CompareView.tsx columns fan-out + promote
src/features/lab/LabView.tsx       embeddings bench + moderation bench
src/lib/audioBus.ts                single-audio playback rule
tests/**/*.test.ts(x)              co-located under tests/ mirroring src/
```

---

### Task 1: Scaffold + tooling

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `tests/setup.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/app.css` (empty stubs ok).

**Interfaces (Produces):** runnable `npm run dev/build/test`; `<App/>` renders `[data-testid="app-root"]`.

- [ ] **Step 1: Write config files**

```jsonc
// package.json
{
  "name": "relay",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "dompurify": "^3.1.6",
    "marked": "^14.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"]
}
```

```ts
// vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
```

```gitignore
# .gitignore
node_modules/
dist/
*.local
```

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Relay — One thread. Every model.</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```ts
// tests/setup.ts
import '@testing-library/jest-dom/vitest';
```

```tsx
// src/main.tsx (stub — replaced in Task 11)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```tsx
// src/App.tsx (stub — replaced in Task 11)
export default function App() {
  return <div data-testid="app-root">Relay</div>;
}
```

Create empty `src/styles/tokens.css` and `src/styles/app.css` (filled in Task 11).

- [ ] **Step 2: Install and verify**

Run: `npm install && npx vitest run` (no tests yet → "No test files found" is acceptable; then add smoke test below)

```tsx
// tests/app.smoke.test.tsx
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders app root', () => {
  render(<App />);
  expect(screen.getByTestId('app-root')).toBeInTheDocument();
});
```

Run: `npm test` → PASS. Run: `npm run build` → succeeds.
- [ ] **Step 3: Commit** `git add -A && git commit -m "chore: scaffold Vite+React+TS with vitest"`

### Task 2: lib primitives (id, tokens, math, dataurl)

**Files:** Create `src/lib/{id,tokens,math,dataurl}.ts`, `tests/lib/primitives.test.ts`

**Interfaces (Produces):**
- `uid(prefix?: string): string`
- `estimateTokens(text: string): number` · `estimateTurnTokens(t: { content: string; imageUrl?: string }): number`
- `cosineSimilarity(a: number[], b: number[]): number` (throws on length mismatch / zero vector → returns 0)
- `parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null`

- [ ] **Step 1: Failing tests**

```ts
// tests/lib/primitives.test.ts
import { uid } from '../../src/lib/id';
import { estimateTokens, estimateTurnTokens } from '../../src/lib/tokens';
import { cosineSimilarity } from '../../src/lib/math';
import { parseDataUrl } from '../../src/lib/dataurl';

test('uid is unique and keeps prefix', () => {
  const a = uid('t_'); const b = uid('t_');
  expect(a).not.toBe(b);
  expect(a.startsWith('t_')).toBe(true);
});

test('token estimates', () => {
  expect(estimateTokens('')).toBe(0);
  expect(estimateTokens('abcd')).toBe(1);
  expect(estimateTokens('a'.repeat(401))).toBe(100);
  expect(estimateTurnTokens({ content: '' })).toBe(0);
  expect(estimateTurnTokens({ content: '', imageUrl: 'data:image/png;base64,x' })).toBe(85);
});

test('cosine similarity', () => {
  expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  expect(() => cosineSimilarity([1], [1, 2])).toThrow();
  expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
});

test('parseDataUrl', () => {
  expect(parseDataUrl('data:image/jpeg;base64,QUJD')).toEqual({ mediaType: 'image/jpeg', base64: 'QUJD' });
  expect(parseDataUrl('https://example.com/x.png')).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/lib/primitives.test.ts` → FAIL (modules missing)
- [ ] **Step 3: Implement**

```ts
// src/lib/id.ts
export function uid(prefix = ''): string {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...rnd].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}${Date.now().toString(36)}-${hex}`;
}
```

```ts
// src/lib/tokens.ts
const IMAGE_TOKENS = 85;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}

export function estimateTurnTokens(t: { content: string; imageUrl?: string }): number {
  return estimateTokens(t.content) + (t.imageUrl ? IMAGE_TOKENS : 0);
}
```

```ts
// src/lib/math.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('length mismatch');
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}
```

```ts
// src/lib/dataurl.ts
export function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  return m ? { mediaType: m[1], base64: m[2] } : null;
}
```

- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** `feat: lib primitives (id, token estimate, cosine, dataurl)`

### Task 3: SSE parser

**Files:** Create `src/lib/sse.ts`, `tests/lib/sse.test.ts`

**Interfaces (Produces):**
- `interface SSEEvent { event?: string; data: string }`
- `class SSEFrameParser { push(line: string): SSEEvent | null; flush(): SSEEvent | null }`
- `readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent>`
- `streamFromStrings(chunks: string[]): ReadableStream<Uint8Array>` (test/mock helper)

Rules: dispatch frame on blank line; multi-line `data:` joined with `\n`; `event:` field captured; comments (`:` prefix) ignored; CRLF tolerated; trailing unterminated frame flushed at EOF.

- [ ] **Step 1: Failing tests**

```ts
// tests/lib/sse.test.ts
import { readSSE, SSEFrameParser, streamFromStrings } from '../../src/lib/sse';

async function collect(chunks: string[]) {
  const out = [] as Array<{ event?: string; data: string }>;
  for await (const ev of readSSE(streamFromStrings(chunks))) out.push(ev);
  return out;
}

test('parser frames on blank line and joins multiline data', () => {
  const p = new SSEFrameParser();
  expect(p.push('event: foo')).toBeNull();
  expect(p.push('data: line1')).toBeNull();
  expect(p.push('data: line2')).toBeNull();
  expect(p.push('')).toEqual({ event: 'foo', data: 'line1\nline2' });
});

test('ignores comments, tolerates CRLF, buffers split chunks', async () => {
  const out = await collect([': ping\r\n', 'data: {"a":1}\r\n\r', '\ndata: hel', 'lo\n\n']);
  expect(out).toEqual([{ data: '{"a":1}' }, { data: 'hello' }]);
});

test('flushes pending frame at EOF without blank line', async () => {
  expect(await collect(['data: tail'])).toEqual([{ data: 'tail' }]);
});
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/sse.ts
export interface SSEEvent { event?: string; data: string }

export class SSEFrameParser {
  private eventName?: string;
  private dataLines: string[] = [];

  push(line: string): SSEEvent | null {
    if (line === '') return this.flush();
    if (line.startsWith(':')) return null;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.eventName = value;
    else if (field === 'data') this.dataLines.push(value);
    return null;
  }

  flush(): SSEEvent | null {
    if (this.dataLines.length === 0) { this.eventName = undefined; return null; }
    const ev: SSEEvent = { data: this.dataLines.join('\n') };
    if (this.eventName) ev.event = this.eventName;
    this.eventName = undefined;
    this.dataLines = [];
    return ev;
  }
}

export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEFrameParser();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const raw = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const ev = parser.push(raw.endsWith('\r') ? raw.slice(0, -1) : raw);
        if (ev) yield ev;
      }
    }
    const tailRaw = buf.endsWith('\r') ? buf.slice(0, -1) : buf;
    const tail = tailRaw ? parser.push(tailRaw) : parser.flush();
    if (tail) yield tail;
    else { const flushed = parser.flush(); if (flushed) yield flushed; }
  } finally {
    reader.releaseLock();
  }
}

export function streamFromStrings(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(encoder.encode(ch)); c.close(); },
  });
}
```

- [ ] **Step 4: Run** `npm test` → PASS · **Step 5: Commit** `feat: SSE frame parser`

### Task 4: Sanitized markdown renderer

**Files:** Create `src/lib/markdown.ts`, `tests/lib/markdown.test.ts`

**Interfaces (Produces):** `renderMarkdown(src: string): string` — marked GFM output sanitized by DOMPurify; only `http:`/`https:` links survive; code blocks preserved.

- [ ] **Step 1: Failing tests**

```ts
// tests/lib/markdown.test.ts
import { renderMarkdown } from '../../src/lib/markdown';

test('renders basic markdown', () => {
  const html = renderMarkdown('# Hi\n\n**bold**');
  expect(html).toContain('<h1>');
  expect(html).toContain('<strong>bold</strong>');
});

test('strips scripts and dangerous protocols', () => {
  expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script');
  const link = renderMarkdown('[x](javascript:alert(1))');
  expect(link).not.toContain('javascript:');
  const ok = renderMarkdown('[y](https://a.dev)');
  expect(ok).toContain('href="https://a.dev"');
});

test('keeps code blocks and escapes html inside them', () => {
  const html = renderMarkdown('```\n<img src=x onerror=alert(1)>\n```');
  expect(html).toContain('&lt;img');
});
```

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/lib/markdown.ts
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(src: string): string {
  const raw = marked.parse(src ?? '', { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
    ADD_ATTR: ['target'],
  });
}
```

- [ ] **Step 4: Run** `npm test` → PASS · **Step 5: Commit** `feat: sanitized markdown pipeline`

### Task 5: Vault crypto

**Files:** Create `src/vault/crypto.ts`, `tests/vault/crypto.test.ts`

**Interfaces (Produces):**
- `PBKDF2_ITERATIONS = 310000`
- `interface VaultBlob { v: 1; iterations: number; salt: string; iv: string; data: string }` (fields base64)
- `encryptJson(obj: unknown, pass: string, iterations?): Promise<VaultBlob>`
- `decryptJson<T>(blob: VaultBlob, pass: string): Promise<T>` — rejects with `Error('WRONG_PASSPHRASE')` on auth failure

- [ ] **Step 1: Failing tests**

```ts
// tests/vault/crypto.test.ts
import { decryptJson, encryptJson, PBKDF2_ITERATIONS } from '../../src/vault/crypto';

test('roundtrips a secrets object', async () => {
  const blob = await encryptJson({ openai: 'sk-test' }, 'hunter2');
  expect(blob.iterations).toBe(PBKDF2_ITERATIONS);
  const out = await decryptJson<{ openai: string }>(blob, 'hunter2');
  expect(out.openai).toBe('sk-test');
});

test('wrong passphrase rejects', async () => {
  const blob = await encryptJson({ a: 1 }, 'right');
  await expect(decryptJson(blob, 'wrong')).rejects.toThrow('WRONG_PASSPHRASE');
});

test('unique salt and iv per encryption', async () => {
  const a = await encryptJson({ x: 1 }, 'p');
  const b = await encryptJson({ x: 1 }, 'p');
  expect(a.salt).not.toBe(b.salt);
  expect(a.iv).not.toBe(b.iv);
  expect(a.data).not.toBe(b.data);
});
```

Note: PBKDF2 at 310k iterations × several tests is slow (~seconds). Acceptable; do not lower iterations in product code.

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/vault/crypto.ts
const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 310_000;

export interface VaultBlob {
  v: 1;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(pass: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(obj: unknown, pass: string, iterations = PBKDF2_ITERATIONS): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, iterations, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

export async function decryptJson<T>(blob: VaultBlob, pass: string): Promise<T> {
  const key = await deriveKey(pass, fromB64(blob.salt), blob.iterations);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new Error('WRONG_PASSPHRASE');
  }
}
```

(TS may require `salt as BufferSource` casts depending on version — add if compiler asks.)
- [ ] **Step 4: Run** `npm test` → PASS · **Step 5: Commit** `feat: AES-GCM vault crypto`
### Task 6: Vault store

**Files:** Create `src/vault/vaultStore.ts`, `tests/vault/vaultStore.test.ts`

**Interfaces (Consumes):** `encryptJson/decryptJson/VaultBlob` (Task 5), `ProviderId` from `../catalog/types`.
**Interfaces (Produces):** zustand `useVaultStore` — state `{ status:'empty'|'locked'|'unlocked', keys: Partial<Record<ProviderId,string>>, lastActivity:number }`; actions `init(), createVault(pass), unlock(pass):Promise<boolean>, lock(), setKey(p,key), removeKey(p), hasAnyKey(), touch()`. Passphrase lives in a module-scoped ref only; blob persisted at `relay.vault.v1`; mutations re-encrypt the whole keys object; `setKey/removeKey` no-op unless unlocked.

- [ ] **Step 1: Failing tests**

```ts
// tests/vault/vaultStore.test.ts
import { useVaultStore } from '../../src/vault/vaultStore';

const s = () => useVaultStore.getState();

test('vault lifecycle', async () => {
  localStorage.clear();
  s().init();
  expect(s().status).toBe('empty');
  await s().createVault('pass123');
  expect(s().status).toBe('unlocked');
  await s().setKey('openai', 'sk-test-1');
  expect(s().keys.openai).toBe('sk-test-1');
  const raw = localStorage.getItem('relay.vault.v1')!;
  expect(raw).not.toContain('sk-test-1'); // encrypted at rest
  s().lock();
  expect(s().status).toBe('locked');
  expect(s().keys).toEqual({});
  expect(await s().unlock('nope')).toBe(false);
  expect(s().status).toBe('locked');
  expect(await s().unlock('pass123')).toBe(true);
  expect(s().keys.openai).toBe('sk-test-1');
});

test('setKey requires unlock', async () => {
  localStorage.clear();
  s().init();
  await s().createVault('p');
  s().lock();
  await s().setKey('google', 'gk');
  expect(s().keys.google).toBeUndefined();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/vault/vaultStore.test.ts` → FAIL

- [ ] **Step 3: Implement**

```ts
// src/vault/vaultStore.ts
import { create } from 'zustand';
import { decryptJson, encryptJson, type VaultBlob } from './crypto';
import type { ProviderId } from '../catalog/types';

const LS_VAULT = 'relay.vault.v1';
type Keys = Partial<Record<ProviderId, string>>;

interface VaultState {
  status: 'empty' | 'locked' | 'unlocked';
  keys: Keys;
  lastActivity: number;
  init(): void;
  createVault(pass: string): Promise<void>;
  unlock(pass: string): Promise<boolean>;
  lock(): void;
  setKey(p: ProviderId, key: string): Promise<void>;
  removeKey(p: ProviderId): Promise<void>;
  hasAnyKey(): boolean;
  touch(): void;
}

let passRef: string | null = null; // memory only, never persisted

async function persist(keys: Keys): Promise<void> {
  if (!passRef) return;
  const blob = await encryptJson(keys, passRef);
  localStorage.setItem(LS_VAULT, JSON.stringify(blob));
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'empty',
  keys: {},
  lastActivity: Date.now(),
  init() {
    passRef = null;
    const raw = localStorage.getItem(LS_VAULT);
    set({ status: raw ? 'locked' : 'empty', keys: {} });
  },
  async createVault(pass) {
    passRef = pass;
    await persist(get().keys);
    set({ status: 'unlocked', lastActivity: Date.now() });
  },
  async unlock(pass) {
    const raw = localStorage.getItem(LS_VAULT);
    if (!raw) return false;
    try {
      const blob = JSON.parse(raw) as VaultBlob;
      const keys = await decryptJson<Keys>(blob, pass);
      passRef = pass;
      set({ keys, status: 'unlocked', lastActivity: Date.now() });
      return true;
    } catch {
      return false;
    }
  },
  lock() {
    passRef = null;
    set({ status: get().status === 'empty' ? 'empty' : 'locked', keys: {} });
  },
  async setKey(p, key) {
    if (get().status !== 'unlocked' || !key.trim()) return;
    const keys = { ...get().keys, [p]: key.trim() };
    await persist(keys);
    set({ keys });
  },
  async removeKey(p) {
    if (get().status !== 'unlocked') return;
    const keys = { ...get().keys };
    delete keys[p];
    await persist(keys);
    set({ keys });
  },
  hasAnyKey() { return Object.keys(get().keys).length > 0; },
  touch() { set({ lastActivity: Date.now() }); },
}));
```

- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: encrypted key vault store`
### Task 7: Model catalog

**Files:** Create `src/catalog/{types,providers,starter,normalize,index}.ts`, `tests/catalog/catalog.test.ts`

**Interfaces (Produces):** `ProviderId = 'openai'|'anthropic'|'google'|'compatible'`; `Capability = 'vision'|'stt'|'tts'|'reasoning'|'tools'`; `ModelInfo { id, providerId, label, caps }`; `PROVIDERS` meta (tints openai `#4E9B7F`, anthropic `#C96F4A`, google `#6E8EF7`, compatible `#8A94A0`; defaultBase per spec §4); `STARTER_MODELS` (openai: gpt-4o, gpt-4o-mini, o3-mini(reasoning), whisper-1(stt), tts-1(tts), text-embedding-3-small; anthropic: claude-sonnet-4, claude-3-5-haiku; google: gemini-2.0-flash, gemini-1.5-pro); `normalizeModel(pid,id)` regex heuristics; `listModels/getModel/pickDefaultModel/refreshProviderModels` (live ids merge after starters, dedupe by id, fetch failure keeps starters).

- [ ] **Step 1: Failing tests**

```ts
// tests/catalog/catalog.test.ts
import { getModel, listModels, pickDefaultModel, refreshProviderModels } from '../../src/catalog';
import { normalizeModel } from '../../src/catalog/normalize';
import { PROVIDERS } from '../../src/catalog/providers';

test('starter lists expose key capabilities', () => {
  const openai = listModels('openai');
  expect(openai.find((m) => m.id === 'whisper-1')!.caps).toContain('stt');
  expect(openai.find((m) => m.id === 'tts-1')!.caps).toContain('tts');
  expect(listModels('anthropic').some((m) => m.id.startsWith('claude'))).toBe(true);
  expect(PROVIDERS.compatible.defaultBase).toMatch(/^http:\/\/localhost/);
});

test('normalizeModel heuristic caps', () => {
  expect(normalizeModel('compatible', 'llava:13b').caps).toContain('vision');
  expect(normalizeModel('compatible', 'qwen2.5-coder').caps).toEqual([]);
});

test('refresh merges live ids without duplicating starters, survives failure', async () => {
  const merged = await refreshProviderModels('openai', async () => ['gpt-4o', 'gpt-x-future']);
  expect(merged.filter((m) => m.id === 'gpt-4o')).toHaveLength(1);
  expect(merged.find((m) => m.id === 'gpt-x-future')).toBeDefined();
  expect(merged.find((m) => m.id === 'whisper-1')).toBeDefined();
  const again = await refreshProviderModels('openai', async () => { throw new Error('down'); });
  expect(again.length).toBeGreaterThan(0);
});

test('pickDefaultModel avoids stt/tts/embedding models', () => {
  expect(pickDefaultModel('openai')!.id).not.toMatch(/whisper|tts|embed/i);
  expect(getModel('openai', 'gpt-4o')).toBeDefined();
});
```

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/catalog/types.ts
export type ProviderId = 'openai' | 'anthropic' | 'google' | 'compatible';
export type Capability = 'vision' | 'stt' | 'tts' | 'reasoning' | 'tools';
export interface ModelInfo { id: string; providerId: ProviderId; label: string; caps: Capability[] }
export interface ProviderMeta { id: ProviderId; name: string; kind: 'openai' | 'anthropic' | 'google' | 'compatible'; tint: string; defaultBase: string }
```

```ts
// src/catalog/providers.ts
import type { ProviderId, ProviderMeta } from './types';
export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai:     { id: 'openai',     name: 'OpenAI',            kind: 'openai',     tint: '#4E9B7F', defaultBase: 'https://api.openai.com/v1' },
  anthropic:  { id: 'anthropic',  name: 'Anthropic',         kind: 'anthropic',  tint: '#C96F4A', defaultBase: 'https://api.anthropic.com/v1' },
  google:     { id: 'google',     name: 'Google',            kind: 'google',     tint: '#6E8EF7', defaultBase: 'https://generativelanguage.googleapis.com/v1beta' },
  compatible: { id: 'compatible', name: 'OpenAI-compatible', kind: 'compatible', tint: '#8A94A0', defaultBase: 'http://localhost:11434/v1' },
};
```

```ts
// src/catalog/starter.ts
import type { ModelInfo, ProviderId } from './types';
const m = (providerId: ProviderId, id: string, label: string, ...caps: ModelInfo['caps']): ModelInfo =>
  ({ id, providerId, label, caps });
export const STARTER_MODELS: ModelInfo[] = [
  m('openai', 'gpt-4o', 'GPT-4o', 'vision', 'tools'),
  m('openai', 'gpt-4o-mini', 'GPT-4o mini', 'vision', 'tools'),
  m('openai', 'o3-mini', 'o3-mini', 'reasoning'),
  m('openai', 'whisper-1', 'Whisper STT', 'stt'),
  m('openai', 'tts-1', 'TTS voice', 'tts'),
  m('openai', 'text-embedding-3-small', 'Embeddings small'),
  m('anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 'vision', 'tools', 'reasoning'),
  m('anthropic', 'claude-3-5-haiku-20241022', 'Claude Haiku 3.5', 'vision', 'tools'),
  m('google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 'vision', 'tools'),
  m('google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'vision', 'reasoning'),
];
```

```ts
// src/catalog/normalize.ts
import type { Capability, ModelInfo, ProviderId } from './types';
const PATTERNS: Array<[Capability, RegExp]> = [
  ['stt', /whisper|transcri|asr|\bstt\b/i],
  ['tts', /\btts\b|speech|speak|voice/i],
  ['reasoning', /(^|[^a-z])o[13]([^0-9]|$)|-r1|reason|think/i],
  ['vision', /gpt-4o|vision|claude-[3-9]|gemini|vl|llava|multimodal/i],
  ['tools', /function|tool|gpt-4o|claude|gemini/i],
];
export function prettify(id: string): string {
  return id.replace(/[-_:]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export function normalizeModel(providerId: ProviderId, id: string): ModelInfo {
  return { id, providerId, label: prettify(id), caps: PATTERNS.filter(([, re]) => re.test(id)).map(([c]) => c) };
}
```

```ts
// src/catalog/index.ts
import type { ModelInfo, ProviderId } from './types';
import { STARTER_MODELS } from './starter';
import { normalizeModel } from './normalize';

const liveByProvider = new Map<ProviderId, ModelInfo[]>();

export function listModels(providerId: ProviderId): ModelInfo[] {
  const live = liveByProvider.get(providerId) ?? [];
  const seen = new Set(live.map((m) => m.id));
  return [...STARTER_MODELS.filter((m) => m.providerId === providerId && !seen.has(m.id)), ...live];
}
export function getModel(providerId: ProviderId, modelId: string): ModelInfo | undefined {
  return listModels(providerId).find((m) => m.id === modelId);
}
export function isChatCapable(m: ModelInfo): boolean {
  return !m.caps.includes('stt') && !m.caps.includes('tts') && !/embed/i.test(m.id);
}
export function pickDefaultModel(providerId: ProviderId): ModelInfo | undefined {
  return listModels(providerId).find(isChatCapable);
}
export async function refreshProviderModels(providerId: ProviderId, fetchIds: () => Promise<string[]>): Promise<ModelInfo[]> {
  try {
    liveByProvider.set(providerId, (await fetchIds()).map((id) => normalizeModel(providerId, id)));
  } catch { /* keep previous */ }
  return listModels(providerId);
}
```

- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: provider/model catalog`
### Task 8: Adapter contract + OpenAI adapter

**Files:** Create `src/adapters/{types,http,openai}.ts`, `tests/adapters/openai.test.ts`

**Interfaces (Produces):**

```ts
// types.ts
export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string; imageUrl?: string }
export interface ChatRequest { model: string; messages: ChatMessage[]; maxTokens?: number }
export interface StreamSignals { onDelta(text: string): void; onDone(): void; signal: AbortSignal }
export interface ModerationResult { flagged: boolean; categories: Record<string, boolean> }
export interface ConnectionResult { ok: boolean; detail: string }
export interface AdapterDeps { baseUrl: string; apiKey: () => string | undefined }
export interface ProviderAdapter {
  streamChat(req: ChatRequest, signals: StreamSignals): Promise<void>;
  transcribe(audio: Blob, modelId: string): Promise<string>;
  speak(text: string, modelId: string): Promise<Blob>;
  embed(inputs: string[], modelId: string): Promise<number[][]>;
  moderate(input: string, modelId: string): Promise<ModerationResult>;
  testConnection(): Promise<ConnectionResult>;
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}
```

`http.ts`: `assertOk(res)` throws `ApiError(status, humanize(...))`; `humanize(status, detail)` copy — 401 → "Key rejected. Check it in Settings → Keys." (+detail), 429 → "Rate limited — wait a moment and retry.", 404/403/5xx/default per spec §6.

OpenAI wire format: POST `{base}/chat/completions`, header `Authorization: Bearer <key>`, body `{model, messages, max_tokens, stream:true}`; user turns with `imageUrl` map to `content:[{type:'text',text},{type:'image_url',image_url:{url}}]`; stream parsed with `readSSE`, `[DONE]` terminates, deltas from `choices[0].delta.content`. transcribe: FormData(file,model) → `/audio/transcriptions`. speak: JSON `{model,input,voice:'alloy',response_format:'mp3'}` → `/audio/speech` → `res.blob()`. embed: `/embeddings` → `data[].embedding`. moderate: `/moderations` → `results[0]`. testConnection: GET `/models`.

- [ ] **Step 1: Failing tests**

```ts
// tests/adapters/openai.test.ts
import { OpenAIAdapter } from '../../src/adapters/openai';
import { streamFromStrings } from '../../src/lib/sse';

const adapter = new OpenAIAdapter({ baseUrl: 'https://api.openai.test/v1', apiKey: () => 'sk-k' });

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
    handler(String(url), init)) as unknown as ReturnType<typeof vi.spyOn>;
}

test('streamChat emits deltas then done', async () => {
  const fm = mockFetch(() => new Response(
    streamFromStrings([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ]) as unknown as ReadableStream<Uint8Array>,
    { status: 200 },
  ));
  const deltas: string[] = []; let done = false;
  await adapter.streamChat(
    { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    { onDelta: (d) => deltas.push(d), onDone: () => { done = true; }, signal: new AbortController().signal },
  );
  expect(deltas.join('')).toBe('Hello');
  expect(done).toBe(true);
  expect(JSON.parse(String(fm.mock.calls[0][1]!.body)).messages[0].content).toBe('hi');
  fm.mockRestore();
});

test('streamChat maps image turns to content parts', async () => {
  const fm = mockFetch(() => new Response(streamFromStrings(['data: [DONE]\n\n']) as unknown as ReadableStream<Uint8Array>, { status: 200 }));
  await adapter.streamChat(
    { model: 'gpt-4o', messages: [{ role: 'user', content: 'look', imageUrl: 'data:image/png;base64,QUJD' }] },
    { onDelta: () => {}, onDone: () => {}, signal: new AbortController().signal },
  );
  const body = JSON.parse(String(fm.mock.calls[0][1]!.body));
  expect(body.messages[0].content[0]).toEqual({ type: 'text', text: 'look' });
  expect(body.messages[0].content[1].image_url.url).toContain('base64,QUJD');
  fm.mockRestore();
});

test('401 becomes humanized ApiError', async () => {
  const fm = mockFetch(() => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }));
  await expect(adapter.streamChat(
    { model: 'gpt-4o', messages: [] },
    { onDelta: () => {}, onDone: () => {}, signal: new AbortController().signal },
  )).rejects.toMatchObject({ name: 'ApiError', status: 401 });
  fm.mockRestore();
});

test('transcribe posts FormData and returns text', async () => {
  const fm = mockFetch((url, init) => {
    expect(url).toBe('https://api.openai.test/v1/audio/transcriptions');
    expect((init!.body as FormData).get('model')).toBe('whisper-1');
    return new Response(JSON.stringify({ text: 'hello world' }), { status: 200 });
  });
  expect(await adapter.transcribe(new File(['x'], 'a.webm', { type: 'audio/webm' }), 'whisper-1')).toBe('hello world');
  fm.mockRestore();
});

test('embed + moderate + testConnection shapes', async () => {
  const fm = mockFetch((url) => {
    if (String(url).endsWith('/embeddings'))
      return new Response(JSON.stringify({ data: [{ embedding: [1, 0] }, { embedding: [0, 1] }] }), { status: 200 });
    if (String(url).endsWith('/moderations'))
      return new Response(JSON.stringify({ results: [{ flagged: true, categories: { hate: true } }] }), { status: 200 });
    return new Response(JSON.stringify({ data: [] }), { status: 200 }); // /models
  });
  expect(await adapter.embed(['a', 'b'], 'text-embedding-3-small')).toEqual([[1, 0], [0, 1]]);
  expect((await adapter.moderate('x', '')).flagged).toBe(true);
  expect((await adapter.testConnection()).ok).toBe(true);
  fm.mockRestore();
});
```

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/adapters/http.ts
import { ApiError } from './types';

export function humanize(status: number, detail: string): string {
  switch (status) {
    case 401: return `Key rejected — check it in Settings → Keys. ${detail}`;
    case 403: return `Forbidden — your key may lack access here. ${detail}`;
    case 404: return `Endpoint or model not found. ${detail}`;
    case 429: return 'Rate limited — wait a moment and retry.';
    case 500: case 502: case 503: return `Provider server error (${status}) — retry shortly.`;
    default: return `Request failed (${status}). ${detail}`;
  }
}

export async function assertOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message ?? String(JSON.stringify(j)).slice(0, 160);
  } catch { detail = res.statusText || ''; }
  throw new ApiError(res.status, humanize(res.status, detail.trim()));
}
```

```ts
// src/adapters/openai.ts
import { readSSE } from '../lib/sse';
import type { AdapterDeps, ChatRequest, ConnectionResult, ModerationResult, ProviderAdapter, StreamSignals } from './types';
import { assertOk } from './http';

export class OpenAIAdapter implements ProviderAdapter {
  constructor(protected deps: AdapterDeps) {}
  protected get base(): string { return this.deps.baseUrl.replace(/\/+$/, ''); }
  protected headers(json = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    const k = this.deps.apiKey();
    if (k) h.Authorization = `Bearer ${k}`;
    return h;
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const messages = req.messages.map((m) =>
      m.imageUrl && m.role === 'user'
        ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: m.imageUrl } }] }
        : { role: m.role, content: m.content },
    );
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: req.model, messages, max_tokens: req.maxTokens ?? 2048, stream: true }),
      signal: signals.signal,
    });
    await assertOk(res);
    for await (const ev of readSSE(res.body!)) {
      if (ev.data === '[DONE]') break;
      try {
        const delta = JSON.parse(ev.data)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) signals.onDelta(delta);
      } catch { /* skip malformed frame */ }
    }
    signals.onDone();
  }

  async transcribe(audio: Blob, modelId: string): Promise<string> {
    const form = new FormData();
    form.append('file', audio, 'audio.webm');
    form.append('model', modelId || 'whisper-1');
    const res = await fetch(`${this.base}/audio/transcriptions`, { method: 'POST', headers: this.headers(false), body: form });
    await assertOk(res);
    return (await res.json()).text as string;
  }

  async speak(text: string, modelId: string): Promise<Blob> {
    const res = await fetch(`${this.base}/audio/speech`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: modelId || 'tts-1', input: text, voice: 'alloy', response_format: 'mp3' }),
    });
    await assertOk(res);
    return res.blob();
  }

  async embed(inputs: string[], modelId: string): Promise<number[][]> {
    const res = await fetch(`${this.base}/embeddings`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model: modelId || 'text-embedding-3-small', input: inputs }),
    });
    await assertOk(res);
    return ((await res.json()).data as Array<{ embedding: number[] }>).map((d) => d.embedding);
  }

  async moderate(input: string, _modelId: string): Promise<ModerationResult> {
    void _modelId;
    const res = await fetch(`${this.base}/moderations`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ input }) });
    await assertOk(res);
    const r = ((await res.json()).results as ModerationResult[])[0];
    return { flagged: !!r?.flagged, categories: r?.categories ?? {} };
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const res = await fetch(`${this.base}/models`, { headers: this.headers(false) });
      await assertOk(res);
      return { ok: true, detail: 'connected' };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
  }
}
```

- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: provider adapter contract + OpenAI wire format`
### Task 9: Anthropic, Google, Compatible adapters + factory

**Files:** Create `src/adapters/{anthropic,google,compatible,factory}.ts`, `tests/adapters/{anthropic,google}.test.ts`

**Interfaces (Consumes):** `ProviderAdapter`, `ApiError`, `assertOk` (Task 8); `readSSE/streamFromStrings`; `parseDataUrl` (Task 2).
**Interfaces (Produces):** `createAdapter(providerId, deps): ProviderAdapter`.

Wire formats:
- **Anthropic:** POST `{base}/messages`; headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true` (required for direct browser calls). Body `{model, max_tokens, system?, messages:[{role:'user'|'assistant', content:[{type:'text',text}]}]}`; user image → `[{type:'text',...},{type:'image',source:{type:'base64',media_type,data}}]` (skip unsupported mime types). Stream events by `json.type`: `content_block_delta` → `onDelta(json.delta?.text)`, `message_stop` → done. system from leading `role:'system'` messages. transcribe/speak/embed/moderate → throw `new ApiError(501, 'Anthropic does not expose this endpoint.')`. testConnection: minimal non-stream `/messages` call.
- **Google:** POST `{base}/models/{model}:streamGenerateContent?alt=sse`; header `x-goog-api-key`. Body `{contents:[{role:'user'|'model', parts:[{text}|{inline_data:{mime_type,data}}]}], systemInstruction?:{parts:[{text}]}, generationConfig:{maxOutputTokens}}`; SSE data JSON → concat `candidates[0].content.parts[].text`. On 404 fallback: single POST `:generateContent`, emit full text as one delta. embed: `models/{model}:embedContent {content:{parts:[{text}]}}` → `.embedding.values`. transcribe/speak/moderate → ApiError(501). testConnection: GET `{base}/models`.
- **Compatible:** `class CompatibleAdapter extends OpenAIAdapter {}` — identical wire format; base/key come from deps.

```ts
// src/adapters/factory.ts
import type { ProviderId } from '../catalog/types';
import type { AdapterDeps, ProviderAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { CompatibleAdapter } from './compatible';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';

export function createAdapter(providerId: ProviderId, deps: AdapterDeps): ProviderAdapter {
  switch (providerId) {
    case 'anthropic': return new AnthropicAdapter(deps);
    case 'google': return new GoogleAdapter(deps);
    case 'compatible': return new CompatibleAdapter(deps);
    default: return new OpenAIAdapter(deps);
  }
}
```

- [ ] **Step 1: Failing tests** (mirror Task 8 style)

```ts
// tests/adapters/anthropic.test.ts
import { AnthropicAdapter } from '../../src/adapters/anthropic';
import { streamFromStrings } from '../../src/lib/sse';

const adapter = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.test/v1', apiKey: () => 'ak-k' });

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, i) => handler(String(u), i));
}

test('streams text deltas and sends anthropic headers', async () => {
  const fm = mockFetch(() => new Response(streamFromStrings([
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"He"}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ]) as unknown as ReadableStream<Uint8Array>, { status: 200 }));
  const deltas: string[] = []; let done = false;
  await adapter.streamChat(
    { model: 'claude-x', messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }] },
    { onDelta: (d) => deltas.push(d), onDone: () => { done = true; }, signal: new AbortController().signal },
  );
  expect(deltas.join('')).toBe('He');
  expect(done).toBe(true);
  const init = fm.mock.calls[0][1]!;
  expect(init.headers!['x-api-key']).toBe('ak-k');
  const body = JSON.parse(String(init.body));
  expect(body.system).toBe('be brief');
  expect(body.messages[0].content[0].text).toBe('hi');
  fm.mockRestore();
});

test('image turn maps to base64 source block', async () => {
  const fm = mockFetch(() => new Response(streamFromStrings(['event: message_stop\ndata: {"type":"message_stop"}\n\n']) as unknown as ReadableStream<Uint8Array>, { status: 200 }));
  await adapter.streamChat(
    { model: 'm', messages: [{ role: 'user', content: 'see', imageUrl: 'data:image/png;base64,QUJD' }] },
    { onDelta: () => {}, onDone: () => {}, signal: new AbortController().signal },
  );
  const body = JSON.parse(String(fm.mock.calls[0][1]!.body));
  expect(body.messages[0].content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } });
  fm.mockRestore();
});

test('aux endpoints are unsupported', async () => {
  await expect(adapter.speak('x', '')).rejects.toMatchObject({ status: 501 });
});
```

Google tests assert: url contains `:streamGenerateContent?alt=sse`, header `x-goog-api-key`, deltas concatenated across `parts`, and `embedContent` returns values. (Same mockFetch pattern.)

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/adapters/anthropic.ts
import { readSSE } from '../lib/sse';
import { parseDataUrl } from '../lib/dataurl';
import { assertOk } from './http';
import { ApiError, type ChatRequest, type ConnectionResult, type ModerationResult, type ProviderAdapter, type StreamSignals, type AdapterDeps } from './types';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export class AnthropicAdapter implements ProviderAdapter {
  constructor(private deps: AdapterDeps) {}
  private get base() { return this.deps.baseUrl.replace(/\/+$/, ''); }
  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { 'x-api-key': this.deps.apiKey() ?? '', 'anthropic-version': '2023-06-01' };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const messages = req.messages.filter((m) => m.role !== 'system').map((m) => {
      const content: Array<Record<string, unknown>> = [{ type: 'text', text: m.content }];
      if (m.imageUrl && m.role === 'user') {
        const p = parseDataUrl(m.imageUrl);
        if (p && IMAGE_MIME.has(p.mediaType)) content.push({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } });
      }
      return { role: m.role, content };
    });
    const res = await fetch(`${this.base}/messages`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model: req.model, max_tokens: req.maxTokens ?? 2048, ...(system ? { system } : {}), messages }),
      signal: signals.signal,
    });
    await assertOk(res);
    for await (const ev of readSSE(res.body!)) {
      try {
        const j = JSON.parse(ev.data);
        if (j.type === 'content_block_delta' && typeof j.delta?.text === 'string') signals.onDelta(j.delta.text);
        else if (j.type === 'message_stop') break;
        else if (j.type === 'error') throw new ApiError(500, j.error?.message ?? 'stream error');
      } catch (e) { if (e instanceof ApiError) throw e; }
    }
    signals.onDone();
  }

  private unsupported(op: string): never {
    throw new ApiError(501, `Anthropic does not expose ${op} — use an OpenAI or compatible provider.`);
  }
  transcribe(): Promise<string> { this.unsupported('transcription'); }
  speak(): Promise<Blob> { this.unsupported('speech'); }
  embed(): Promise<number[][]> { this.unsupported('embeddings'); }
  moderate(): Promise<ModerationResult> { this.unsupported('moderation'); }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const res = await fetch(`${this.base}/messages`, {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1, messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }] }),
      });
      await assertOk(res);
      return { ok: true, detail: 'connected' };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
  }
}
```

```ts
// src/adapters/google.ts
import { readSSE } from '../lib/sse';
import { parseDataUrl } from '../lib/dataurl';
import { assertOk } from './http';
import { ApiError, type AdapterDeps, type ChatRequest, type ConnectionResult, type ModerationResult, type ProviderAdapter, type StreamSignals } from './types';

export class GoogleAdapter implements ProviderAdapter {
  constructor(private deps: AdapterDeps) {}
  private get base() { return this.deps.baseUrl.replace(/\/+$/, ''); }
  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { 'x-goog-api-key': this.deps.apiKey() ?? '' };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  private toContents(req: ChatRequest) {
    const systemParts = req.messages.filter((m) => m.role === 'system').map((m) => ({ text: m.content }));
    const contents = req.messages.filter((m) => m.role !== 'system').map((m) => {
      const parts: Array<Record<string, unknown>> = [{ text: m.content }];
      if (m.imageUrl && m.role === 'user') {
        const p = parseDataUrl(m.imageUrl);
        if (p && p.mediaType.startsWith('image/')) parts.push({ inline_data: { mime_type: p.mediaType, data: p.base64 } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
    return { contents, systemInstruction: systemParts.length ? { parts: systemParts } : undefined };
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const { contents, systemInstruction } = this.toContents(req);
    const body = JSON.stringify({ contents, ...(systemInstruction ? { systemInstruction } : {}), generationConfig: { maxOutputTokens: req.maxTokens ?? 2048 } });
    let res: Response;
    try {
      res = await fetch(`${this.base}/models/${req.model}:streamGenerateContent?alt=sse`, { method: 'POST', headers: this.headers(), body, signal: signals.signal });
      await assertOk(res);
      for await (const ev of readSSE(res.body!)) {
        try {
          const parts = JSON.parse(ev.data)?.candidates?.[0]?.content?.parts as Array<{ text?: string }> | undefined;
          const text = (parts ?? []).map((p) => p.text ?? '').join('');
          if (text) signals.onDelta(text);
        } catch { /* skip malformed */ }
      }
      signals.onDone();
      return;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
    }
    // Non-stream fallback (single delta)
    const res2 = await fetch(`${this.base}/models/${req.model}:generateContent`, { method: 'POST', headers: this.headers(), body, signal: signals.signal });
    await assertOk(res2);
    const parts = ((await res2.json()).candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
    const text = parts.map((p) => p.text ?? '').join('');
    if (text) signals.onDelta(text);
    signals.onDone();
  }

  private unsupported(op: string): never {
    throw new ApiError(501, `Google does not expose ${op} via this endpoint.`);
  }
  transcribe(): Promise<string> { this.unsupported('transcription'); }
  speak(): Promise<Blob> { this.unsupported('speech'); }
  moderate(): Promise<ModerationResult> { this.unsupported('moderation'); }

  async embed(inputs: string[], modelId: string): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of inputs) {
      const res = await fetch(`${this.base}/models/${modelId || 'text-embedding-004'}:embedContent`, {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });
      await assertOk(res);
      out.push(((await res.json()).embedding as { values: number[] }).values);
    }
    return out;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const res = await fetch(`${this.base}/models`, { headers: this.headers(false) });
      await assertOk(res);
      return { ok: true, detail: 'connected' };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
  }
}
```

```ts
// src/adapters/compatible.ts
import { OpenAIAdapter } from './openai';
export class CompatibleAdapter extends OpenAIAdapter {}
```

- [ ] **Step 4: Run** `npm test` → PASS · **Step 5: Commit** `feat: anthropic/google adapters + factory`
### Task 10a: Toast bus + settings + streamRegistry

**Files:** Create `src/lib/toast.ts`, `src/state/settings.ts`, `src/state/streamRegistry.ts`, `tests/state/streamRegistry.test.ts`

**Interfaces (Produces):**

```ts
// lib/toast.ts
export function toast(message: string): void
export function onToast(fn: (message: string) => void): () => void

// state/settings.ts
export interface RelaySettings {
  theme: 'light' | 'dark';
  autoLockMin: number;                                // default 15
  bases: Partial<Record<ProviderId, string>>;         // custom base per provider ('' → defaultBase)
  lastModel: { providerId: ProviderId; modelId: string };
}
export function loadSettings(): RelaySettings   // relay.settings.v1 merged over DEFAULTS {light, 15, {}, openai/gpt-4o}
export function saveSettings(patch: Partial<RelaySettings>): void

// state/streamRegistry.ts
export function startStream(key: string): AbortController  // aborts previous same-key
export function stopStream(key?: string): void             // undefined ⇒ stop all
export function anyActive(): boolean
```

- [ ] **Step 1: Failing test**

```ts
// tests/state/streamRegistry.test.ts
import { anyActive, startStream, stopStream } from '../../src/state/streamRegistry';

test('registry tracks controllers', () => {
  const ac = startStream('a');
  expect(anyActive()).toBe(true);
  stopStream('a');
  expect(ac.signal.aborted).toBe(true);
  expect(anyActive()).toBe(false);
});
```

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/lib/toast.ts
type Fn = (msg: string) => void;
const listeners = new Set<Fn>();
export function toast(msg: string): void { listeners.forEach((f) => f(msg)); }
export function onToast(fn: Fn): () => void { listeners.add(fn); return () => listeners.delete(fn); }
```

```ts
// src/state/settings.ts
import type { ProviderId } from '../catalog/types';
const LS_SETTINGS = 'relay.settings.v1';

export interface RelaySettings {
  theme: 'light' | 'dark';
  autoLockMin: number;
  bases: Partial<Record<ProviderId, string>>;
  lastModel: { providerId: ProviderId; modelId: string };
}

const DEFAULTS: RelaySettings = {
  theme: 'light', autoLockMin: 15, bases: {},
  lastModel: { providerId: 'openai', modelId: 'gpt-4o' },
};

export function loadSettings(): RelaySettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export function saveSettings(patch: Partial<RelaySettings>): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify({ ...loadSettings(), ...patch }));
}
```

```ts
// src/state/streamRegistry.ts
const map = new Map<string, AbortController>();
export function startStream(key: string): AbortController {
  stopStream(key);
  const ac = new AbortController();
  map.set(key, ac);
  return ac;
}
export function stopStream(key?: string): void {
  if (key) { map.get(key)?.abort(); map.delete(key); return; }
  for (const ac of map.values()) ac.abort();
  map.clear();
}
export function anyActive(): boolean { return map.size > 0; }
```

- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: toast/settings/stream registry`
### Task 10b: Session store

**Files:** Create `src/state/sessionStore.ts`, `tests/state/sessionStore.test.ts`

**Interfaces (Produces):**

```ts
export interface Turn {
  id: string; role: 'user' | 'assistant'; content: string;
  modelId?: string; providerId?: ProviderId;
  imageUrl?: string; tokensEst?: number;
  error?: { status?: number; message: string };
  streaming?: boolean;
}
export interface Session {
  id: string; title: string; createdAt: number; updatedAt: number;
  modelKey: { providerId: ProviderId; modelId: string };
  turns: Turn[];
}
```

`useSessionStore`: state `{sessions, activeId}`; actions `init()`, `createSession(modelKey):string`, `deleteSession(id)`, `renameSession(id,title)`, `setActive(id)`, `setModelKey(id,mk)`, `addTurn(sid,turn)` (auto-title from first user turn, ≤48 chars, when title==='New thread'), `patchTurn(sid,tid,patch)`, `appendDelta(sid,tid,text)` (no persist — streaming), `active():Session|undefined`, `exportJson():string`, `importJson(text):'ok'|'invalid'`. Mutations (not appendDelta) persist debounced 250ms to `relay.sessions.v1`.

- [ ] **Step 1: Failing tests**

```ts
// tests/state/sessionStore.test.ts
import { useSessionStore } from '../../src/state/sessionStore';

const s = () => useSessionStore.getState();

test('session lifecycle + autotitle + import/export', () => {
  localStorage.clear();
  s().init();
  const id = s().createSession({ providerId: 'openai', modelId: 'gpt-4o' });
  expect(s().active()!.title).toBe('New thread');
  s().addTurn(id, { id: 't1', role: 'user', content: 'Explain quantum tunneling briefly please' });
  expect(s().active()!.title).toBe('Explain quantum tunneling briefly pleas');
  s().addTurn(id, { id: 'a1', role: 'assistant', content: '', modelId: 'gpt-4o', providerId: 'openai' });
  s().appendDelta(id, 'a1', 'He');
  s().appendDelta(id, 'a1', 'llo');
  expect(s().active()!.turns.find((t) => t.id === 'a1')!.content).toBe('Hello');
  const dump = s().exportJson();
  localStorage.clear();
  s().init();
  expect(s().importJson(dump)).toBe('ok');
  expect(s().sessions.length).toBe(1);
  expect(s().importJson('garbage')).toBe('invalid');
});

test('setModelKey updates the session slot', () => {
  localStorage.clear();
  s().init();
  const id = s().createSession({ providerId: 'openai', modelId: 'gpt-4o' });
  s().setModelKey(id, { providerId: 'anthropic', modelId: 'claude-x' });
  expect(s().active()!.modelKey.providerId).toBe('anthropic');
});
```

- [ ] **Step 2: Run** → FAIL · **Step 3: Implement**

```ts
// src/state/sessionStore.ts
import { create } from 'zustand';
import { uid } from '../lib/id';
import type { ProviderId } from '../catalog/types';

const LS_SESSIONS = 'relay.sessions.v1';
let timer: ReturnType<typeof setTimeout> | undefined;

function persistSoon(get: () => SessionsState): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(LS_SESSIONS, JSON.stringify(get().sessions)); }
    catch { /* quota exceeded — keep in memory */ }
  }, 250);
}

export interface Turn { /* shape above */ 
  id: string; role: 'user' | 'assistant'; content: string;
  modelId?: string; providerId?: ProviderId; imageUrl?: string; tokensEst?: number;
  error?: { status?: number; message: string }; streaming?: boolean;
}
export interface Session {
  id: string; title: string; createdAt: number; updatedAt: number;
  modelKey: { providerId: ProviderId; modelId: string };
  turns: Turn[];
}
type ModelKey = Session['modelKey'];

interface SessionsState {
  sessions: Session[]; activeId: string | null;
  init(): void;
  createSession(mk: ModelKey): string;
  deleteSession(id: string): void;
  renameSession(id: string, title: string): void;
  setActive(id: string): void;
  setModelKey(id: string, mk: ModelKey): void;
  addTurn(sid: string, turn: Turn): void;
  patchTurn(sid: string, tid: string, patch: Partial<Turn>): void;
  appendDelta(sid: string, tid: string, text: string): void;
  active(): Session | undefined;
  exportJson(): string;
  importJson(text: string): 'ok' | 'invalid';
}

function touch(list: Session[], sid: string, fn: (s: Session) => Session): Session[] {
  return list.map((s) => (s.id === sid ? { ...fn(s), updatedAt: Date.now() } : s));
}

export const useSessionStore = create<SessionsState>((set, get) => ({
  sessions: [], activeId: null,
  init() {
    let sessions: Session[] = [];
    try { sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) ?? '[]'); } catch { sessions = []; }
    set({ sessions, activeId: sessions[0]?.id ?? null });
  },
  createSession(mk) {
    const id = uid('s_');
    set((st) => ({ sessions: [{ id, title: 'New thread', createdAt: Date.now(), updatedAt: Date.now(), modelKey: mk, turns: [] }, ...st.sessions], activeId: id }));
    persistSoon(get);
    return id;
  },
  deleteSession(id) {
    set((st) => {
      const sessions = st.sessions.filter((x) => x.id !== id);
      return { sessions, activeId: st.activeId === id ? sessions[0]?.id ?? null : st.activeId };
    });
    persistSoon(get);
  },
  renameSession(id, title) { set((st) => ({ sessions: touch(st.sessions, id, (s) => ({ ...s, title })) })); persistSoon(get); },
  setActive(id) { set({ activeId: id }); },
  setModelKey(id, mk) { set((st) => ({ sessions: touch(st.sessions, id, (s) => ({ ...s, modelKey: mk })) })); persistSoon(get); },
  addTurn(sid, turn) {
    set((st) => ({ sessions: touch(st.sessions, sid, (s) => ({
      ...s,
      turns: [...s.turns, turn],
      title: s.turns.length === 0 && turn.role === 'user'
        ? turn.content.slice(0, 48).trim() || 'New thread'
        : s.title,
    }) })));
    persistSoon(get);
  },
  patchTurn(sid, tid, patch) {
    set((st) => ({ sessions: touch(st.sessions, sid, (s) => ({ ...s, turns: s.turns.map((t) => (t.id === tid ? { ...t, ...patch } : t)) })) }));
    persistSoon(get);
  },
  appendDelta(sid, tid, text) {
    set((st) => ({ sessions: st.sessions.map((s) =>
      s.id !== sid ? s : { ...s, turns: s.turns.map((t) => (t.id !== tid ? t : { ...t, content: t.content + text })) },
    ) }));
  },
  active() { return get().sessions.find((s) => s.id === get().activeId); },
  exportJson() {
    return JSON.stringify({ app: 'relay', v: 1, exportedAt: new Date().toISOString(), sessions: get().sessions }, null, 2);
  },
  importJson(text) {
    try {
      const j = JSON.parse(text) as { sessions?: Session[] };
      if (!Array.isArray(j.sessions)) return 'invalid';
      set({ sessions: j.sessions, activeId: j.sessions[0]?.id ?? null });
      persistSoon(get);
      return 'ok';
    } catch { return 'invalid'; }
  },
}));
```

- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: session store with persistence`
### Task 11: Design system CSS + App shell

**Files:** Fill `src/styles/tokens.css`, `src/styles/app.css`; Create `src/features/shell/{Rail,TopBar,Wizard,ToastStack}.tsx`, `src/state/uiStore.ts`; Replace `src/main.tsx`, `src/App.tsx` stubs.

**Interfaces (Consumes):** `loadSettings/saveSettings` (10a), `useVaultStore` (6).
**Interfaces (Produces):** `useUiStore` — state `{theme, view:'thread'|'compare'|'lab', paletteOpen, settingsOpen, railOpen, activeModel:{providerId,modelId}, compareModels:Array<{providerId,modelId}>}`; actions `toggleTheme(), setView(v), setPaletteOpen(b), setSettingsOpen(b), setRailOpen(b), setActiveModel(ref), toggleCompareModel(ref)`.

- `tokens.css`: CSS custom props on `:root` (light: paper/ink/hairline/accent per Global Constraints; surface `#FFFFFF`; muted `#6B655C`) and `[data-theme='dark']` overrides (espresso bg `#14120F`, cream text `#F3EDE2`, surface `#1D1A16`, hairline `#2E2A24`). Font stacks: `--font-ui:'Space Grotesk',system-ui,sans-serif`, `--font-mono:'JetBrains Mono',ui-monospace,monospace`. Radius token `--r:8px`; motion token `--ease:cubic-bezier(.2,.9,.25,1)`.
- `app.css`: layout grid `.shell{display:grid;grid-template-columns:264px 1fr}` collapsing to drawer <900px (rail fixed + scrim when `.rail-open`); `.thread` max-width 760px centered; bubble styles `.bubble.user` (right-aligned paper card w/ hairline border) / `.bubble.assistant` (left rule 3px accent-tinted, mono model badge `.badge`); composer bar sticky bottom with `.composer textarea` autosize; `.btn`, `.btn-primary` (accent bg), `.chip`, `.sheet` (bottom-sheet modal), `.palette-overlay`, `.col` compare columns, `.bench` lab cards, blueprint-grid empty-state background via repeating-linear-gradient at 3% opacity; `@media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }`.
- `main.tsx`: apply theme from loadSettings → `document.documentElement.dataset.theme` before render.
- `App.tsx`: vault gate (`status!=='unlocked'` → `<Wizard/>`), else shell: Rail · TopBar · main view switch (ThreadView/CompareView/LabView) · Composer in thread view · Palette overlay when open · SettingsSheet when open · ToastStack; global ⌘K/Ctrl+K toggles palette, Esc closes overlays; activity listener (`pointerdown/keydown`) calls `vault.touch()`; interval (30s) auto-locks when `Date.now()-lastActivity > autoLockMin*60000`.
- `Rail.tsx`: brand glyph "⟐ Relay", New-thread button, session list (title, relative time; click → setActive; hover ✕ delete w/ second-click confirm), footer: vault status dot + lock button.
- `TopBar.tsx`: view tabs Thread/Compare/Lab; right side: theme toggle ☀︎/☾, settings gear.
- `Wizard.tsx`: 3 steps (passphrase ×2 confirm → per-provider key inputs with Test buttons using `createAdapter(...).testConnection()` → done CTA). Uses `vault.createVault/setKey`.
- `ToastStack.tsx`: subscribes `onToast`, renders bottom-center stack, auto-dismiss 3.5s.

**Verify:** `npm run build` passes; manual `npm run dev` — wizard shows, theme persists across reload. **Commit:** `feat: design system + app shell`

### Task 12: Thread view + Composer + send orchestration

**Files:** Create `src/features/thread/{ThreadView,BatonTrail,MessageBubble,useSend}.tsx|ts`, `src/features/composer/{Composer,ImageAttach,MicRecorder,ModelDial}.tsx`, `tests/thread/useSend.test.ts`.

**Core contract — `useSend.ts`** (THE single send entry):

```ts
export async function sendTurn(text: string, imageUrl?: string): Promise<void> {
  const ui = useUiStore.getState();
  const vault = useVaultStore.getState();
  const ss = useSessionStore.getState();
  const sid = ss.active()?.id ?? ss.createSession(ui.activeModel);
  const session = useSessionStore.getState().active()!;
  const { providerId, modelId } = session.modelKey;
  if (!vault.keys[providerId]) { toast(`Add an ${PROVIDERS[providerId].name} key first.`); return; }

  ss.addTurn(sid, { id: uid('u_'), role: 'user', content: text, imageUrl, tokensEst: estimateTurnTokens({ content: text, imageUrl }) });
  const aid = uid('a_');
  ss.addTurn(sid, { id: aid, role: 'assistant', content: '', modelId, providerId, streaming: true });

  const history = buildHistory(useSessionStore.getState().active()!.turns.filter((t) => t.id !== aid));
  const ac = startStream(aid);
  const adapter = createAdapter(providerId, {
    baseUrl: effectiveBase(providerId),
    apiKey: () => useVaultStore.getState().keys[providerId],
  });
  try {
    await adapter.streamChat(
      { model: modelId, messages: history },
      {
        signal: ac.signal,
        onDelta: (d) => useSessionStore.getState().appendDelta(sid, aid, d),
        onDone: () => useSessionStore.getState().patchTurn(sid, aid, { streaming: false }),
      },
    );
    // finalize tokens
    const t = useSessionStore.getState().active()!.turns.find((x) => x.id === aid);
    useSessionStore.getState().patchTurn(sid, aid, { streaming: false, tokensEst: estimateTokens(t?.content ?? '') });
  } catch (e) {
    if ((e as Error).name === 'AbortError') patchTurn(aid, { streaming: false });
    else patchTurn(aid, { streaming: false, error: { status: e instanceof ApiError ? e.status : undefined, message: e instanceof Error ? e.message : String(e) } });
  }
}

export function buildHistory(turns: Turn[], cap = 20): ChatMessage[] {
  return turns.filter((t) => !t.error && t.content.trim()).slice(-cap)
    .map((t) => ({ role: t.role, content: t.content, ...(t.imageUrl && t.role === 'user' ? { imageUrl: t.imageUrl } : {}) }));
}
// effectiveBase(pid): settings.bases[pid] || PROVIDERS[pid].defaultBase
```

- `ThreadView.tsx`: empty state (blueprint grid, tagline, "⌘K to switch models" hint) else scrollable turn list; `BatonTrail` above list showing ordered unique models used (mono chips, provider tint dot); auto-scroll-to-bottom while last turn streams unless user scrolled up.
- `MessageBubble.tsx`: user → paper card (+image thumb, token count); assistant → left-rule card with `.badge` (provider tint + mono model label), markdown via `renderMarkdown` memoized, copy button on code blocks, error card variant (⚠ message + Retry button re-calls `sendTurn` of prior user content? No — Retry = resend same history without this failed turn: remove failed turn then re-run generation-only helper `regenerate(sid)` that creates new assistant turn from existing history), handoff ⚡ menu (Task 13), TTS ▶ chip when provider supports tts (Task 15).
- `Composer.tsx`: autosize textarea (Enter=send, Shift+Enter=newline), Stop button replaces Send while `anyActive()` for current turn; `ModelDial` chip left (current model label + tint dot, click → palette); `ImageAttach` (📎 input+paste → canvas downscale ≤1024px JPEG q0.85 → dataURL preview chip with cancel); mic button (Task 15); disabled send when empty & no image; paste handler for images.
- Tests: `useSend` with mocked fetch SSE — user+assistant turns appear, deltas append, error path writes `error` on assistant turn, stop aborts cleanly.

**Verify:** `npm test` PASS; dev-run two-turn conversation against mock or real key. **Commit:** `feat: thread, composer, streaming send pipeline`

### Task 13: Palette + ModelDial + Handoff

**Files:** Create `src/features/palette/Palette.tsx`; extend `ModelBubble` handoff.

- Palette: overlay centered top; input filters ALL providers' models (`listModels` each provider having a key OR compatible always shown): match against `label`, `id`, provider name, capability synonyms map `{vision:[image,picture], stt:[transcribe,whisper,audio-in], tts:[speak,voice], reasoning:[think,o1,o3], tools:[function]}`; ↑↓ navigate, Enter select → `setActiveModel({providerId,modelId})` AND `setModelKey(activeSession)` when session exists; Esc closes. Groups labeled by provider name with tint dots. Keyboard focus trapped.
- ModelDial: current model chip in composer (tint dot + mono label + ▾). Opens Palette.
- HandoffMenu on assistant bubbles: ⚡ button → mini-menu listing chat-capable models of other providers → select sets session modelKey + ui.activeModel + toast "Next reply handed to X".

Tests: palette filter unit test (query 'vision' surfaces gpt-4o not whisper-1); keyboard nav smoke test.

**Commit:** `feat: ⌘K palette, dial, handoff`

### Task 14: Settings sheet + DataPort

**Files:** `src/features/settings/{SettingsSheet,DataPort}.tsx`.

Settings sheet sections: Keys (per provider: masked input, Save→`setKey`, Remove, Test status inline), Custom base URL per provider (validated https except localhost), Auto-lock minutes (number input), Theme radio, DataPort block. Focus-trapped; Esc closes.
DataPort: Export JSON (`sessionStore.exportJson()` → blob download `relay-backup-YYYYMMDD.json`), Import (file input → `importJson` toast result), Export current thread as Markdown (turns → `## You\n\n…\n\n> **GPT-4o**\n\n…` download .md).

Test: export/import roundtrip via store directly (already covered) + MD export shape unit test.

**Commit:** `feat: settings, data port`

### Task 15: Voice — STT recording + TTS playback

**Files:** `src/features/composer/MicRecorder.tsx`, `src/lib/audioBus.ts`.

- MicRecorder: click toggles; `getUserMedia({audio:true})` → `MediaRecorder('audio/webm')`; live timer; Cancel discards; Stop → Blob → `createAdapter(providerWithSttKey).transcribe(blob,'whisper-1')` → fills composer textarea. Provider choice: prefer openai key, else compatible. Permission failure → toast.
- audioBus: module holding one `HTMLAudioElement`; `playBlob(blob)` stops previous before playing; returns controller for chip state.
- TTS chip on assistant bubbles when `keys.openai` exists: ▶ → `speak(content,'tts-1')` → playBlob; playing state animates bars.

Manual QA (mic needs real device); unit-test audioBus stop-previous logic with fake audio element.

**Commit:** `feat: voice in/out`

### Task 16: Compare mode + Lab benches

**Files:** `src/features/compare/CompareView.tsx`, `src/features/lab/LabView.tsx`.

- CompareView: column picker (chips of selected models, max 3, via palette-like popover listing chat-capable models with ✓); prompt textarea; Send fans out concurrently — per column: own AbortController keyed `cmp-<i>`, local column state `{text, streaming, error}` (columns don't touch session store until promote); Promote winner button per column → adds assistant turn (with its modelId) + user turn (prompt) into active session, switches view to thread.
- LabView: Embeddings bench (two textareas + similarity % via `embed`×2 + `cosineSimilarity`, embed model default `text-embedding-3-small` openai or google `text-embedding-004`); Moderation bench (textarea → categories chips red/green).

Unit tests: compare fan-out orchestration with mocked adapters; cosine bench calculation already covered.

**Commit:** `feat: compare arena + lab benches`

### Task 17: QA pass, README, final verification

- [ ] a11y sweep: focus traps on overlays, aria-live="polite" region announcing streamed completion ("Reply from GPT-4o finished"), labels on inputs, AA contrast spot-check light/dark.
- [ ] Responsive: 375px rail→drawer with scrim; compare columns stack vertical; composer sticky.
- [ ] reduced-motion honored; dark theme full pass.
- [ ] README.md: what/why, screenshot placeholder, security model, dev commands, provider notes (CORS caveats: Anthropic requires `anthropic-dangerous-direct-browser-access: true` header — add it in AnthropicAdapter headers).
- [ ] Run `npm test -- --coverage` → ≥80% lines on src/lib, src/adapters, src/vault (add targeted tests where short).
- [ ] `npm run build` clean; final commit `docs: README + qa hardening`.

## Verification matrix (manual)

1. Fresh clone → `npm i` → `npm run dev` → wizard → keys → streamed answer from OpenAI **and** Anthropic within 3 min.
2. Swap model mid-thread → next badge differs; baton trail updates; handoff preserves context.
3. DevTools offline mid-stream → clean error card; Retry works after reconnect.
4. Reload → sessions persist; vault locked; unlock restores.
5. Export → clear localStorage → import → identical threads; no key material inside backup.
