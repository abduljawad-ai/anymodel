1. APP SHELL & NAVIGATION
Header (mobile)
- Element: .header
- Children:
- .brand (logo with "A" inside)
- #btnMenu (hamburger menu button)
- .key-dot-btn (key status indicator)
- #capStrip (capability strip)
- .cap-chip-live (individual capability chips)
Header (desktop)
- Element: .header-desktop
- Children:
- .brand (logo with "A" inside)
- #btnMenuDesktop (hamburger menu button)
- #keyBtnDesktop (key status button)
- #capStripDesktop (capability strip)
Sidebar / drawer
- Element: .sidebar
- Children:
- .sidebar-head (header with brand/logo)
- #btnSidebarNewChat (new chat button)
- #sidebarList (session list)
- .sidebar-foot (footer with settings and key dot)
- #btnSidebarSettings (settings button)
- #sidebarKeyDot (key status dot)
Sidebar scrim/overlay
- Element: .sidebar-scrim
App container/layout
- Element: .app
- Children:
- .header (mobile header)
- .header-desktop (desktop header)
- .main-col (main content column)
- .sidebar (sidebar/drawer)
2. SIDEBAR ELEMENTS
New chat button
- Element: #btnSidebarNewChat
- Icon: SVG plus sign
Session list items
- Element: .session-row
- Children:
- .session-title (session title)
- .session-actions (action buttons)
- .session-rename (rename input, if active)
Session rename input
- Element: .session-rename-input
- Attributes:
- type="text"
- maxlength="80"
Session rename confirm
- Element: .session-act.session-rename-ok
- Icon: Checkmark (✓)
Session rename cancel
- Trigger: Escape key or clicking outside the input
Session delete button
- Element: .session-act[data-act="delete"]
- Icon: Trash can (🗑️)
Session delete confirm
- Behavior: Clicking delete twice confirms deletion
Settings button
- Element: #btnSidebarSettings
- Icon: Gear (⚙️)
Theme toggle button
- Element: #themeToggle
- Icons:
- ☀️ (light mode)
- 🌙 (dark mode)
Key status dot
- Element: #sidebarKeyDot
- States:
- .on (key present)
- No class (no key)
Close sidebar button
- Element: #sidebarClose
- Icon: SVG X
Brand/logo area
- Element: .sidebar-brand
- Children:
- .brand-glyph (logo with "A")
- .sidebar-brand-name (brand name)
3. CHAT AREA
Empty state container
- Element: #emptyState
- Children:
- .empty-state (empty state content)
- .suggestion-grid (suggestion chips)
Empty state logo/glyph
- Element: .empty-state .glyph
- Content: "A" inside a colored circle
Empty state title
- Element: .empty-state h1
- Content: "anymodel"
Empty state subtitle
- Element: .empty-state p
- Content: "Bring your own key"
Suggestion chips (list each one)
- Element: .suggestion
- Children:
- b (suggestion title)
- span (suggestion description)
Message rows (user, assistant, system)
- Elements:
- .msg.user (user message)
- .msg.assistant (assistant message)
- .msg.system (system message)
User avatar
- Element: .msg.user .avatar
- Content: "U"
Assistant avatar
- Element: .msg.assistant .avatar
- Content: 🤖
System avatar
- Element: .msg.system .avatar
- Content: "!"
User message bubble
- Element: .msg.user .bubble
- Styles:
- Background: --bg-message-user
- Border radius: 18px 18px 4px 18px
- Shadow: --shadow-sm
Assistant message bubble
- Element: .msg.assistant .bubble
- Styles:
- Background: transparent
- Border: none
- Border radius: 0
- Padding: 20px 0
- Font size: 16px
- Line height: 1.6
System message bubble
- Element: .msg.system .bubble
- Styles:
- Background: --accent-wash
- Color: --accent
- Border radius: 10px
- Font size: 12px
- Padding: 7px 11px
Typing indicator (3 dots)
- Element: .typing
- Children:
- span (three dots with blinking animation)
Streaming cursor (blinking bar)
- Element: .type-cursor
- Styles:
- Height: 1.1em
- Background: --accent
- Animation: cursorBlink
Thinking/reasoning block
- Element: .thinking-block
- Children:
- .thinking-header (header with collapse chevron)
- .thinking-content (content with collapsible animation)
Thinking header (collapsible)
- Element: .thinking-header
- Children:
- ::before (chevron that rotates on collapse)
Thinking expand/collapse chevron
- Element: .thinking-header::before
- Content: "▼" (rotates to "▶" when collapsed)
Phase indicator window
- Element: .phase-window
- Children:
- .phase-item (phase indicator item)
Phase spinner
- Element: .phase-ring
- Animation: phaseSpin
Phase bars animation
- Element: .phase-bars
- Children:
- span (four bars with phaseBar animation)
Model tag (below message)
- Element: .model-tag
- Content: Model name (e.g., "groq/llama-3.1-70b-versatile")
Tool tag (below message)
- Element: .tool-tag
- Content: Tool name (e.g., "🛠️ web_search")
Voice capsule (audio player)
- Element: .voice-capsule
- Children:
- .voice-play (play/pause button)
- .voice-wave (waveform bars)
- .voice-dur (duration text)
Voice play button
- Element: .voice-play
- Icons:
- Play: SVG play icon
- Pause: SVG pause icon
Voice pause button
- Element: .voice-play (same as play button, but with pause icon)
Voice waveform bars
- Element: .voice-bar
- Styles:
- Height: Dynamic based on audio amplitude
- Animation: voicePulse when playing
Voice duration text
- Element: .voice-dur
- Content: Duration in "MM:SS" format
Image inside message
- Element: .bubble img
- Styles:
- Max width: 100%
- Border radius: 8px
Audio inside message
- Element: .bubble audio
- Styles:
- Width: 100%
- Max width: 240px
- Margin top: 6px
4. COMPOSER / INPUT AREA
Composer wrapper
- Element: .composer-wrap
- Children:
- .attach-row (attachment row)
- .composer (composer input)
- .composer-hint (composer hint)
Composer input textarea
- Element: #promptInput
- Attributes:
- rows="3"
- Placeholder text changes based on model capabilities
Attachment row / chips
- Element: .attach-row
- Children:
- .attach-chip (attachment chips)
Attachment chip image
- Element: .attach-chip img
- Styles:
- Width: 20px
- Height: 20px
- Border radius: 4px
Attachment chip remove button
- Element: .attach-chip .rm
- Content: "×"
Plus / attachment menu button
- Element: #plusBtn
- Icon: SVG plus sign
Attachment menu dropdown
- Element: #composerMenu
- Children:
- .menu-row (menu rows)
Attachment menu image option
- Element: #menuImage
- Icon: SVG image icon
- Label: "Image"
Attachment menu voice option
- Element: #menuVoice
- Icon: SVG microphone icon
- Label: "Voice"
Send button
- Element: #sendBtn
- Icons:
- Send: SVG arrow icon
- Stop: SVG square icon
Stop button (while generating)
- Element: #sendBtn (same as send button, but with stop icon)
Record button
- Element: #menuVoice
- Icon: SVG microphone icon
Recording active indicator
- Element: .icon-btn.recording
- Animation: pulse
Composer hint text
- Element: .composer-hint
- Content: Changes based on model capabilities
Model pill (selected model display)
- Element: #modelPill
- Children:
- #modelPillName (model name)
- .chev (chevron)
Model pill chevron
- Element: .chev
- Icon: SVG chevron down
5. MODEL PICKER
Model picker modal/sheet
- Element: #modelSheet
- Children:
- .sheet-grip (grip handle)
- .sheet-head (header)
- .sheet-body (body)
Model picker scrim
- Element: .sheet-scrim
Model picker grip (mobile)
- Element: .sheet-grip
Model picker close button
- Element: #modelSheetClose
- Icon: SVG X
Provider chip tabs
- Element: .model-provider-chip
- States:
- .active (selected provider)
Search/filter input
- Element: #modelFilter
- Attributes:
- placeholder="Search models…"
Model row item
- Element: .picker-row
- Children:
- .picker-row-name (model name)
- .picker-caps (capability chips)
- .picker-provider-badge (provider badge)
Model row swatch/color
- Element: .swatch
- Styles:
- Background: Provider color
- Color: #fff
- Border radius: 9px
Model row name
- Element: .picker-row-name
- Content: Model name
Model row tag (FREE/PRO/etc)
- Element: .model-row-tag
- Content: "FREE" or "PRO"
Model row description
- Element: .model-row-desc
- Content: Model description
Model row capability chips
- Element: .mini-cap
- Content: Capability icons
Model row checkmark (selected)
- Element: .model-row-check
- Icon: SVG checkmark
Model row deprecated warning
- Element: .model-row-deprecated
- Content: "Deprecated"
Group labels (Free, Pro, etc)
- Element: .picker-group-label
- Content: "Free" or "Pro"
Empty state (no results)
- Element: .picker-empty
- Content: "No results for 'query'" or "No models available for this provider. Check Settings."
6. SETTINGS SHEET
Settings scrim
- Element: #settingsScrim
Settings sheet
- Element: #settingsSheet
- Children:
- .sheet-grip (grip handle)
- .sheet-head (header)
- .sheet-body (body)
Settings grip (mobile)
- Element: .sheet-grip
Settings close button
- Element: #settingsSheetClose
- Icon: SVG X
Settings title
- Element: .sheet-head h2
- Content: "Settings"
Provider select dropdown
- Element: #providerSelect
- Options: List of providers
API key input
- Element: #apiKeyInput
- Attributes:
- type="password" (toggles to type="text" when visible)
API key show/hide toggle
- Element: #toggleKeyVisibility
- Labels:
- "Show" (when hidden)
- "Hide" (when visible)
API key save button
- Element: #saveKeyBtn
- Label: "Save key"
API key delete button
- Element: #clearKeyBtn
- Label: "Clear key"
Custom base URL input
- Element: #customBaseUrl
- Attributes:
- placeholder="https://api.example.com"
Status box (ok/error)
- Element: #keyStatus
- States:
- .ok (success)
- .err (error)
Auto-tools toggle switch
- Element: #autoToolSwitch
- States:
- .on (enabled)
- No class (disabled)
System prompt textarea
- Element: #systemPromptInput
- Attributes:
- rows="3"
- placeholder="You are a helpful assistant."
System prompt clear button
- Element: #clearSystemPrompt
- Icon: SVG X
TTS voice select
- Element: #ttsVoiceInput
- Attributes:
- placeholder="e.g. 'en-US-Wavenet-D'"
Primary action button
- Element: .btn-primary
- Labels:
- "Save key" (for API key)
- "Clear conversation" (for chat)
Ghost/cancel button
- Element: .btn-ghost
- Label: "Cancel"
Section labels
- Elements:
- .section-title (e.g., "Provider", "API Key", "System Prompt")
7. VOICE RECORDER OVERLAY
Voice overlay scrim
- Element: #voiceOverlay
- Styles:
- Background: rgba(28,28,30,0.5)
Voice card
- Element: .voice-card
- Children:
- .rec-dot (recording dot)
- .rec-time (recording time)
- .rec-actions (action buttons)
Recording dot (pulsing)
- Element: .rec-dot
- Animation: voicePulse
Recording time display
- Element: .rec-time
- Content: "MM:SS" format
Cancel button
- Element: #cancelRecording
- Label: "Cancel"
Stop/send button
- Element: #stopRecording
- Label: "Stop & Send"
8. KEY LOCK MODAL
Key lock overlay
- Element: .keylock-overlay
- Styles:
- Background: rgba(0,0,0,.55)
Key lock card
- Element: .keylock-card
- Children:
- h3 (title)
- .keylock-hint (hint text)
- input[type="password"] (passphrase input)
- .keylock-error (error message)
- .keylock-actions (action buttons)
Title
- Element: .keylock-card h3
- Content: "Enter passphrase"
Hint text
- Element: .keylock-hint
- Content: "This key is encrypted. Enter your passphrase to unlock it."
Passphrase input
- Element: .keylock-card input[type="password"]
- Attributes:
- placeholder="Passphrase"
Confirm passphrase input (create mode)
- Element: .keylock-card input[type="password"] (second input)
- Attributes:
- placeholder="Confirm passphrase"
Error message
- Element: .keylock-error
- Content: Error message text
OK/Unlock button
- Element: .keylock-actions button
- Labels:
- "Unlock" (unlock mode)
- "Create" (create mode)
Cancel button
- Element: .keylock-actions button
- Label: "Cancel"
9. TOAST NOTIFICATION
Toast container
- Element: .toast
- Content: Toast message text
Toast text
- Element: .toast
- Content: Toast message text
Toast dismiss (click)
- Behavior: Clicking the toast dismisses it
10. CAPABILITY CHIPS (in header & model rows)
vision
- Icon: 👁️
- Label: "Vision"
function_calling / tools
- Icon: 🛠️
- Label: "Tools"
reasoning
- Icon: 🧠
- Label: "Reasoning"
audio
- Icon: 🎙️
- Label: "Audio"
audio_transcription / STT
- Icon: 🎤
- Label: "STT"
tts
- Icon: 🔊
- Label: "TTS
