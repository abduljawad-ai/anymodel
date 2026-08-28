# Relay UI Architecture Blueprint

## Phase 1: App Analysis

### Identity
- **What**: BYOK (Bring Your Own Key) AI chatbot. Users plug in API keys for OpenAI, Anthropic, Google, etc. and chat from browser. No server middleman.
- **Category**: Communication / AI tool
- **Name**: Relay
- **Mood**: Calm, professional, fast, minimal chrome. Content-first.
- **Brand voice**: Terse, direct. No marketing fluff.

### Audience
- **Primary users**: Developers, power users, AI enthusiasts
- **Technical level**: Intermediate to expert
- **Primary device**: Desktop (60%), Mobile (30%), Tablet (10%)
- **Context**: Focused work sessions, quick lookups, iterative conversations
- **Mental models**: ChatGPT, Claude, Cursor, VS Code — they expect a chat canvas with model selection

### Core Workflows (ranked by frequency)
1. **Send a message, get a reply** — 90% of sessions. Trigger: user types. Steps: type → send → stream response. Critical: MUST work flawlessly.
2. **Switch models** — 40% of sessions. Trigger: want different capability. Steps: Cmd+K → search → select. Critical: fast, keyboard-first.
3. **Start new thread** — 30% of sessions. Trigger: new topic. Steps: click new or Cmd+Shift+O. Critical: instant.
4. **Manage API keys** — one-time setup + occasional. Trigger: first use or new provider. Steps: settings → add key. Critical: clear feedback.
5. **Review conversation history** — 20% of sessions. Trigger: return to topic. Steps: rail → search/click thread. Critical: fast retrieval.
6. **Configure settings** — rare. Trigger: change behavior. Steps: settings → adjust. Critical: discoverable.

### Screen Inventory
| Screen | Purpose | Layout |
|--------|---------|--------|
| Chat (primary) | Conversation canvas + input | Single pane, scrollable |
| Providers | Manage API keys + models | List with expand |
| Settings | App configuration | Bottom sheet, sections |
| Model Palette | Quick model switcher | Centered modal |
| Wizard | First-run vault setup | Centered card |
| Keyboard Shortcuts | Reference overlay | Centered modal |
| Prompt Library | Template browser | Centered modal |

### Design Language
- **Visual**: Minimal flat, warm tones, content-forward
- **Colors**: Warm off-white (#faf6ef) / espresso (#14120f), signal orange accent (#e4572e)
- **Typography**: Space Grotesk (UI) + JetBrains Mono (code)
- **Spacing**: 4px grid
- **Radius**: 6-8px (rounded rectangles)
- **Elevation**: Subtle shadows, no heavy layers
- **Dark mode**: Full support via tokens

---

## Phase 2: Architecture Decisions

### Shell: Sidebar + Main (Pattern A)
**Reasoning**: Desktop-primary app with 2 navigation destinations (Chat, Providers). Sidebar shows conversation history — the primary navigation. Main area is the chat canvas. On mobile, sidebar collapses to overlay.

### Navigation: Sidebar (persistent on desktop, drawer on mobile)
**Reasoning**: Conversation history IS navigation. Users need to see threads. 2 top-level destinations (Chat, Providers) fit in sidebar. Settings/Model switch are overlays, not pages.

### Component Shape: Rounded rectangles (8px radius)
**Reasoning**: Professional but approachable. Consistent with warm color palette. Not too playful (pill), not too sharp (2px).

### Information Hierarchy: Master-Detail
**Reasoning**: List of threads (master) → conversation (detail). Standard chat pattern. Users expect this from ChatGPT/Claude.

### Density: Comfortable
**Reasoning**: Power users but not data-dense. Clear spacing between messages, generous tap targets.

### Motion: Subtle + Functional
**Reasoning**: Professional tool. Motion conveys state (sidebar slide, sheet slide-up, fade-in overlays). No bounces. 150-250ms durations.

---

## Phase 3: Complete Component Tree

```
App
├── [Vault Locked] Wizard
│   ├── VaultGate (create/unlock)
│   │   ├── Logo
│   │   ├── PassphraseInput (×2 for create)
│   │   ├── SubmitButton
│   │   └── ResetButton (unlock only)
│   └── KeySetup (after create)
│       ├── ProviderKeyInput (×6 quick providers)
│       ├── SkipButton
│       └── StartButton
│
├── [Vault Unlocked] Shell
│   ├── Rail (sidebar)
│   │   ├── RailHeader
│   │   │   └── CloseButton
│   │   ├── NewThreadButton
│   │   ├── NavGroup
│   │   │   ├── NavItem: Chat
│   │   │   └── NavItem: Providers
│   │   ├── ThreadSection
│   │   │   ├── SectionHeader: "THREADS"
│   │   │   ├── SearchInput
│   │   │   └── ThreadList
│   │   │       └── ThreadItem (×N)
│   │   │           ├── PinButton
│   │   │           ├── Title + Time
│   │   │           └── DeleteButton (2-click confirm)
│   │   └── RailFooter
│   │       ├── VaultChip
│   │       └── LockButton
│   │
│   ├── Scrim (mobile overlay backdrop)
│   │
│   ├── MainArea
│   │   ├── TopBar
│   │   │   ├── MenuToggle (mobile only)
│   │   │   ├── Brand
│   │   │   └── TopBarActions
│   │   │       ├── ModelChip (opens Palette)
│   │   │       ├── ThemeToggle
│   │   │       └── SettingsButton
│   │   │
│   │   ├── ViewArea (switches between views)
│   │   │   ├── [view=chat] ThreadView
│   │   │   │   ├── EmptyState
│   │   │   │   │   ├── Heading: "How can I help you today?"
│   │   │   │   │   ├── Subtext with Cmd+K hint
│   │   │   │   │   ├── SuggestionGrid (2×2 cards)
│   │   │   │   │   │   └── SuggestionCard (×4)
│   │   │   │   │   └── SetupButton
│   │   │   │   ├── ThreadActions (copy all, export)
│   │   │   │   ├── MemoryChip (if compacted)
│   │   │   │   └── MessageList
│   │   │   │       └── MessageBubble (×N)
│   │   │   │           ├── [user] UserMessage
│   │   │   │           │   ├── Image (if attached)
│   │   │   │           │   ├── Text
│   │   │   │           │   └── UserActions (hover)
│   │   │   │           │       ├── EditButton
│   │   │   │           │       ├── CopyButton
│   │   │   │           │       └── ShareButton
│   │   │   │           └── [assistant] AssistantMessage
│   │   │   │               ├── ModelBadge
│   │   │   │               ├── StreamingChip (if streaming)
│   │   │   │               ├── ErrorCard (if error)
│   │   │   │               │   ├── ErrorMessage
│   │   │   │               │   └── RetryButton
│   │   │   │               ├── ThinkBox (collapsible)
│   │   │   │               │   ├── ToggleButton
│   │   │   │               │   └── Content
│   │   │   │               ├── MarkdownContent
│   │   │   │               ├── TokenCount (if >50)
│   │   │   │               └── AssistantActions (hover)
│   │   │   │                   ├── CopyButton
│   │   │   │                   ├── RegenerateButton
│   │   │   │                   ├── ShareButton
│   │   │   │                   ├── ThumbsUp
│   │   │   │                   ├── ThumbsDown
│   │   │   │                   └── TTSButton
│   │   │   │
│   │   │   └── [view=providers] ProvidersPage
│   │   │       ├── Heading: "Providers & models"
│   │   │       ├── SearchInput
│   │   │       └── ProviderList
│   │   │           ├── ProviderRow (×N)
│   │   │           │   ├── RowHeader (click to expand)
│   │   │           │   │   ├── TintDot
│   │   │           │   │   ├── Name
│   │   │           │   │   ├── KindChip
│   │   │           │   │   ├── StatusChip (key/no key)
│   │   │           │   │   └── Chevron
│   │   │           │   └── RowDetail (expanded)
│   │   │           │       ├── BaseURL
│   │   │           │       ├── GetKeyLink
│   │   │           │       ├── KeyControls
│   │   │           │       │   ├── [no key] SetAPIKeyButton
│   │   │           │       │   ├── [has key] TestButton
│   │   │           │       │   └── [has key] RemoveKeyButton
│   │   │           │       ├── ModelControls
│   │   │           │       │   └── LoadRefreshButton
│   │   │           │       ├── ModelGrid (if loaded)
│   │   │           │       │   └── ModelChip (×N)
│   │   │           │       └── SuggestedModels (if not loaded)
│   │   │           │           └── ModelChip (×N)
│   │   │           └── AddProviderRow
│   │   │               ├── [collapsed] "+ Add custom provider"
│   │   │               └── [expanded] AddForm
│   │   │                   ├── NameInput
│   │   │                   ├── BaseURLInput
│   │   │                   ├── SaveButton
│   │   │                   └── CancelButton
│   │   │
│   │   └── Composer (sticky bottom, chat view only)
│   │       ├── TextArea (auto-sizing)
│   │       ├── ComposerRow
│   │       │   ├── AttachButton (opens file picker)
│   │       │   ├── ImagePreview (if attached)
│   │       │   │   └── RemoveButton
│   │       │   ├── MicRecorder
│   │       │   │   ├── [idle] MicButton
│   │       │   │   └── [recording] RedDot + Timer + CancelButton
│   │       │   ├── PromptLibrary
│   │       │   │   ├── TriggerButton (BookOpen icon)
│   │       │   │   └── [open] Modal
│   │       │   │       ├── SearchInput
│   │       │   │       └── PromptList (filtered)
│   │       │   │           └── PromptCard (×N)
│   │       │   ├── HiddenFileInput
│   │       │   └── SendStopButton
│   │       │       ├── [idle] SendButton (ArrowUp icon)
│   │       │       └── [streaming] StopButton (Square icon)
│   │       └── (image paste handler on inner container)
│   │
│   ├── [paletteOpen] Palette (lazy, centered modal)
│   │   ├── SearchInput
│   │   ├── ModelList
│   │   │   ├── FavoritesSection (if no search)
│   │   │   │   └── ModelRow (×N)
│   │   │   ├── ProviderGroup (×N, filtered)
│   │   │   │   └── ModelRow (×N)
│   │   │   │       ├── StarButton (favorite toggle)
│   │   │   │       ├── ModelName
│   │   │   │       ├── CapabilityChips
│   │   │   │       └── CurrentBadge (if active)
│   │   │   └── LoadableRow (×N, for unloaded providers)
│   │   │       └── LoadButton
│   │   └── KeyboardHint (footer)
│   │
│   ├── [settingsOpen] SettingsSheet (lazy, bottom sheet)
│   │   ├── SheetHeader
│   │   │   ├── Title: "Settings"
│   │   │   └── CloseButton
│   │   ├── Section: API Keys
│   │   │   ├── SectionToggle (chevron)
│   │   │   ├── StoredKeyRow (×N)
│   │   │   │   ├── TintDot + Name + "stored"
│   │   │   │   └── RemoveButton
│   │   │   ├── [empty] "No keys stored" message
│   │   │   └── AddKeyForm
│   │   │       ├── [collapsed] "+ Add key" button
│   │   │       └── [expanded] ProviderSelect + KeyInput + Save + Cancel
│   │   ├── Section: Favorite Models
│   │   ├── Section: Custom Instructions
│   │   ├── Section: Split-key Custody
│   │   ├── Section: Data
│   │   │   └── DataPort
│   │   │       ├── ExportBackupButton
│   │   │       ├── ImportBackupButton
│   │   │       └── ExportThreadButton
│   │   ├── Section: App
│   │   │   ├── AutoLockInput
│   │   │   └── ContextBudgetInput
│   │   ├── Section: Advanced
│   │   │   └── BaseURLOverrides (×N compatible providers)
│   │   └── LockVaultButton
│   │
│   ├── [shortcutsOpen] KeyboardShortcuts (centered modal)
│   │   ├── CloseButton
│   │   └── ShortcutList
│   │       └── ShortcutRow (×7)
│   │
│   ├── OnboardingTooltips (only if no keys)
│   │   ├── Overlay
│   │   └── Card
│   │       ├── StepIndicator
│   │       ├── Content
│   │       ├── NextButton
│   │       └── SkipButton
│   │
│   └── ToastStack (bottom center)
│       └── Toast (×N)
│           └── Message + CloseButton
```

---

## Phase 4: Navigation Flow

```
                    ┌─────────────┐
                    │   App Load  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Vault Check │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │   Empty   │ │Locked │ │ Unlocked  │
        │  (Create) │ │(Unlock)│ │  (Shell)  │
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐       │
        │ Key Setup │ │  ...  │       │
        └─────┬─────┘ └───────┘       │
              │                        │
              └────────────┬───────────┘
                           │
                    ┌──────▼──────┐
                    │    Shell    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │  Rail   │      │  Main   │      │ Overlays│
    │ (sidebar)│      │  Area   │      │ (modals)│
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
    ┌────┼────┐      ┌────┼────┐      ┌────┼────┐
    │    │    │      │    │    │      │    │    │
  Nav Thread Search Top  View Com-  Palette Set- Short-
  Items List  Input Bar  Area poser        tings cuts
    │    │                │
    │    │           ┌────┼────┐
    │    │           │         │
    │    │        Chat      Providers
    │    │        View       Page
    │    │           │
    │    │      ┌────┼────┐
    │    │      │         │
    │    │   Empty    Message
    │    │   State     List
    │    │              │
    │    │         MessageBubble
    │    │              │
    │    │         ┌────┼────┐
    │    │         │         │
    │    │       User     Assistant
    │    │       Msg       Msg
```

---

## Phase 5: Screen-by-Screen Specifications

### Screen 1: Chat View (Primary)

```
┌──────────────────────────────────────────────────────────┐
│ ≡  ⟐ Relay                    [Model Chip]  🌙  ⚙️     │  ← TopBar (48px)
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    How can I help you today?              │  ← Empty state
│                    Press ⌘K to pick a model              │
│                                                          │
│    ┌──────────────┐  ┌──────────────┐                    │
│    │  Explain     │  │  Debug my    │                    │  ← Suggestion grid
│    │  quantum     │  │  React code  │                    │     (2×2, clickable)
│    │  computing   │  │              │                    │
│    └──────────────┘  └──────────────┘                    │
│    ┌──────────────┐  ┌──────────────┐                    │
│    │  Write a     │  │  Compare     │                    │
│    │  Python      │  │  React vs    │                    │
│    │  script      │  │  Vue         │                    │
│    └──────────────┘  └──────────────┘                    │
│                                                          │
│                    [Set up providers →]                   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Message your AI…                              📎 🎤 ✏ │ │  ← Composer
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**With messages:**
```
┌──────────────────────────────────────────────────────────┐
│ ≡  ⟐ Relay                    [Model Chip]  🌙  ⚙️     │
├──────────────────────────────────────────────────────────┤
│                            [Copy all] [Export] [mem ×2]  │  ← Thread actions
│                                                          │
│  ┌─────────────────────────────────────────┐             │
│  │ What is React?                          │  ← User msg │
│  └─────────────────────────────────────────┘    (right)  │
│                                                          │
│  ┌─────────────────────────────────────────┐             │
│  │ ● openai/gpt-4         [copy][redo]...  │  ← Asst msg│
│  │ ───────────────────────────────────────  │    (left)  │
│  │ React is a JavaScript library for       │             │
│  │ building user interfaces...             │             │
│  │                                         │             │
│  │ [think ▸] 128 tokens                   │             │
│  │                                         │             │
│  └─────────────────────────────────────────┘             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Message your AI…                              📎 🎤 ✏ │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Screen 2: Providers Page

```
┌──────────────────────────────────────────────────────────┐
│ ≡  ⟐ Relay                    [Model Chip]  🌙  ⚙️     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Providers & models                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Search providers… (e.g. groq, openrouter, ollama) │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ● OpenAI          [openai] [no key]              ▸     │  ← Row (collapsed)
│  ● Anthropic       [anthropic] [no key]           ▸     │
│  ● Google Gemini   [google] [no key]              ▸     │
│  ● Groq            [compat] [🔑 stored]           ▾     │  ← Row (expanded)
│  │                                                        │
│  │  https://api.groq.com/openai    get key ↗            │
│  │  [Test]  [Remove key]  [Load models]                 │
│  │                                                        │
│  │  [gpt-4o] [gpt-4o-mini] [llama-3.1-70b] ...         │
│  │                                                        │
│  ● DeepSeek        [compat] [no key]              ▸     │
│  ● Mistral AI      [compat] [no key]              ▸     │
│  ...                                                      │
│                                                          │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  ＋ Add custom provider                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Screen 3: Model Palette (Modal)

```
                    ┌────────────────────────────────┐
                    │ 🔍 Search models…              │
                    ├────────────────────────────────┤
                    │ ⭐ Favorites                    │
                    │   ★ gpt-4o           openai    │
                    │   ★ claude-3.5      anthropic │
                    ├────────────────────────────────┤
                    │ OpenAI                         │
                    │   gpt-4o            [current]  │
                    │   gpt-4o-mini                  │
                    │   gpt-4-turbo                  │
                    ├────────────────────────────────┤
                    │ Anthropic                      │
                    │   claude-3.5-sonnet            │
                    │   claude-3-opus                │
                    ├────────────────────────────────┤
                    │ Groq                  [Load →] │
                    │   (models not loaded yet)      │
                    ├────────────────────────────────┤
                    │ ↑↓ navigate  Enter select  Esc close │
                    └────────────────────────────────┘
```

### Screen 4: Settings (Bottom Sheet)

```
┌────────────────────────────────────────┐
│  Settings                        [X]  │
├────────────────────────────────────────┤
│  ▾ API keys                  [1 stored]│
│  ┌──────────────────────────────────┐  │
│  │ ● Groq  stored         [Remove] │  │
│  │ [+ Add key]                      │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  ▸ ☆ Favorite models                   │
├────────────────────────────────────────┤
│  ▸ Custom instructions                 │
├────────────────────────────────────────┤
│  ▸ Split-key custody (relay-gate)      │
├────────────────────────────────────────┤
│  ▸ Data                                │
├────────────────────────────────────────┤
│  ▸ App                                 │
├────────────────────────────────────────┤
│  ▸ Advanced — base URL overrides       │
├────────────────────────────────────────┤
│  [🔒 Lock vault]                       │
└────────────────────────────────────────┘
```

### Screen 5: Wizard (First Run)

```
┌────────────────────────────────────────┐
│                                        │
│              ⟐ Relay                   │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │     Step 1/2                     │  │
│  │     Vault Passphrase             │  │
│  │                                  │  │
│  │     [________________________]   │  │
│  │     [________________________]   │  │
│  │                                  │  │
│  │     [Create vault]              │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

---

## Phase 6: Responsive Breakpoints

```
Mobile:    < 768px   — Rail as overlay, smaller fonts, full-width composer
Tablet:    768-1023  — Rail as overlay, normal fonts
Desktop:   ≥ 1024px  — Rail persistent (260px), content fills rest
Wide:      ≥ 1440px  — Max-width content (760px) centered
```

### Mobile Layout
```
┌──────────────────────┐
│ ☰  ⟐ Relay   🌙 ⚙️ │  ← TopBar (hamburger visible)
├──────────────────────┤
│                      │
│   Chat content       │
│   (full width)       │
│                      │
├──────────────────────┤
│ [Message input]  📎  │  ← Composer (simplified)
└──────────────────────┘

[Toggle ☰ → slides Rail overlay from left]
```

### Desktop Layout
```
┌────────┬──────────────────────────────────┐
│ Rail   │ ⟐ Relay        [Chip]  🌙  ⚙️   │
│ 260px  ├──────────────────────────────────┤
│        │                                  │
│ Nav    │        Chat content              │
│ Threads│        (max 760px centered)      │
│        │                                  │
│        ├──────────────────────────────────┤
│ [Vault]│ [Message input]          📎 🎤 ✏│
└────────┴──────────────────────────────────┘
```

---

## Phase 7: Animation Specifications

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Rail (mobile) | slideX from -100% to 0 | 220ms | ease |
| Scrim | fadeIn opacity 0→0.35 | 150ms | ease |
| Sheet (settings) | slideY from 100% to 0 | 200ms | ease |
| Dialog (palette) | fadeIn opacity 0→1 | 150ms | ease |
| Toast | slideY from 20px to 0 + fadeIn | 200ms | ease |
| Streaming cursor | blink opacity 0→1 | 530ms | step-end |
| Loading dots | dotpulse scale 0.6→1 | 1.2s | ease infinite |
| Thread actions | fadeIn opacity 0→1 | 100ms | ease |
| Provider expand | maxHeight + fadeIn | 200ms | ease |
| Reduced motion | All above → instant (no animation) | 0ms | — |

---

## Phase 8: Color Token Map

```css
/* Light */
--paper: #faf6ef      /* background */
--surface: #fff       /* cards, inputs */
--ink: #191714        /* primary text */
--muted: #8a8279      /* secondary text */
--accent: #e4572e     /* brand orange */
--ok: #3d8b62         /* success */
--err: #c23b22        /* error */
--hairline: #e8e2d8   /* borders */

/* Dark */
--paper: #14120f
--surface: #1e1c18
--ink: #f3ede2
--muted: #8a8279
--accent: #ff6a3d     /* brighter orange */
--ok: #5aad7a
--err: #e85d4a
--hairline: #2e2b26
```

---

## Phase 9: Typography Scale

```
--font-ui: Space Grotesk Variable, system-ui, sans-serif
--font-mono: JetBrains Mono Variable, ui-monospace, monospace

--text-xs:   12px / 16px   (badges, hints)
--text-sm:   13px / 18px   (secondary labels)
--text-base: 14px / 20px   (body, messages)
--text-lg:   16px / 24px   (headings, nav)
--text-xl:   18px / 28px   (section titles)
--text-2xl:  22px / 28px   (page headings)
```

---

## Phase 10: Spacing Scale (4px grid)

```
--sp-0:  0
--sp-1:  4px    (tight gap)
--sp-2:  8px    (default gap)
--sp-3:  12px   (comfortable gap)
--sp-4:  16px   (section gap)
--sp-5:  24px   (large gap)
--sp-6:  32px   (page padding)
--sp-7:  48px   (hero spacing)
```

---

## Implementation Order

1. **Design tokens** (tokens.css) — all CSS variables
2. **UI primitives** (Button, IconButton, Input, Chip) — reusable components
3. **Shell layout** (App, TopBar, Rail) — app skeleton
4. **ThreadView + MessageBubble** — core chat experience
5. **Composer** — message input
6. **Model Palette** — model switching
7. **ProvidersPage + ProviderRow** — provider management
8. **SettingsSheet** — configuration
9. **Wizard** — first-run experience
10. **Overlays** (Shortcuts, PromptLibrary, Onboarding) — extras
11. **Responsive polish** — mobile/tablet breakpoints
12. **Animations** — motion system
