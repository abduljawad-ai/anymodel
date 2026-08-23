# Research: Session Memory & Context Compaction (2025–2026 state of the art)

Sources: Claude Code compaction internals (autoCompact.ts / decodeclaude / y-agent deep dives), Anthropic Agent SDK cookbook (compaction_control), Anthropic context-management blog + memory cookbook, MemGPT paper (arXiv:2310.08560), Letta context-hierarchy docs, Anthropic "Effective context engineering".

## How the successful systems work

### 1 · Claude Code — tiered compaction (the industry benchmark)
- **Headroom accounting:** trigger when `tokens > effectiveWindow − buffer` (≈13k reserved). Graduated warning states at 60% / 75% / 90% of window. Never compacts tiny sessions; checks on a cadence, not per-token.
- **Five tiers, lightest first** (cache-eviction analogues):
  1. *Microcompact* — free rearrangement/offload of bulky content (no LLM call)
  2. *Snip* — LRU-archive oldest messages (plain truncation)
  3. *Collapse* — staged section summarization
  4. *Auto-compact* — full LLM summarization sub-agent
  5. *Reactive* — on API "prompt too long" (413): emergency compact keeping only last ~4 messages, retry
- **Structured summary CONTRACT (not "summarize this"):** nine sections — user intent, key technical concepts, files/code snippets, errors & fixes, problem-solving approaches, user messages, pending tasks, current work, explicit next step. A checklist beats open-ended summarization.
- **Incremental delta summarization:** new summary = `summarize(previous_summary + newly_evicted_segment)` — never reprocesses the whole history.
- **Hot tail preserved:** recent ~4 messages stay verbatim across compaction.
- **Recursion guard** (compactor can't trigger compaction) + **circuit breaker** (stop after N consecutive failures).
- **Boundary marker + continuation instruction** wrapped around the injected summary.

### 2 · MemGPT / Letta — OS-style hierarchical memory
- Main context (RAM) vs external context (disk); eviction pages old messages out, retrieval pages them back in.
- **FIFO queue whose head is a recursive summary of everything evicted** — exactly the delta-summary pattern.
- Small read/write "working context" block for durable key facts.

### 3 · Anthropic platform primitives (Sonnet 4.5)
- **Context editing:** clear stale tool results near the limit → **84% token reduction**, +29–39% task accuracy in their evals.
- **Client-side memory tool:** notes persisted outside the window across sessions.
- Models with built-in token awareness manage their own headroom.

## Synthesis → Relay algorithm (provider-agnostic, client-side)

Relay can't rely on provider-side features (must work for EVERY model), so it ports the portable mechanisms:

| Mechanism | Source | Relay implementation |
|---|---|---|
| Token accounting + threshold | Claude Code | estimator over history; compact when > `budget` (default 12k tok, configurable) |
| Lightest-tier-first | CC tiers 1→4 | (a) truncate giant old turns w/ `[…+N chars]`, (b) evict oldest beyond hot tail of 6 |
| Structured summary contract | CC 9-section prompt | chat-adapted checklist prompt (facts, decisions, identifiers, open threads, next step) |
| Delta/incremental summaries | CC sub-agents + MemGPT FIFO head | `newSummary = LLM(prevSummary + evicted segment)`; stored once per session |
| Summary injection w/ boundary | CC continuation wrapper | system-context message: "Conversation memory so far" + boundary note |
| Recursion guard + circuit breaker | CC | summarizer calls bypass compaction; 2 failures ⇒ hard-truncate fallback |
| Reactive emergency compact | CC tier 5 | on context-length ApiError: force-compact, retry once |

Result: input tokens stay bounded no matter how long the chat runs, while a rolling structured memory preserves intent/decisions/state — the same shape proven by Claude Code (+39% agent performance w/ memory+editing) and MemGPT's recursive FIFO summary.
