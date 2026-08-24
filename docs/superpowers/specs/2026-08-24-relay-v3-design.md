# Relay v3 — Production-Grade Rewrite

**Date:** 2026-08-24  
**Status:** Approved  
**Scope:** UI layer rewrite + new features (Studio, IDE) + reality pass

---

## 1. Motivation

Relay is a zero-backend BYOK AI chat harness with a clear design identity ("paper workbench") and a solid tested core (adapters, vault, state, catalog). However, the UI layer has issues:

- **Button placement feels unprofessional** — controls scattered, no clear hierarchy
- **Emoji used as icons** — inconsistent across platforms, not production-grade
- **No image/video generation** — user requested "IDEO system" (image/video/code)
- **No code IDE** — code blocks can't be edited/previewed live
- **CSP bug** — inline theme script blocked, causing dark mode flash
- **Fonts hotlinked from Google** — fragile, privacy issue
- **No mobile-first polish** — spacing, touch targets, layout not optimized

The user wants Relay to be **production-ready for worldwide deployment on a free host** (Cloudflare Pages / Netlify / Vercel / GitHub Pages).

---

## 2. Scope

### What changes (UI layer rewrite)

- **Shell layout** — sidebar + main content (NextChat-inspired)
- **Composer** — visible action buttons in horizontal row (like NextChat)
- **Design system** — self-hosted fonts, SVG icons, spacing tokens
- **New feature: Studio** — image/video generation engine
- **New feature: IDE** — code editor + live preview (Artifacts-style)
- **Reality pass** — fix CSP bug, audit every control, add empty/error states
- **Deploy kit** — SEO/PWA meta, multi-host deploy docs

### What stays (core engine)

- `src/adapters/` — provider wire formats (OpenAI, Anthropic, Google, compatible)
- `src/vault/` — encrypted key storage (AES-GCM, PBKDF2)
- `src/state/` — zustand stores (session, UI, settings, stream registry)
- `src/catalog/` — model discovery, normalization, capability heuristics
- `src/lib/` — SSE parser, markdown, tokens, audio bus, networking

### Identity preserved

- "One thread. Every model." — mid-thread model swap remains the hero interaction
- Paper workbench theme — warm paper light, espresso dark, signal orange accent
- Zero-backend BYOK — keys stay in the user's browser, no server needed

---

## 3. Architecture

### Keep (tested, working)

```
src/
  adapters/     ProviderAdapter contract + 4 wire formats
  vault/        WebCrypto encryption + zustand key store
  state/        sessionStore, uiStore, settings, streamRegistry
  catalog/      model discovery, normalize, providers, types
  lib/          sse, markdown, tokens, audioBus, net, toast
```

All 45 existing tests stay green. No changes to these modules except extending adapter contract (see §7).

### Rewrite (UI layer)

```
src/
  styles/       new token system, mobile-first spacing
  features/
    shell/      Rail, TopBar, Wizard, ToastStack, ErrorBoundary
    thread/     ThreadView, MessageBubble, BatonTrail, useSend
    composer/   Composer, MicRecorder, ImageAttach, ModelDial
    palette/    Palette (⌘K command palette)
    settings/   SettingsSheet, DataPort
    providers/  ProvidersPage, autoLoad
    voice/      LivePanel, realtime

  ui/           NEW — primitive components (Button, Icon, Sheet, Dialog, etc.)
  studio/       NEW — generation engine + UI
  ide/          NEW — code editor + live preview
```

### State stores — extend, don't rewrite

Add two new stores:

```ts
// src/studio/studioStore.ts
interface StudioStore {
  jobs: GenerationJob[]
  createJob(prompt: string, type: 'image' | 'video', model: string): Promise<string>
  cancelJob(id: string): void
  getJob(id: string): GenerationJob | undefined
}

interface GenerationJob {
  id: string
  type: 'image' | 'video'
  prompt: string
  model: string
  status: 'queued' | 'running' | 'polling' | 'completed' | 'failed'
  progress?: number // 0-100 for video
  result?: string // URL or base64
  error?: string
  createdAt: number
}
```

```ts
// src/ide/ideStore.ts
interface IDEStore {
  buffers: IDEBuffer[]
  openBuffer(messageId: string, code: string, language: string): string
  closeBuffer(id: string): void
  updateBuffer(id: string, code: string): void
}

interface IDEBuffer {
  id: string
  messageId: string
  code: string
  language: string
  unsavedChanges: boolean
}
```

---

## 4. Shell Layout

### Desktop (>768px)

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (280px)          │ Main content area             │
├──────────────────────────┼─────────────────────────────────┤
│ ⟐ Relay                  │ TopBar                        │
│                          │  [model chip] [theme] [lock]   │
├──────────────────────────┼─────────────────────────────────┤
│ THREADS                  │                               │
│  + New thread            │                               │
│  - Robot story           │ Thread view                   │
│  - API help              │  [user bubble]                │
│  - Debug session         │  [assistant bubble]           │
│                          │  [reasoning panel]            │
├──────────────────────────┼─────────────────────────────────┤
│ PROVIDERS                │                               │
│  ▼ OpenAI                │                               │
│    - gpt-4o              │                               │
│    - gpt-image-1         │                               │
│  ▼ Anthropic             │                               │
│    - claude-3.5-sonnet   │                               │
├──────────────────────────┼─────────────────────────────────┤
│ STUDIO                   │                               │
│  - Recent generations   │                               │
├──────────────────────────┼─────────────────────────────────┤
│ ⚙ Settings               │ Composer                      │
│ 🔒 Lock vault            │  [textarea: Ask anything...]  │
│                          │  [📎] [🎙] [⚡] [🔍] [➕ Send] │
└──────────────────────────┴─────────────────────────────────┘
```

Sidebar is always visible on desktop. Sections are collapsible (Threads, Providers, Studio).

### Mobile (<768px)

```
┌──────────────────┐
│ TopBar           │
│  [☰] ⟐ Relay   │
│  [model chip]    │
├──────────────────┤
│                  │
│                  │
│ Thread view      │
│  [user bubble]   │
│  [assistant]     │
│                  │
│                  │
├──────────────────┤
│ Composer         │
│ [textarea]       │
│ [📎][🎙][⚡][🔍] │
│ [➕ Send ↵]      │
└──────────────────┘
```

- TopBar hamburger (☰) opens sidebar as a drawer (slide from left)
- Drawer contains same sections as desktop sidebar
- Composer actions scroll horizontally if needed
- Safe-area insets for notched devices

### Navigation model

- **Desktop:** Sidebar sections (Threads, Providers, Studio) act as filters
  - Clicking a thread → loads it in main area
  - Clicking a provider → expands model list
  - Clicking a model → sets it as active, focuses composer
  - Clicking Studio → shows generation gallery (replaces thread view)
- **Mobile:** Same logic, but drawer closes after selection
- **Settings:** Full-page sheet (mobile) or modal (desktop)
- **IDE:** Full-page route (mobile) or right panel (desktop, see §9)

---

## 5. Composer

### Layout

```
┌──────────────────────────────────────────────┐
│  [Textarea: Ask anything...]                 │
│  (auto-grows, max 8 rows)                    │
├──────────────────────────────────────────────┤
│  [📎 Attach] [🎙 Voice] [⚡ Effort ▾]        │
│  [🔍 Research] [🎙️ Live] [📷 Image] [🎥 Video]│
│  [⌗ Model ▾]                    [➕ Send ↵]  │
└──────────────────────────────────────────────┘
```

### Actions (always visible, horizontal row)

| Action | Icon | Behavior | Contextual? |
|--------|------|----------|-------------|
| Attach image | Paperclip | Opens file picker | Only if current model is vision-capable |
| Record voice | Mic | Starts transcription (Whisper) | Always |
| Reasoning effort | Zap + dropdown | Toggles Standard / Low / High | Only if model supports `reasoning_effort` |
| Deep research | Search | Toggles web search (Exa) | Always (shows warning if no Exa key) |
| Live voice | Headphones | Opens Realtime WebRTC panel | Only if current model matches `/realtime/` |
| Generate image | Image | Switches composer to image mode | Only if current model is image-capable |
| Generate video | Video | Switches composer to video mode | Only if current model is video-capable |
| Model selector | Hash + dropdown | Opens model picker (filtered by current provider) | Always |
| Send | Arrow-right | Sends message (or generates if in image/video mode) | Always |

### Behavior

- **Textarea** auto-grows from 2 to 8 rows, then scrolls
- **Action row** scrolls horizontally on mobile (overflow-x: auto)
- **Icons** are inline SVGs (lucide-react), not emojis
- **Disabled state:** If no active model, composer shows "Pick a model to start" hint, Send button disabled
- **Image/video mode:** Textarea placeholder changes to "Describe the image you want to create..." or "Describe the video..."
- **Enter to send** (Shift+Enter for newline)

### Mobile adjustments

- Action row scrolls horizontally
- Touch targets ≥44px
- Composer sticks to bottom with `position: sticky; bottom: 0;`
- Safe-area insets: `padding-bottom: env(safe-area-inset-bottom);`

---

## 6. Design System

### Tokens

```css
/* src/styles/tokens.css */

:root {
  /* Colors — paper workbench */
  --paper: #faf6ef;
  --ink: #191714;
  --muted: #6b655c;
  --hairline: #e5ded2;
  --surface: #ffffff;
  --accent: #e4572e;
  --accent-soft: rgba(228, 87, 46, 0.08);
  --ok: #3d8b62;
  --err: #c23b22;
  
  /* Spacing — 4px grid */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  
  /* Border radius */
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;
  
  /* Typography */
  --font-ui: 'Space Grotesk Variable', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', monospace;
  
  /* Motion */
  --ease: cubic-bezier(0.2, 0.9, 0.25, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
}

[data-theme='dark'] {
  --paper: #14120f;
  --ink: #f3ede2;
  --muted: #a39a8c;
  --hairline: #2e2a24;
  --surface: #1d1a16;
  --accent: #ff6a3d;
  --accent-soft: rgba(255, 106, 61, 0.12);
  --ok: #5cb98a;
  --err: #ef7a63;
}
```

### Fonts (self-hosted)

Install `@fontsource-variable/space-grotesk` and `@fontsource-variable/jetbrains-mono`.

```ts
// src/main.tsx
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
```

No external requests to Google Fonts. Faster load, privacy-friendly.

### Icons

Use `lucide-react` for all icons. Consistent, tree-shakable, a11y-ready (aria-label support).

```tsx
// src/ui/Icon.tsx
import { Paperclip, Mic, Zap, Search, Headphones, Image, Video, Hash, ArrowRight } from 'lucide-react';

interface IconProps {
  name: string
  size?: number
  'aria-label'?: string
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  const icons = { Paperclip, Mic, Zap, Search, Headphones, Image, Video, Hash, ArrowRight };
  const Component = icons[name];
  return Component ? <Component size={size} {...props} /> : null;
}
```

### UI primitives

Create a minimal component library in `src/ui/`:

- `Button` — primary, secondary, ghost variants
- `IconButton` — icon-only button with aria-label
- `Sheet` — bottom sheet (mobile) / modal (desktop)
- `Dialog` — centered modal with backdrop
- `Dropdown` — popover menu (for model selector, effort selector)
- `Input` — text input with label
- `Textarea` — auto-growing textarea
- `Chip` — badge/pill (for model chip, thread chip)
- `Skeleton` — loading placeholder
- `Toast` — notification (already exists in `lib/toast.ts`)

---

## 7. Studio — Image & Video Generation

### Adapter contract extension

Add two optional methods to `ProviderAdapter`:

```ts
interface ProviderAdapter {
  // ... existing methods ...
  
  generateImage?(opts: ImageGenOpts): Promise<ImageResult>
  generateVideo?(opts: VideoGenOpts): Promise<VideoJob>
}

interface ImageGenOpts {
  prompt: string
  model: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  n?: number // number of images (1-4)
}

interface ImageResult {
  images: string[] // base64 or URLs
  revisedPrompt?: string
}

interface VideoGenOpts {
  prompt: string
  model: string
  duration?: 5 | 10 | 15 // seconds
  aspectRatio?: '16:9' | '9:16' | '1:1'
}

interface VideoJob {
  id: string // job ID for polling
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress?: number
  videoUrl?: string
  error?: string
}
```

### Adapter implementations

**OpenAI adapter:**
- `generateImage`: POST `/v1/images/generations` with `model: 'gpt-image-1'` or `'dall-e-3'`
- `generateVideo`: POST `/v1/videos` (multipart form), returns job ID. Poll GET `/v1/videos/{id}` until status is `completed`, then GET `/v1/videos/{id}/content` for video bytes.

**Compatible adapter:**
- Inherits OpenAI wire format. If custom provider supports `/images/generations`, it works.

**Anthropic adapter:**
- No image/video generation (Claude doesn't support it). Return `null` or throw.

**Google adapter:**
- `generateVideo`: POST `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning` with `x-goog-api-key` header. Poll operation until done, fetch video URI.

### Capability heuristics

Extend `catalog/normalize.ts`:

```ts
function detectCapabilities(modelId: string): ModelCapabilities {
  return {
    vision: /vision|gpt-4o|claude-3|gemini-1.5/i.test(modelId),
    reasoning: /o1|reasoning|thinking/i.test(modelId),
    image: /dall-e|gpt-image|flux|sdxl|ideogram/i.test(modelId),
    video: /sora|veo/i.test(modelId),
    voice: /realtime|whisper|tts/i.test(modelId),
  };
}
```

### Job orchestration

`src/studio/engine.ts`:

```ts
async function createGenerationJob(
  adapter: ProviderAdapter,
  opts: ImageGenOpts | VideoGenOpts
): Promise<string> {
  const jobId = id()
  studioStore.setState((s) => ({
    jobs: [...s.jobs, { id: jobId, status: 'queued', ...opts, createdAt: Date.now() }]
  }))
  
  if (opts.type === 'image') {
    const result = await adapter.generateImage!(opts)
    studioStore.updateJob(jobId, { status: 'completed', result: result.images[0] })
  } else {
    const videoJob = await adapter.generateVideo!(opts)
    studioStore.updateJob(jobId, { status: 'polling' })
    await pollUntilComplete(videoJob.id, jobId, adapter)
  }
  
  return jobId
}

async function pollUntilComplete(videoJobId: string, jobId: string, adapter: ProviderAdapter) {
  while (true) {
    const status = await adapter.getVideoJobStatus!(videoJobId)
    studioStore.updateJob(jobId, { progress: status.progress })
    if (status.status === 'completed') {
      const videoUrl = await adapter.getVideoContent!(videoJobId)
      studioStore.updateJob(jobId, { status: 'completed', result: videoUrl })
      break
    }
    if (status.status === 'failed') {
      studioStore.updateJob(jobId, { status: 'failed', error: status.error })
      break
    }
    await sleep(2000)
  }
}
```

### Studio UI

**Route:** `/studio` (full page on mobile, replaces thread view on desktop)

**Layout:**
```
┌──────────────────────────────────────────┐
│ Studio — Recent Generations              │
├──────────────────────────────────────────┤
│ [+ New Generation]                       │
├──────────────────────────────────────────┤
│ Grid of generated images/videos          │
│  [image1] [image2] [video1]              │
│  [image3] [video2] [image4]              │
└──────────────────────────────────────────┘
```

**"New Generation" sheet:**
- Type selector: Image / Video
- Model selector (filtered by capability)
- Prompt textarea
- Options (size, quality, duration)
- Generate button

### Rich bubbles in thread

Generated images/videos also appear in the thread as rich content:

```tsx
// MessageBubble.tsx
{message.image && (
  <div className="image-grid">
    {message.image.map((url, i) => (
      <img key={i} src={url} alt={message.content} />
    ))}
  </div>
)}
{message.video && (
  <video src={message.video} controls />
)}
```

---

## 8. IDE — Code Artifacts

### Trigger

Code blocks in assistant messages get "Open in IDE" + "Preview" buttons (for HTML/JSX/CSS).

```tsx
// markdown.ts — post-pass
codeBlocks.forEach((pre) => {
  const lang = pre.querySelector('code')?.classList[0]?.replace('language-', '')
  const code = pre.textContent
  
  const actions = document.createElement('div')
  actions.className = 'code-actions'
  
  if (['html', 'jsx', 'css'].includes(lang)) {
    actions.innerHTML = `
      <button class="btn-icon" data-action="preview">▶ Preview</button>
      <button class="btn-icon" data-action="ide">📝 Open in IDE</button>
    `
  }
  
  actions.innerHTML += `
    <button class="btn-icon" data-action="copy">📋 Copy</button>
  `
  
  pre.prepend(actions)
})
```

### IDE UI

**Desktop:** Right panel (50% width) alongside thread

```
┌──────────────────────────────────────────────────────┐
│ Thread (left 50%)          │ IDE (right 50%)          │
├────────────────────────────┼──────────────────────────┤
│ [user bubble]              │ clock.html               │
│ [assistant with code block]├──────────────────────────┤
│                            │ [Edit] [Preview] [Copy]  │
│                            ├──────────────────────────┤
│                            │ CodeMirror editor        │
│                            │  <canvas id="c"></canvas>│
│                            │  const ctx = c.get...    │
│                            ├──────────────────────────┤
│                            │ Live preview (iframe)    │
│                            │  [rendered clock]        │
└────────────────────────────┴──────────────────────────┘
```

**Mobile:** Full-page route

```
┌──────────────────┐
│ [← Back] clock.html│
├──────────────────┤
│ [Edit] [Preview] │
├──────────────────┤
│ CodeMirror editor│
│  (or preview)    │
│                  │
├──────────────────┤
│ [Copy] [Download]│
│ [Send to thread] │
└──────────────────┘
```

### CodeMirror integration

Install `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`.

```ts
// src/ide/Editor.tsx
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'

export function createEditor(initialCode: string, language: string) {
  const extensions = [
    language === 'javascript' ? javascript() :
    language === 'html' ? html() :
    language === 'css' ? css() : []
  ]
  
  return new EditorView({
    state: EditorState.create({
      doc: initialCode,
      extensions
    })
  })
}
```

### Live preview

Sandboxed iframe with `srcdoc`:

```tsx
// src/ide/Preview.tsx
export function Preview({ code, language }: { code: string, language: string }) {
  const srcdoc = language === 'html' ? code :
                 language === 'css' ? `<style>${code}</style>` :
                 language === 'javascript' ? `<script>${code}</script>` :
                 ''
  
  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}
```

### Actions

- **Copy** — copies code to clipboard
- **Download** — downloads code as file
- **Send to thread** — inserts code into composer as context
- **Edit** — toggles between editor and preview

---

## 9. Reality Pass

### Fix known bugs

**CSP blocks inline theme script:**
- Move theme boot script from inline `<script>` in `index.html` to external file `/theme-boot.js`
- CSP already allows `script-src 'self'`, so this works
- Remove the `<!-- TODO: Migrate inline styles -->` comment

```js
// public/theme-boot.js
try {
  var s = JSON.parse(localStorage.getItem('relay.settings.v1') || '{}');
  if (s.theme === 'dark') document.documentElement.dataset.theme = 'dark';
} catch(e) {}
```

```html
<!-- index.html -->
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src blob:; connect-src https: wss: ws://localhost:* http://localhost:* http://127.0.0.1:*; base-uri 'none'" />
  <script src="/theme-boot.js"></script>
</head>
```

**Emoji icons → SVG icons:**
- Replace all emoji in UI with lucide-react icons
- Affected components: Rail, TopBar, Composer, MessageBubble, Palette, SettingsSheet

**Fonts from Google → self-hosted:**
- Install `@fontsource-variable/space-grotesk` and `@fontsource-variable/jetbrains-mono`
- Remove Google Fonts `<link>` from `index.html`
- Import fonts in `main.tsx`

### Audit every control

| Control | Current behavior | Fix |
|---------|-----------------|-----|
| Effort toggle | Toggles Standard/Low/High | Verify it maps to OpenAI `reasoning_effort` param and Anthropic `thinking` budget |
| Research toggle | Toggles deep research (Exa) | Show inline warning "Set Exa API key in Settings" if key not set |
| Voice buttons | Always visible | Hide if current model doesn't support voice (no Whisper/TTS endpoint) |
| Image attach | Always visible | Hide if current model isn't vision-capable |
| Live voice | Always visible | Only show if current model matches `/realtime/` |

### Empty & error states

**No active model:**
- Composer disabled
- Placeholder: "Pick a model to start"
- CTA button: "Set up providers"

**No API key:**
- Inline error in thread: "No API key set for OpenAI"
- CTA button: "Add key in Settings"

**Rate limit (429):**
- Show inline error card: "Rate limited. Retrying in 5s..."
- Countdown timer
- Retry button

**Network error:**
- Inline error card: "Network error. Check your connection."
- Retry button

### Accessibility

- **Focus rings:** All interactive elements have `:focus-visible` outline
- **aria-label:** Icon-only buttons have `aria-label` (e.g., "Attach image")
- **Reduced motion:** Respect `prefers-reduced-motion` for animations
- **Keyboard nav:** Tab, Enter, Escape, Arrow keys work throughout
- **Contrast:** All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

### SEO & PWA

**Meta tags:**
```html
<meta name="description" content="One thread. Every model. A zero-backend BYOK AI chat harness." />
<meta property="og:title" content="Relay — One thread. Every model." />
<meta property="og:description" content="Swap models mid-conversation. Every answer carries its maker's badge." />
<meta property="og:image" content="/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#e4572e" />
```

**PWA manifest:**
```json
{
  "name": "Relay",
  "short_name": "Relay",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf6ef",
  "theme_color": "#e4572e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Favicon:** Refine current SVG (⟐ glyph) to be crisper at small sizes.

---

## 10. Testing Strategy

### Existing tests stay green

All 45 tests in `tests/` pass without changes (they test adapters, vault, state, lib).

### New tests (TDD for new features)

**Studio engine:**
- `tests/studio/engine.test.ts` — job creation, polling, retry, cancel
- `tests/studio/capabilities.test.ts` — capability detection heuristics

**IDE:**
- `tests/ide/buffers.test.ts` — open/close/update buffers
- `tests/ide/preview.test.ts` — srcdoc generation for HTML/CSS/JS

**UI components:**
- `tests/ui/sheet.test.tsx` — opens, closes, focus trap
- `tests/ui/dropdown.test.tsx` — opens, selects, closes

### Coverage target

- `lib/` ≥80% lines
- `adapters/` ≥80% lines
- `vault/` ≥80% lines
- `catalog/` ≥80% lines
- `studio/` ≥80% lines (new)
- `ide/` ≥80% lines (new)

### Manual QA checklist

- [ ] Wizard → unlock → provider expand → model pick → send message → streaming reply
- [ ] Attach image → vision model → image appears in message
- [ ] Generate image → Studio → image appears in gallery and thread
- [ ] Generate video → progress bar → video plays
- [ ] Code block → Open in IDE → editor + preview
- [ ] Lock/unlock → reload → persistence
- [ ] Mobile viewport → composer actions scroll, touch targets ≥44px
- [ ] Dark mode toggle → no FOUC
- [ ] CSP console → no errors

---

## 11. Deploy & Launch

### Build

- `npm run build` stays green
- Production bundle <500KB gzipped (currently 151KB, adding CodeMirror + lucide-react will increase)
- All assets self-hosted (no external requests except provider APIs)

### Deploy config

**GitHub Pages (current):**
- Workflow already configured in `.github/workflows/deploy.yml`
- `base: './'` in vite.config.ts works at root and subpath

**Cloudflare Pages (free, custom domain):**
- Add `docs/DEPLOY.md` with instructions:
  1. Connect GitHub repo
  2. Build command: `npm run build`
  3. Output directory: `dist`
  4. Custom domain: add CNAME record pointing to `<project>.pages.dev`

**Netlify (free, custom domain):**
- Add `netlify.toml`:
  ```toml
  [build]
    command = "npm run build"
    publish = "dist"
  ```
- Custom domain: add CNAME in Netlify dashboard

**Vercel (free, custom domain):**
- Add `vercel.json`:
  ```json
  {
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
  }
  ```

### Launch checklist

- [ ] README updated with new features (Studio, IDE)
- [ ] `docs/DEPLOY.md` written
- [ ] OG image created (1200x630px, Relay branding)
- [ ] PWA manifest + icons
- [ ] All meta tags
- [ ] `npm run build` green
- [ ] All tests pass
- [ ] Manual QA checklist complete

---

## 12. Success Criteria

**Functional:**
- User can generate images with DALL·E / gpt-image-1
- User can generate videos with Sora / Veo
- User can open code blocks in IDE, edit, preview, send back to thread
- All controls actually work (no fake/decorative buttons)
- Mobile-first: touch targets ≥44px, composer actions scroll

**Non-functional:**
- Build <500KB gzipped
- All tests pass, coverage ≥80% on logic dirs
- No CSP console errors
- No FOUC on dark mode toggle
- Fonts self-hosted (no Google Fonts requests)
- Icons are SVGs (no emojis)

**Deploy:**
- Deployed to GitHub Pages (or Cloudflare/Netlify/Vercel)
- Custom domain configured
- OG tags render correctly on social media

---

## Next Steps

1. **Write implementation plan** — break this spec into ordered tasks
2. **Phase 1: Foundation** — design system, UI primitives, shell rewrite
3. **Phase 2: Studio** — adapter extension, engine, UI
4. **Phase 3: IDE** — CodeMirror, preview, buffer management
5. **Phase 4: Reality pass** — fix bugs, audit controls, a11y, SEO
6. **Phase 5: Launch** — deploy config, docs, QA

---

**Approved:** 2026-08-24 by user  
**Spec written by:** primary coding agent  
**Next:** invoke `writing-plans` skill to create implementation plan
