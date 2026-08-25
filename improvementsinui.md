# improvementsinui.md

Running audit of frontend flows, errors, and poor UI patterns.
(Read-only audit — nothing edited except this file.)

---

## Found — pass 1 (shell, thread, composer, settings, palette, app.css)

### 🔴 Bugs / broken behavior

1. **Scrim behind the rail can never appear (CSS kill-order bug).**
   In `src/styles/app.css`, `.scrim { display: none; }` is declared *later* in a standalone block, while `.scrim.show { … }` (declared earlier) never sets `display`. Result: even with `railOpen`, the scrim stays `display:none` → no dimming AND no click-outside-to-close (a `display:none` element gets no pointer events). The rail's only close paths are the X button / Esc / nav clicks.
   *Fix:* give `.scrim.show` `display: block;` or move the `display:none` base rule before it.

2. **Suggestion-card clicks may never enable Send (React state bypass).**
   `ThreadView.tsx` fills the composer by doing `ta.value = s.text` + `dispatchEvent(new Event('input'))` directly on the DOM node. This bypasses the Composer's React `text` state, so:
   - the Send button (disabled unless `text.trim()`) can stay disabled while text visibly sits in the box;
   - pressing Enter looks like it works (keydown handler reads… nothing — `submit()` reads React state, which is still `''`) → message silently drops the typed-in text.
   Fragile hack even where it happens to work. *Fix:* lift composer draft into a store (or expose an imperative handle) instead of poking the DOM.

3. **iOS zoom-on-focus contradiction.**
   `app.css` mobile media query: `.composer textarea { font-size: 15px; } /* >=16px prevents iOS zoom */` — the comment states the fix but the value is below 16px, so Safari iOS will still zoom the viewport when focusing the composer.

4. **SettingsSheet reports false success for model loading.**
   `saveKey()` does `await ensureModels(p).catch(() => {})` then unconditionally flashes `✓ saved · models ready`. If loading failed (bad key, network), the user is told everything is ready. The earlier `✓ saved — loading models…` also never shows an error path.

5. **Ctrl+N / ⌘N shortcut mostly won't fire.**
   Browsers reserve Ctrl+N (Chrome/Edge) and ⌘N (macOS) — the page never receives it. The empty state / docs imply shortcuts that will silently do nothing for most users. Consider Ctrl/Cmd+Shift+O or similar.

6. **Duplicate CSS definitions overriding each other.**
   - `.tint-dot` declared twice (8px version, then 7px version further down) — the second silently wins everywhere.
   - `.dial-btn` declared twice (once bare, once with border/padding).
   - `.model-chip`, `.user-edit` also duplicated.
   Classic specificity/cascade accidents waiting to happen; consolidate.

7. **`regenerate()` no-op patch.**
   `st.patchTurn(s.id, last.id, {})` before deleting the turn is a pointless store write (renders the thread for nothing). Same pattern appears in `editAndResend`.

8. **Streaming state polled with `setInterval(200ms)` in Composer.**
   `anyActive()` polling means the Stop button can lag up to ~200 ms behind reality, and the timer runs forever even when idle. A store subscription/event would make Stop instant and remove the busy-loop.

9. **Per-frame markdown re-render + DOM surgery during streaming.**
   `MessageBubble` runs `renderMarkdown` on every content change and `enhance()` re-highlights/re-wraps `<pre>`s via direct DOM mutation inside a `dangerouslySetInnerHTML` container. Long streamed answers with code cause repeated highlight.js work and visible flicker; the `data-hlzed` guard dies as soon as React resets innerHTML.

10. **Palette "Load models" rows are mouse-only.**
    Keyboard navigation (`↑↓`/Enter) indexes only `flat` model entries; the "⇩ Load X models" rows can't be selected via keyboard despite being focusable buttons — inconsistent with the palette's own footer hint ("↵ select").

11. **Delete-session confirm state never resets.**
    Rail: click 🗑 → "sure?" stays armed indefinitely (until another row is clicked or deleted). No timeout, and switching rows leaves the previous one armed. Also `.session-del` is `opacity:0` but still focusable — keyboard users tab onto invisible buttons.

12. **Save-on-blur + toast spam in Settings.**
    Custom instructions and Gate URL save on blur and toast "saved" even when nothing changed; temperature slider writes settings on *every* drag tick. No debounce, no dirty check, no undo.

13. **`editAndResend(sid!, …)` null-safety.**
    Non-null assertion on `activeId`; if the active session vanished mid-edit this throws. Same class of `active()!` assertions throughout `useSend.ts`.

14. **`aria-live="polite"` on the whole `<main className="view-area">`.**
    Every streamed token/turn change becomes a candidate live-region announcement — screen readers get flooded. There's already a dedicated `#aria-announcer` used for completion; the live region on `main` should go.

### 🟡 Flow / UX rough edges

15. **Stop-vs-Send swap hides queued intent.** While streaming, the Send button is replaced by Stop; there is no way to queue/compose the next message text and send-on-stop (text is kept, but Enter is ignored with no feedback — a hint like "streaming…" would help).

16. **Feedback buttons over-promise.** 👍/👎 toast "Thanks — noted"/"helps tuning", but feedback is stored locally only and used nowhere. Copy implies telemetry that doesn't exist.

17. **TTS availability check is narrow.** `hasTtsKey` only checks `keys.openai`, and `speak()` hardcodes OpenAI + `tts-1` + voice `alloy` — no voice choice, no indication of cost/length limits for long replies.

18. **Model chip shows raw model IDs.** TopBar chip renders `activeModel.modelId` verbatim (`gpt-4o-2024-08-06` style); long IDs crowd the topbar on mobile with no truncation/ellipsis, and labels (friendly names from the catalog) are unused here.

19. **Palette dialogs lack proper semantics.** No `role="dialog"` focus trap (Tab escapes into background UI), no `aria-modal`, list isn't `listbox`/`option` with `aria-activedescendant`; selection is conveyed only visually via `data-selected`.

20. **Toasts overlap the composer.** `.toasts` sits `bottom: 18px` center-screen — exactly on top of the composer on small viewports, covering the input right when errors ("Add a key first") appear.

21. **Dead CSS weight.** Large sections for views that no longer exist (compare, lab, studio, IDE panel, handoff menu, mode-pop, reason-pill/details.reason vs the newer think-box) ship in `app.css`. Increases confusion (e.g., two competing reasoning UIs styled) and maintenance risk.

22. **Empty-state iconography mismatch.** Suggestion cards use emoji (✍️🧠💡🛠️) while the rest of the app uses lucide icons — reads as inconsistent.

23. **`document.querySelector('.composer textarea')` / `'.view-area'` string coupling.** Multiple features reach across components by CSS selector; rename/refactor breaks them silently.

24. **Memory compaction is invisible & unconsented cost.** Summarization calls the same paid model mid-send; the only UI trace is a tiny `memory ×n` chip with raw text in `title`. Users discover token spend indirectly.

---

## Found — pass 2 (stores, wizard, vault, providers, composer widgets, data port)

### 🔴 Bugs / broken behavior

25. **Wizard "Step 2 — add keys" is unreachable after creating a vault.**
    `createVault()` sets `status: 'unlocked'`, and `App` renders the Wizard *only* while `vaultStatus !== 'unlocked'`. So the moment step 1 completes, the whole Wizard unmounts and the user lands in the chat shell with zero keys (the `mode === 'keys'` branch plus the `window.location.reload()` hacks in `skipToApp` / "Start chatting" are workarounds around this). First-run users never see the guided key setup.

26. **Deep links to a thread are broken on load.**
    `initRouting()` runs at `uiStore` module-import time and calls `setActive(sessionId)` from the hash — but `sessionStore.init()` hasn't loaded sessions yet, and when it does it overwrites `activeId` with `sessions[0].id`. A shared/opened `#/chat/s_123` URL always opens the first thread instead.

27. **Mic can stay hot after unmount.**
    `MicRecorder`'s cleanup effect only clears the timer; if the component unmounts mid-recording (switch session/view), neither the `MediaRecorder` nor the captured `MediaStream` tracks are stopped — recording continues silently with no UI.

28. **ProvidersPage reads key state via `getState()` during render.**
    The "Load models" button's `disabled={!useVaultStore.getState().keys[meta.id] && !meta.local}` won't re-render when a key is added/removed — stale disabled state until an unrelated rerender. Should be a store subscription like `hasKey` already is one row above.

29. **Wizard `saveAndTest` can hang on "testing…" forever.**
    No try/catch around `setKey`/`testConnection`; if anything throws (storage quota, crypto error) the rejection is unhandled and the status label stays at `testing…`. No busy guard either — double-click fires parallel tests.

30. **Stale hash after deleting the active session.**
    `deleteSession` falls back `activeId → sessions[0]` without rewriting the URL hash, which still points at the deleted id. Navigating back/forward later re-selects a nonexistent session → empty-state screen even though threads exist.

31. **Composer Enter silently swallowed while streaming.**
    `if (!streaming) submit()` — pressing Enter during generation drops the send with no feedback whatsoever (no toast, no queue). At minimum hint "waiting for the current reply…" or queue the message.

32. **Failed image attach gives zero feedback.**
    `ImageAttach.pick()` catch does `setImage(null)` silently — user clicks attach, nothing happens, no error. Same for the paste handler's `.catch(() => {})` in Composer.

33. **Native `alert`/`confirm`/`window.confirm` scattered through flows.**
    DataPort import uses `alert()` + `window.confirm()`, Wizard reset uses `window.confirm` — jarring next to the app's own toast/dialog system (which exists: `ui.css` ships `.ui-dialog` primitives that go unused).

34. **Settings sheet Esc handled twice.**
    `App`'s global Escape closes settings AND `SettingsSheet` adds its own window-level Escape listener. Harmless today but a double-handling trap for future changes.

35. **Palette model list computed once at mount (`useMemo([], )`) + `tick` counter hack** — fragile refresh path; any new code path that loads models without firing `onModelsChanged` shows a stale palette.

36. **`regenerate()`/error Retry assumes last turn is the errored assistant turn.**
    If the user switches sessions between the failure and clicking Retry (error cards persist per-turn), `regenerate()` operates on whatever session is now active — retrying the wrong conversation or no-oping.

37. **Providers page `autoFocus` search input steals focus + pops the mobile keyboard immediately** on every visit to the tab.

### 🟡 Flow / UX rough edges

38. **Two competing design systems shipped together.**
    `app.css` has ad-hoc `.btn` / `.chip` / `.field`, while `ui/ui.css` defines proper primitives (`.ui-btn`, `.ui-chip`, `.ui-input`…) — and both are used interchangeably (Rail uses `ui/Button`, everything else uses raw `.btn`). Visual drift guaranteed; also `.ui-sheet`/`.ui-dialog` primitives exist while SettingsSheet hand-rolls its own `.sheet` markup.

39. **Desktop default-open rail overlays content.**
    `railOpen = window.innerWidth >= 1024` at boot, but the rail is a fixed overlay drawer (not a push layout) at all sizes — on desktop the first paint covers 280px of the thread until dismissed, with the broken scrim making it feel like a rendering glitch.

40. **STT/TTS provider choice hardcoded.**
    Mic transcription hardcodes `whisper-1` via openai/compatible only; TTS hardcodes `tts-1` + voice `alloy`. No voice/model pickers, and Groq (which offers Whisper) is ignored despite being a first-class provider.

41. **Paste replaces existing attachment silently** — attaching image B by paste overwrites image A with no confirmation or multi-attach support.

42. **DataPort export copy inaccuracy:** caption says backups contain "conversations and settings", but `exportJson()` exports sessions only — settings (theme, custom instructions, temperature, gate URL) are not in the file. Restoring a backup does not restore your setup.

43. **Export filename derived from thread title** — a title of pure symbols/spaces collapses to `-YYYYMMDD.md`; minor, but worth a fallback name.

44. **History growth from routing:** every session click / view change `pushState`s, so Back walks through every navigation instead of leaving the app; combined with #30 the back stack contains dead session ids.

45. **`aria-live="polite"` ToastStack is good**, but toasts auto-dismiss in 3.5 s regardless of length/content and errors (e.g., "Add a X key first") get the same treatment as success confirmations — error toasts should stick longer or offer an action link to Settings.

---

## Summary counts so far

- 🔴 likely-real bugs / broken flows: 18 items (#1–#8, #10–#14, #25–#32, #35–#36)
- 🟡 rough edges / inconsistencies: 15+ items
- Recurring themes: **CSS cascade accidents** (duplicates, kill-order), **React-state bypasses via DOM poking**, **stale `getState()` reads in render**, **silent failure paths** (empty catches, false-success flashes), **native dialogs vs in-app system**, **dead/duplicated CSS & dual design systems**.

