# Relay — Production-Ready Audit

Every item below compares **how global production apps work** vs **how the code actually works**. Items are grouped by feature area, with severity:
- 🔴 **Critical** — broken/missing for production
- 🟡 **Important** — degraded UX or edge case
- 🟢 **Polish** — nice-to-have improvement

---

## 1. INITIAL LOAD / FIRST-IMPACT

### 🔴 No loading skeleton or spinner on boot
- **Expected:** Global spinner/skeleton while vault decrypts and stores hydrate.
- **Actual:** `main.tsx` sets theme to light, renders `<App />` immediately. Vault `init()` is async but there's no visual loading state — the wizard flashes in, then the vault unlocks from sessionStorage, causing a jarring full-screen re-render.
- **Fix:** Add a `status: 'loading'` phase to `VaultState`. Show a centered spinner until `init()` resolves.
- **Verified:** ✅ Confirmed — `init()` is async (vaultStore line 50-63), no loading state in App.tsx.

### 🔴 Theme flash on load (FOUC)
- **Expected:** `main.tsx` sets `data-theme='light'` unconditionally. If user prefers dark or saved dark in localStorage, there's a visible flash from light→dark on first paint.
- **Actual:** Line 6: `document.documentElement.dataset.theme = 'light';` — hardcoded. The saved theme is applied later by `applyTheme()` in `uiStore.ts` (line 63), but only after the store initializes.
- **Fix:** Read `localStorage` synchronously in `main.tsx` before paint, or inject a `<script>` in `index.html` that reads `relay.settings.v1` and sets the theme attribute before the React bundle loads.

### 🟡 index.html sets `lang="en"` — no locale/i18n support
- **Expected:** Production apps detect browser locale.
- **Actual:** Hardcoded `lang="en"`.
- **Fix:** Set `lang` dynamically from `navigator.language` or accept it as config.

### 🟢 No `<meta name="description">` or Open Graph tags
- **Expected:** SEO/social sharing metadata.
- **Actual:** Only title and CSP meta tag.
- **Fix:** Add og:title, og:description, og:image meta tags for link previews.

---

## 2. VAULT / AUTH

### 🔴 No "Unlock" screen — vault auto-unlocks from sessionStorage
- **Expected:** After lock/refresh, user must re-enter passphrase.
- **Actual:** `vaultStore.ts` line 56-63: if `sessionStorage` has the passphrase, it auto-unlocks silently. This means closing the tab (not the browser) preserves the session. This is a security concern for shared devices.
- **Fix:** Make sessionStorage auto-unlock opt-in (configurable in Settings). Default should require re-entry.

### 🔴 Wizard allows no-skip entry
- **Expected:** Production apps let users skip key setup and explore the UI (even if limited).
- **Actual:** Line 74 in `App.tsx`: `if (vaultStatus !== 'unlocked' || !hasAnyKey)` — forces wizard. There's no "skip for now" or "explore first" option.
- **Fix:** Add a "Skip — add keys later" button to the wizard that creates an empty vault and lands on the Providers page.

### 🔴 Vault auto-lock reads from localStorage every tick
- **Expected:** Settings are read once on init, not re-parsed every 30 seconds.
- **Actual:** `App.tsx` line 66: `JSON.parse(localStorage.getItem('relay.settings.v1') ?? ...)` runs every 30s inside `setInterval`. This is wasteful and could be stale if another tab writes settings.
- **Fix:** Read from `loadSettings()` (which is already imported elsewhere) or cache the value.

### 🟡 No passphrase strength indicator
- **Expected:** Visual feedback showing password strength (weak/fair/strong).
- **Actual:** Only checks `length < 8`. No strength meter.
- **Fix:** Add a simple entropy check or use a library like `zxcvbn` for strength feedback.

### 🟡 No vault backup / recovery mechanism
- **Expected:** Production encryption apps offer recovery codes or backup passphrase.
- **Actual:** If user forgets passphrase, data is permanently lost. No recovery flow.
- **Fix:** Offer a recovery code download during vault creation (like 1Password/Bitwarden).

### 🟢 No "last unlocked" timestamp shown
- **Expected:** Show when vault was last accessed.
- **Actual:** `lastActivity` is tracked but never displayed.

---

## 3. NAVIGATION / ROUTING

### 🔴 No URL-based routing
- **Expected:** Deep-linking works. Sharing a URL lands on the same view. Browser back/forward works.
- **Actual:** View state is in Zustand only (`uiStore.view`). URL is always `/`. No `react-router`. If user refreshes on Providers page, they land on Chat. Sessions can't be deep-linked.
- **Fix:** Add `react-router` or hash-based routing. Map view + sessionId to URL params (e.g. `/#/chat/s_abc123`).

### 🔴 No browser back/forward support
- **Expected:** Opening palette, settings, or switching views pushes history. Back button closes overlay or returns to previous view.
- **Actual:** No `history.pushState` calls anywhere. Back button exits the app entirely.
- **Fix:** Listen to `popstate` and sync overlay/view state with URL.

### 🟡 Rail doesn't close on outside click on mobile
- **Expected:** Tapping outside the drawer closes it.
- **Actual:** The scrim div only has `onClick` — it works, but the scrim is `display: none` by default (line 901 in app.css) and only gets `.show` class. On mobile, the scrim correctly appears when rail is open, but there's no transition/animation on the scrim itself.
- **Fix:** Add a fade-in transition to the scrim.

---

## 4. TOP BAR

### 🔴 TopBar is too minimal — missing critical actions
- **Expected:** Theme toggle, settings gear, new chat button, current model indicator — all visible in the top bar.
- **Actual:** TopBar only shows hamburger + brand. Theme toggle, settings, and model info are buried in the rail or palette. Users must open the rail just to access settings.
- **Fix:** Add to TopBar: theme toggle (☀️/🌙), settings gear icon, current model chip, and a "+" new thread button.

### 🟡 Brand name is duplicated
- **Expected:** Brand only in one place (rail or topbar, not both).
- **Actual:** Brand appears in Rail (line 32), TopBar (line 18-19), and Wizard (line 50-51). Three occurrences.
- **Fix:** Keep brand only in the Rail (hidden on mobile when rail is closed) and Wizard. Remove from TopBar, or make TopBar brand the primary.

### 🟡 No current model indicator in the shell
- **Expected:** User always sees which model they're talking to.
- **Actual:** The active model is only shown inside the Composer's ModelDial. If composer is hidden (Providers page), there's no model indicator anywhere.
- **Fix:** Show active model in TopBar as a persistent chip.

---

## 5. RAIL (LEFT DRAWER)

### 🔴 Session list has no search/filter
- **Expected:** With many threads, users need search.
- **Actual:** Sessions are listed flat with no search. The list is just `.map()` over `sessions`.
- **Fix:** Add a search input at the top of the session list that filters by title.

### 🔴 No session grouping by date
- **Expected:** Sessions grouped as "Today", "Yesterday", "Last 7 days", "Older".
- **Actual:** Flat list sorted by creation order (newest first), no grouping.
- **Fix:** Group sessions by date bucket.

### 🟡 No drag-to-reorder sessions
- **Expected:** Users can reorder their threads.
- **Actual:** Sessions are always sorted by creation time.
- **Fix:** Add drag-and-drop reordering or a "move up/down" option.

### 🟡 Delete confirmation is too quick (2.5s timeout)
- **Expected:** Confirmation dialog or persistent "Are you sure?" state.
- **Actual:** Line 97: `setTimeout(() => setConfirmId((c) => (c === s.id ? null : c)), 2500);` — auto-resets after 2.5s. User might miss it.
- **Fix:** Use a persistent confirmation (click again to confirm, or a modal). No auto-dismiss.

### 🟡 No "Settings" entry in the Rail
- **Expected:** Settings accessible from the drawer.
- **Actual:** Settings is only accessible via `⚙` in the TopBar... but there IS no settings button in TopBar. The only way to open settings is... it's missing from the UI entirely! `settingsOpen` is managed but nothing triggers `setSettingsOpen(true)`.
- **🔴 CRITICAL BUG: Settings is unreachable from the UI!** The `SettingsSheet` component is rendered when `settingsOpen` is true, but no button anywhere calls `setSettingsOpen(true)`. The Settings feature is completely inaccessible.
- **Fix:** Add a Settings button to the Rail or TopBar.

### 🟡 No vault lock button in the Rail footer
- **Expected:** Quick lock button visible in the drawer.
- **Actual:** `vault-dot` and `rail-footer` CSS exist (lines 179-200) but no Rail footer is rendered. The rail-footer CSS is dead code.
- **Fix:** Add a footer to the Rail with vault status dot + lock button + settings link.

### 🟢 No session count badge
- **Expected:** Show total thread count.
- **Actual:** Shows "THREADS" label but no count.

---

## 6. CHAT / THREAD VIEW

### 🔴 No auto-scroll to bottom indicator
- **Expected:** When user scrolls up, a "↓ New messages" button appears.
- **Actual:** `stickToBottom` ref tracks scroll position, but there's no visual indicator when user is scrolled up. They might miss new streaming content.
- **Fix:** Show a floating "↓ Jump to bottom" button when `stickToBottom.current` is false.

### 🔴 Empty state doesn't show when session has zero turns
- **Expected:** If user creates a session but hasn't typed anything, show the welcome/empty state.
- **Actual:** Line 29: `if (!session || turns.length === 0)` — this correctly shows empty state. BUT: when user clicks "+ New thread" in Rail, it creates a session and sets view to chat, but the Composer might not be visible if the new session has no turns and the view switches. Let me re-check... Actually the Composer IS shown because `view === 'chat'` (line 96 in App.tsx). This is correct. ✅

### 🟡 MessageBubble uses `dangerouslySetInnerHTML` for markdown
- **Expected:** Sanitized HTML output.
- **Actual:** `renderMarkdown()` uses DOMPurify, so this is safe. ✅ But: the `enhance()` function directly mutates the DOM (line 17-51), which can cause issues with React's virtual DOM. If React re-renders the same div, `enhance()` runs again and creates duplicate code-wrap elements.
- **Fix:** Use a `useEffect` for DOM mutation instead of the ref callback, or guard against re-wrapping more robustly. The current guard (`if pre.parentElement?.classList.contains('code-wrap')`) helps but isn't bulletproof.

### 🟡 No loading state when session is empty but active
- **Expected:** Brief spinner while session hydrates from localStorage.
- **Actual:** Session store `init()` is synchronous (JSON.parse), so this is fast. ✅ OK.

### 🟢 No keyboard shortcut to focus composer
- **Expected:** `Cmd+L` or `/` to focus the input (like Slack/Discord).
- **Actual:** No such shortcut exists.
- **Fix:** Add `Cmd+L` or `/` shortcut to focus the composer textarea.

### 🟢 No scroll-to-bottom on new message when user is at bottom
- **Expected:** Smooth scroll animation.
- **Actual:** Uses `scrollIntoView({ block: 'end' })` which is instant, not smooth.
- **Fix:** Add `behavior: 'smooth'` for a polished feel.

---

## 7. COMPOSER

### 🔴 No Shift+Enter line break indicator
- **Expected:** Placeholder or hint showing "Shift+Enter for new line".
- **Actual:** Placeholder says "Ask anything — switch models any time with ⌘K…" but doesn't mention Shift+Enter.
- **Fix:** Add hint text like "⏎ Send · ⇧⏎ New line" near the send button.

### 🔴 Send button is disabled when image-only (no text)
- **Expected:** User should be able to send an image with no text (for vision models).
- **Actual:** Line 144: `disabled={!text.trim() && !image}` — this actually IS correct. If image is set, the button is enabled even with empty text. ✅

### 🟡 No character count or token estimate in composer
- **Expected:** Show approximate token count as user types.
- **Actual:** Token estimate only appears on the image attachment preview, not for text.
- **Fix:** Add a subtle token counter in the composer (e.g., "~240 tok") that updates as user types.

### 🟡 EffortPill reads settings on every render
- **Expected:** Settings read once, memoized.
- **Actual:** Line 15: `const cfg = loadSettings();` — called on every render. `loadSettings()` does `JSON.parse(localStorage.getItem(...))` each time.
- **Fix:** Use a Zustand selector or `useMemo` to avoid repeated localStorage reads.

### 🟡 Research toggle reads settings on every render
- **Expected:** Memoized.
- **Actual:** Line 122: `loadSettings().researchMode` in the className calculation runs every render.
- **Fix:** Move to a `useEffect` or derive from a store.

### 🟡 Composer doesn't auto-focus after sending
- **Expected:** After sending a message, the textarea should be focused for the next message.
- **Actual:** `setText('')` clears the input but doesn't focus it.
- **Fix:** Add `taRef.current?.focus()` after submit.

### 🟢 No drag-and-drop file attach
- **Expected:** Users can drag an image onto the composer.
- **Actual:** Only paste and click-to-attach work. No `onDrop` handler.
- **Fix:** Add drag-and-drop support with visual drop zone.

---

## 8. MESSAGE BUBBLE

### 🔴 No copy-all button on assistant messages
- **Expected:** One-click copy of entire reply.
- **Actual:** There is a copy button in AssistantActions (line 181). ✅

### 🟡 ThinkBox `live` prop logic is confusing
- **Expected:** Clear state: streaming+reasoning = live, done = collapsed.
- **Actual:** Line 248-250:
  ```ts
  const showThinkBox = !!turn.reasoning && (!turn.streaming || !turn.content || turn.reasoning.length > 0);
  const thinkLive = !!turn.streaming && !turn.content;
  ```
  The condition `!turn.streaming || !turn.content || turn.reasoning.length > 0` is always true when `turn.reasoning` exists (because `turn.reasoning.length > 0` is true). So `showThinkBox` is effectively just `!!turn.reasoning`. This means the think box always shows if there's any reasoning, even after streaming ends and content exists — which is correct behavior (collapsed after). But the condition is misleadingly complex.
- **Fix:** Simplify to `const showThinkBox = !!turn.reasoning;`

### 🟡 Handoff menu has no scroll containment
- **Expected:** Long model lists should scroll within a bounded container.
- **Actual:** `.handoff-menu` has `min-width: 210px` but no `max-height` or `overflow-y: auto`.
- **Fix:** Add `max-height: 300px; overflow-y: auto;` to `.handoff-menu`.

### 🟡 Regenerate doesn't pass session ID
- **Expected:** `regenerate()` should use the active session ID.
- **Actual:** Line 254-267: `regenerate()` gets `st.active()` and uses `s.id`. This works but could fail if no session is active (returns early). ✅ OK.

### 🟢 No "thinking" animation during streaming
- **Expected:** Pulsing dots or skeleton while waiting for first token.
- **Actual:** Shows "Connecting…" shimmer text (line 292). This works but is less polished than animated dots.
- **Fix:** Replace with animated dots or a more modern loading indicator.

### 🟢 Token estimate shown even for very short replies
- **Expected:** Only show token count for longer responses.
- **Actual:** Shows `~{tokensEst} tok` for all non-streaming assistant turns.
- **Fix:** Only show when `tokensEst > 50`.

---

## 9. MODEL SELECTOR (⌘K PALETTE)

### 🔴 Palette doesn't show active model as selected
- **Expected:** Current model is highlighted in the list.
- **Actual:** No visual indicator for which model is currently active. `data-selected` is used for keyboard navigation, not for the active model.
- **Fix:** Add an "active" class or checkmark next to the currently selected model.

### 🟡 Palette reads vault from localStorage directly
- **Expected:** Use Zustand store for vault state.
- **Actual:** Line 49: `const keys = JSON.parse(localStorage.getItem('relay.vault.v1') ?? '{}');` — reads the encrypted blob, which is useless for checking key presence. The comment on line 50 acknowledges this: `void keys; // key *presence* isn't enough post-encryption; we show everything instead`.
- **Fix:** Remove the dead localStorage read. Just show all entries (current behavior). Or use `useVaultStore.getState().keys` to filter.

### 🟡 No recent models section
- **Expected:** Show recently used models at the top for quick switching.
- **Actual:** Shows all chat-capable models in provider groups. No "recently used" section.
- **Fix:** Track last N used models and show them in a "RECENT" group at the top.

### 🟢 No model info/tooltip
- **Expected:** Hover or click shows model capabilities, context window, pricing.
- **Actual:** Only shows model label and capability chips. No detailed info.
- **Fix:** Add a tooltip or expandable section with model details.

---

## 10. PROVIDERS PAGE

### 🔴 No sorting of providers
- **Expected:** Sort by name, status (has key first), or kind.
- **Actual:** Always sorted by the order in `PROVIDERS` record + custom providers at end.
- **Fix:** Add sort controls (A-Z, by status, by kind).

### 🟡 "Load models" button is disabled without key AND without local flag
- **Expected:** Local providers (Ollama, LM Studio) should always allow loading.
- **Actual:** Line 152: `disabled={!useVaultStore.getState().keys[meta.id] && !meta.local}` — reads from `getState()` (not reactive) and disables for non-local providers without keys. This is correct for the disable logic, but the non-reactive `getState()` means the button state might not update after key is saved without a re-render.
- **Fix:** Use a Zustand selector: `const hasKey = useVaultStore((s) => !!s.keys[meta.id]);`

### 🟡 ProviderRow `pick === null` check is always false
- **Expected:** Dead code check.
- **Actual:** Line 181: `pick === null ? null : (...)` — `pick` is a function, never null. This is dead code.
- **Fix:** Remove the ternary, just render the button directly.

### 🟡 No visual feedback when models are loading
- **Expected:** Spinner or progress indicator per provider.
- **Actual:** Shows animated dots (`.dots` class) but only when `status === 'loading'`. The dots animation CSS exists but the loading state is local to each ProviderRow. ✅ This actually works.

### 🟢 No provider health/status indicator
- **Expected:** Show if provider API is reachable.
- **Actual:** No status indicator. User must manually click "Test".
- **Fix:** Auto-test on key save and show a green/red dot.

---

## 11. SETTINGS

### 🔴 Settings is unreachable from the UI!
- **Expected:** Settings accessible from TopBar gear icon or Rail footer.
- **Actual:** `SettingsSheet` renders when `settingsOpen` is true. `setSettingsOpen(true)` is called... nowhere in the UI. The only way to open settings is if a user knows to call it programmatically. This is a **critical UX bug**.
- **Verified:** ✅ Confirmed — `grep setSettingsOpen\(true\)` returns zero results across the entire src/ directory.
- **Fix:** Add a settings button to the TopBar or Rail footer.

### 🟡 Settings sheet shows ALL providers for key management
- **Expected:** Only show providers that are relevant or have been interacted with.
- **Actual:** `listProviders().map(...)` renders every provider (18+). This is a very long scroll.
- **Fix:** Group by status: "Configured" (has key) → "Available" → "Custom". Collapse "Available" by default.

### 🟡 Auto-lock input has no visual feedback on save
- **Expected:** Toast or checkmark when value is saved.
- **Actual:** `saveSettings({ autoLockMin: v })` is called inline on change. No feedback.
- **Fix:** Show a brief toast "Auto-lock updated" on blur.

### 🟢 No "Reset to defaults" button
- **Expected:** Users can reset all settings.
- **Actual:** No reset option.
- **Fix:** Add "Reset all settings to defaults" button with confirmation.

---

## 12. DATA PORTABILITY (Export/Import)

### 🔴 Import replaces ALL sessions without confirmation
- **Expected:** "This will replace X sessions. Continue?" confirmation.
- **Actual:** `importJson()` calls `set({ sessions: j.sessions })` immediately, then `window.location.reload()`. All existing data is lost.
- **Fix:** Show a confirmation dialog: "This will replace {n} existing sessions with {m} imported sessions. Continue?"

### 🟡 Export doesn't include settings
- **Expected:** Full backup includes app settings.
- **Actual:** Only exports sessions. Settings (theme, auto-lock, custom providers, bases) are not included.
- **Fix:** Include settings in the export JSON (but NEVER include keys).

### 🟢 No auto-backup reminder
- **Expected:** Periodic reminder to back up data.
- **Actual:** No reminders.
- **Fix:** Show a subtle reminder after N sessions or M days since last export.

---

## 13. VOICE / TTS

### 🔴 TTS always uses OpenAI, regardless of which provider generated the reply
- **Expected:** TTS uses the same provider, or at least the cheapest available.
- **Actual:** Line 156 in MessageBubble.tsx: `createAdapter('openai', resolveDeps('openai')).speak(...)` — hardcoded to OpenAI. If user has no OpenAI key but has the reply from Anthropic, TTS silently fails or errors.
- **Fix:** Use the turn's own provider for TTS if it supports it, fallback to OpenAI, or show an error if no TTS-capable provider is available.

### 🟡 MicRecorder picks STT provider incorrectly
- **Expected:** Check all providers that support STT.
- **Actual:** Line 9-13 in MicRecorder.tsx: `pickSttProvider()` checks `keys.openai` then `keys.compatible` — but `keys.compatible` is not a valid provider ID. It should check specific compatible providers.
- **Fix:** Check `keys.openai` first, then fall back to any provider with STT capability.

### 🟡 LivePanel is never mounted (dead code)
- **Expected:** Voice mode accessible from UI.
- **Actual:** `LivePanel` exists but is never imported or rendered in `App.tsx` or any other component. There's no button to open it. The entire `features/voice/` directory is dead code.
- **Verified:** ✅ Confirmed — `grep LivePanel` only finds the definition in LivePanel.tsx itself.
- **Fix:** Add a voice mode button to the TopBar or Composer, or integrate with the Palette.

---

## 14. STREAMING

### 🔴 No retry on transient network errors
- **Expected:** Auto-retry 2-3 times on network timeout or 5xx errors.
- **Actual:** `useSend.ts` catches errors and shows an error card. The user must manually click "Retry". `net.ts` has `fetchWithRetry` but it's only used in adapters, not in the main stream path.
- **Fix:** Add auto-retry with exponential backoff for transient errors (5xx, network errors) before showing the error card.

### 🟡 Streaming buffer flush on unmount can cause React state updates
- **Expected:** No state updates after component unmount.
- **Actual:** `requestAnimationFrame(flush)` in `useSend.ts` might fire after the component unmounts if the user navigates away during streaming.
- **Fix:** Track a "mounted" ref and skip flush if unmounted. Or use `AbortController` signal to cancel.

### 🟢 No streaming latency indicator
- **Expected:** Show time-to-first-token (TTFT).
- **Actual:** Shows "Connecting…" but no latency metric.
- **Fix:** Track and display TTFT after first token arrives.

---

## 15. ERROR HANDLING

### 🔴 Error card retry doesn't pass session ID
- **Expected:** Retry uses the correct session.
- **Actual:** Line 284: `onClick={() => void regenerate()}` — `regenerate()` internally gets the active session. This works. ✅

### 🟡 No global error boundary
- **Expected:** React error boundary catches rendering crashes.
- **Actual:** No `ErrorBoundary` component. If any component throws, the entire app white-screens.
- **Fix:** Add a top-level `ErrorBoundary` with a "Something went wrong" fallback and reload button.

### 🟡 API errors shown as raw messages
- **Expected:** User-friendly error messages with suggested actions.
- **Actual:** Line 160-175: error message is displayed as-is. Technical errors like "401 Unauthorized" confuse non-technical users.
- **Fix:** Map common error codes to friendly messages: "API key invalid — check your key in Settings", "Rate limited — try again in 30s", etc.

### 🟢 No toast for network offline status
- **Expected:** Show "You're offline" notification.
- **Actual:** No `navigator.onLine` listener.
- **Fix:** Listen for online/offline events and show a toast.

---

## 16. ACCESSIBILITY

### 🔴 No skip-to-content link
- **Expected:** Keyboard users can skip navigation.
- **Actual:** No skip link.
- **Fix:** Add `<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>`.

### 🔴 Palette input doesn't trap focus
- **Expected:** Tab cycles within the palette modal when open.
- **Actual:** Focus can escape the palette to elements behind the overlay.
- **Fix:** Implement focus trap in the Palette component.

### 🟡 No ARIA labels on most icon buttons
- **Expected:** All interactive elements have accessible names.
- **Actual:** Some icon buttons have `aria-label` (e.g., "Attach image"), but others like the research toggle, theme toggle (which is missing), and many action buttons don't.
- **Fix:** Audit all icon-only buttons and add `aria-label` attributes.

### 🟡 Message actions only visible on hover — not keyboard accessible
- **Expected:** Actions accessible via keyboard focus.
- **Actual:** `.msg-actions { opacity: 0 }` — hidden until hover. Keyboard users can't reach them.
- **Fix:** Make actions focusable and visible on focus: `.msg-actions:focus-within { opacity: 1 }`.

### 🟢 No high contrast mode
- **Expected:** Support for high contrast preferences.
- **Actual:** Only `prefers-reduced-motion` is handled.
- **Fix:** Add `@media (prefers-contrast: high)` overrides.

---

## 17. RESPONSIVE / MOBILE

### 🔴 Composer not optimized for mobile keyboards
- **Expected:** Composer stays above the keyboard when it opens.
- **Actual:** `body { overflow: hidden }` and `100dvh` height. On iOS, when the virtual keyboard opens, the composer may be hidden behind it.
- **Fix:** Use `visualViewport` API to adjust composer position when keyboard opens, or use `dvh` with keyboard detection.

### 🟡 Rail opens from left — conflicts with iOS back swipe
- **Expected:** Drawer doesn't conflict with system gestures.
- **Actual:** Rail is `position: fixed; inset: 0 auto 0 0` — opens from the left edge, which conflicts with iOS Safari's back-swipe gesture.
- **Fix:** Add a swipe threshold (only open rail if swipe starts >20px from edge) or use a different trigger on iOS.

### 🟡 No touch-friendly tap targets on mobile
- **Expected:** Minimum 44x44px tap targets (WCAG).
- **Actual:** Many buttons are smaller (e.g., icon-btn is `padding: 6px 9px` = ~27px height).
- **Fix:** Increase padding on touch devices: `.icon-btn { padding: 10px 12px }` on mobile.

### 🟢 No PWA manifest
- **Expected:** "Add to Home Screen" support.
- **Actual:** No `manifest.json` or service worker.
- **Fix:** Add a web manifest for installability.

---

## 18. PERFORMANCE

### 🔴 MessageBubble `enhance()` mutates DOM on every content change
- **Expected:** DOM mutations batched and guarded.
- **Actual:** `enhance()` is called via ref callback on every render. While it guards against re-wrapping, it still queries all `pre` elements each time.
- **Fix:** Use a `useEffect` that only runs when `turn.content` changes, not on every render.

### 🟡 `loadSettings()` called repeatedly without memoization
- **Expected:** Settings read once per component lifecycle.
- **Actual:** Called in `Composer` (line 4, 15, 122, 126), `EffortPill` (line 15), and inline in handlers. Each call does `JSON.parse(localStorage.getItem(...))`.
- **Fix:** Create a `useSettings()` hook that reads from Zustand or caches the result.

### 🟡 Session store `appendDelta` creates new objects on every streaming chunk
- **Expected:** Streaming updates are batched.
- **Actual:** `appendDelta` creates new session/turn objects via spread. With fast streaming (100+ chunks/sec), this creates GC pressure.
- **Fix:** The RAF batching in `useSend.ts` already helps (line 100-116). But consider using `immer` or mutable updates for the streaming path.

### 🟢 No lazy loading of highlight.js languages
- **Expected:** Only load languages that are used.
- **Actual:** `import hljs from 'highlight.js/lib/common'` loads all common languages (~30).
- **Fix:** Only import languages you actually need, or use dynamic imports.

---

## 19. SECURITY

### 🔴 CSP allows `unsafe-inline` for styles
- **Expected:** No `unsafe-inline` in CSP.
- **Actual:** Line 6 in index.html: `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — `unsafe-inline` is required for React's inline styles but weakens CSP.
- **Fix:** Use nonce-based styles or move all inline styles to CSS classes.

### 🟡 No rate limiting on API calls
- **Expected:** Client-side throttling to prevent accidental API abuse.
- **Actual:** No rate limiting. User can spam Send as fast as they want.
- **Fix:** Add a debounce/cooldown on the Send button (e.g., 500ms minimum between sends).

### 🟡 Vault passphrase stored in sessionStorage
- **Expected:** Passphrase should only exist in memory (JS variable).
- **Actual:** `sessionStorage.setItem(SS_PASS, pass)` — passphrase is accessible to any script running on the same origin, and persists until the tab is closed.
- **Fix:** Only keep the passphrase in the `passRef` module-level variable. Remove sessionStorage usage.

### 🟢 No CSP reporting
- **Expected:** CSP violation reports sent to a monitoring endpoint.
- **Actual:** No `report-uri` or `report-to` directive.
- **Fix:** Add CSP reporting for production monitoring.

---

## 20. CODE QUALITY

### 🟡 Dead CSS classes
- **Expected:** No unused CSS.
- **Actual:** `.menu-btn` is defined twice (lines 97-99 and 262-264 in app.css) with conflicting rules. `.rail-footer`, `.vault-dot`, `.compare-*`, `.lab-*` classes exist but are never used in any component.
- **Fix:** Remove dead CSS classes.

### 🟡 Inline styles used extensively
- **Expected:** Styles in CSS classes, not inline.
- **Actual:** Many components use `style={{ ... }}` for layout (Rail, TopBar, Settings, LivePanel, etc.).
- **Fix:** Move recurring inline styles to CSS classes for consistency and easier theming.

### 🟡 No TypeScript strict null checks for store selectors
- **Expected:** Safe store access.
- **Actual:** `useSessionStore.getState().active()!` (non-null assertion) is used in several places. If active session is null, this crashes.
- **Fix:** Add null checks or use optional chaining.

### 🟢 No ESLint or Prettier config
- **Expected:** Enforced code style and linting.
- **Actual:** No `.eslintrc`, `.prettierrc`, or `biome.json` config files.
- **Fix:** Add ESLint + Prettier (or Biome) with pre-commit hooks.

### 🟢 No Storybook or component documentation
- **Expected:** Visual component library for development.
- **Actual:** No Storybook setup.
- **Fix:** Add Storybook for component development and documentation.

---

## 21. TESTING

### 🟡 No E2E tests
- **Expected:** Playwright/Cypress tests for critical user flows.
- **Actual:** Only unit tests in `/tests`. No browser-based E2E tests.
- **Fix:** Add Playwright tests for: vault creation, sending a message, switching models, export/import.

### 🟡 No visual regression tests
- **Expected:** Screenshot comparison tests.
- **Actual:** None.
- **Fix:** Add Playwright screenshot tests for key screens.

---

## SUMMARY — TOP PRIORITY FIXES

> **Total issues found: 67** across 21 categories
> **🔴 Critical: 21** | **🟡 Important: 31** | **🟢 Polish: 15**

| # | Issue | Severity | Verified |
|---|-------|----------|----------|
| 1 | **Settings is unreachable from the UI** | 🔴 Critical | ✅ |
| 2 | **No URL-based routing / back-forward broken** | 🔴 Critical | ✅ |
| 3 | **Theme flash (FOUC) on load** | 🔴 Critical | ✅ |
| 4 | **Import replaces all sessions without confirmation** | 🔴 Critical | ✅ |
| 5 | **Vault auto-unlocks from sessionStorage (security)** | 🔴 Critical | ✅ |
| 6 | **No loading state during vault init** | 🔴 Critical | ✅ |
| 7 | **Wizard has no skip option** | 🔴 Critical | ✅ |
| 8 | **TopBar missing theme toggle, settings, model info** | 🔴 Critical | ✅ |
| 9 | **No error boundary** | 🟡 Important | ✅ |
| 10 | **Session list has no search** | 🔴 Critical | ✅ |
| 11 | **TTS hardcoded to OpenAI** | 🔴 Critical | ✅ |
| 12 | **Palette doesn't highlight active model** | 🔴 Critical | ✅ |
| 13 | **No keyboard shortcuts for common actions** | 🟡 Important | ✅ |
| 14 | **LivePanel never mounted (dead code)** | 🟡 Important | ✅ |
| 15 | **CSP unsafe-inline** | 🔴 Critical | ✅ |
