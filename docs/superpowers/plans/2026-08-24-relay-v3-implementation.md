# Relay v3 Implementation Plan

**Goal:** Rewrite UI layer for production quality, add Studio (image/video gen) and IDE (code artifacts), fix bugs, deploy-ready.

**Architecture:** Keep core engine (adapters/vault/state/catalog/lib). Rewrite UI (styles/features). Add new modules (ui primitives, studio, ide). Mobile-first, NextChat-inspired patterns.

**Tech Stack:** React 18, Vite, TypeScript, Zustand, lucide-react (icons), @fontsource-variable (fonts), @codemirror/* (editor)

## Global Constraints

- Build must stay green every commit (`npm run build`)
- All 45 existing tests stay green
- Coverage ≥80% on logic dirs (lib, adapters, vault, catalog, studio, ide)
- Production bundle <500KB gzipped
- No emojis in UI (use lucide-react SVGs)
- Mobile-first: touch targets ≥44px, composer scrolls horizontally
- Self-hosted fonts (no Google Fonts requests)
- CSP-compliant (no inline scripts except where hash is in CSP)

---

## Phase 1: Foundation

### Task 1: Install dependencies

- Install: `lucide-react`, `@fontsource-variable/space-grotesk`, `@fontsource-variable/jetbrains-mono`
- Commit: `chore: add icon and font dependencies`

### Task 2: Self-hosted fonts

- Remove Google Fonts `<link>` from `index.html`
- Import fonts in `src/main.tsx`
- Verify no 404s in network tab
- Commit: `feat: self-host fonts via fontsource`

### Task 3: Fix CSP theme-boot bug

- Move inline theme script from `index.html` to `public/theme-boot.js`
- Update CSP meta to allow `script-src 'self'` (already there)
- Test: dark mode toggle, no FOUC, no CSP errors
- Commit: `fix: move theme-boot script to external file, fix CSP violation`

### Task 4: Design tokens

- Rewrite `src/styles/tokens.css` with spacing scale (4px grid), typography, motion tokens
- Keep existing color tokens (paper, ink, accent, etc.)
- Add: `--space-1` through `--space-12`, `--r-sm/md/lg`, `--duration-fast/normal`
- Commit: `feat: expand design tokens with spacing scale`

### Task 5: UI primitives

- Create `src/ui/` directory
- Build: `Button`, `IconButton`, `Sheet`, `Dialog`, `Dropdown`, `Input`, `Textarea`, `Chip`, `Skeleton`
- Each component: typed props, a11y (aria-label, focus rings), theme-aware
- Commit: `feat: add UI primitive components`

### Task 6: Shell layout (desktop)

- Rewrite `src/features/shell/` (Rail, TopBar, Wizard)
- Desktop: left sidebar (280px) + main content area
- Sidebar sections: Threads, Providers, Studio (collapsible)
- Mobile: sidebar becomes drawer (hamburger toggle)
- Use new UI primitives
- Commit: `feat: rewrite shell layout with sidebar + main content`

### Task 7: Composer rewrite

- Rewrite `src/features/composer/Composer.tsx`
- Layout: textarea + horizontal action row (icons + labels)
- Actions: Attach, Voice, Effort, Research, Live, Image, Video, Model, Send
- Auto-grow textarea (2-8 rows)
- Action row scrolls horizontally on mobile
- Disabled state when no active model
- Commit: `feat: rewrite composer with visible action row`

### Task 8: Replace emoji icons

- Replace all emoji in UI with lucide-react icons
- Affected: Rail, TopBar, Composer, MessageBubble, Palette, SettingsSheet
- Icons: Paperclip, Mic, Zap, Search, Headphones, Image, Video, Hash, ArrowRight, Settings, Lock, Moon, Sun, Menu, X, Plus, etc.
- Commit: `feat: replace emoji icons with lucide-react SVGs`

---

## Phase 2: Studio (Image/Video Generation)

### Task 9: Extend adapter contract

- Add `generateImage?()` and `generateVideo?()` to `ProviderAdapter` interface
- Types: `ImageGenOpts`, `ImageResult`, `VideoGenOpts`, `VideoJob`
- Commit: `feat: extend adapter contract with image/video generation`

### Task 10: OpenAI adapter implementation

- Implement `generateImage`: POST `/v1/images/generations` (DALL·E 3, gpt-image-1)
- Implement `generateVideo`: POST `/v1/videos` (Sora), poll status, fetch content
- Add `getVideoJobStatus()` and `getVideoContent()` helpers
- Tests: mock fetch, verify request/response shape
- Commit: `feat: implement OpenAI image/video generation`

### Task 11: Google adapter implementation

- Implement `generateVideo`: POST to Veo endpoint, poll operation, fetch video URI
- Tests: mock fetch, verify polling
- Commit: `feat: implement Google Veo video generation`

### Task 12: Capability heuristics

- Extend `catalog/normalize.ts` with `detectCapabilities()`
- Patterns: `image` (dall-e, flux, sdxl), `video` (sora, veo), `vision` (gpt-4o, claude-3), `reasoning` (o1, thinking)
- Tests: verify detection for known model IDs
- Commit: `feat: add capability detection for image/video models`

### Task 13: Studio store

- Create `src/studio/studioStore.ts` (zustand)
- State: `jobs: GenerationJob[]`
- Methods: `createJob()`, `cancelJob()`, `updateJob()`
- Types: `GenerationJob` (id, type, status, progress, result, error)
- Tests: create job, update status, cancel
- Commit: `feat: add studio store for generation job management`

### Task 14: Studio engine

- Create `src/studio/engine.ts`
- `createGenerationJob()`: dispatch to adapter, handle image (sync) or video (poll)
- `pollUntilComplete()`: poll video job status, update progress, handle failure
- Retry logic for network errors
- Tests: mock adapter, verify polling flow
- Commit: `feat: add studio generation engine with polling`

### Task 15: Studio UI

- Create `src/features/studio/StudioPage.tsx`
- Route: `/studio` (full page on mobile, replaces thread on desktop)
- Gallery grid of generated images/videos
- "New Generation" sheet: type selector, model picker, prompt, options, generate button
- Rich bubbles in thread: image grid, video player
- Commit: `feat: add Studio UI with generation gallery`

---

## Phase 3: IDE (Code Artifacts)

### Task 16: Install CodeMirror

- Install: `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`
- Commit: `chore: add CodeMirror dependencies`

### Task 17: IDE store

- Create `src/ide/ideStore.ts` (zustand)
- State: `buffers: IDEBuffer[]`
- Methods: `openBuffer()`, `closeBuffer()`, `updateBuffer()`
- Types: `IDEBuffer` (id, messageId, code, language, unsavedChanges)
- Tests: open/close/update buffers
- Commit: `feat: add IDE store for buffer management`

### Task 18: IDE editor component

- Create `src/ide/Editor.tsx`
- CodeMirror setup with language detection (JS/HTML/CSS)
- Dark/light theme support
- `onChange` callback to update store
- Commit: `feat: add CodeMirror editor component`

### Task 19: IDE preview component

- Create `src/ide/Preview.tsx`
- Sandboxed iframe with `srcdoc`
- Language detection: HTML → raw, CSS → `<style>`, JS → `<script>`
- Commit: `feat: add live preview component`

### Task 20: IDE UI

- Create `src/ide/IDEPage.tsx`
- Desktop: right panel (50% width) alongside thread
- Mobile: full-page route
- Toggle: Edit / Preview
- Actions: Copy, Download, Send to thread
- Commit: `feat: add IDE UI with editor and preview`

### Task 21: Code block integration

- Update `src/lib/markdown.ts` post-pass
- Add "Open in IDE" + "Preview" buttons to code blocks (HTML/JSX/CSS)
- Wire up to IDE store (open buffer on click)
- Commit: `feat: add IDE triggers to code blocks`

---

## Phase 4: Reality Pass

### Task 22: Audit controls

- Effort toggle: verify maps to OpenAI `reasoning_effort` and Anthropic `thinking` budget
- Research toggle: show warning if no Exa key
- Voice buttons: hide if model doesn't support voice
- Image attach: hide if model isn't vision-capable
- Live voice: only show if model matches `/realtime/`
- Commit: `fix: audit and fix all control visibility and behavior`

### Task 23: Empty & error states

- No active model: composer disabled, "Pick a model" hint
- No API key: inline error in thread, "Add key in Settings" CTA
- Rate limit: inline error card with countdown
- Network error: inline error card with retry button
- Commit: `feat: add empty and error states`

### Task 24: Accessibility

- Focus rings on all interactive elements (`:focus-visible`)
- `aria-label` on icon-only buttons
- Respect `prefers-reduced-motion`
- Keyboard navigation (Tab, Enter, Escape, Arrows)
- Contrast: verify WCAG AA (4.5:1 normal text, 3:1 large)
- Commit: `feat: add accessibility improvements`

### Task 25: SEO & PWA

- Meta tags: description, OG, Twitter card, theme-color
- PWA manifest: name, icons, theme_color
- Favicon: refine SVG for small sizes
- Commit: `feat: add SEO meta tags and PWA manifest`

---

## Phase 5: Launch

### Task 26: Deploy docs

- Create `docs/DEPLOY.md`
- Instructions for: GitHub Pages, Cloudflare Pages, Netlify, Vercel
- Custom domain setup (CNAME records)
- Commit: `docs: add deployment guide`

### Task 27: Update README

- Add Studio and IDE to features list
- Update architecture diagram
- Add screenshots
- Commit: `docs: update README with v3 features`

### Task 28: Coverage sweep

- Run `npm test -- --coverage`
- Fill gaps until ≥80% on all logic dirs
- Commit: `test: coverage sweep to 80%+`

### Task 29: Final QA

- Manual QA checklist (from spec §10)
- Fix any issues found
- Commit: `fix: final QA fixes`

### Task 30: Launch

- `npm run build` green
- All tests pass
- Deploy to GitHub Pages
- Custom domain configured (if user provides domain)
- OG tags render on social media
- Commit: `chore: production launch`

---

## Execution Strategy

**Phase 1 (Foundation):** Implement inline, task-by-task, committing after each.

**Phase 2-3 (Studio, IDE):** Implement inline, TDD for engine/store, UI last.

**Phase 4-5 (Reality, Launch):** Implement inline, audit-driven.

**Verification:** After each phase, run `npm run build` and `npm test`. Commit only when green.
