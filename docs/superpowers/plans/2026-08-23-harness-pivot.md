# Harness Pivot — Implementation Plan (Relay v2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps; smallest-code mandate throughout.

**Goal:** Turn Relay into a production-grade, bring-your-own-key AI harness: dynamic provider/model discovery (nothing hardcoded), rate-limit-safe networking, hardened security, real-time voice chat, and a polished chat UI with thinking/reasoning/fetching states. Compare and Lab tabs are removed.

**Global rules (every task):** smallest code that does the job · no bloat · TDD on all logic layers · coverage ≥80% on `lib/`, `adapters/`, `vault/`, `catalog/` · `npm run build` green every commit.

## Decisions locked (from user brief)

1. "Search any provider" = the 4 built-in wire-format families PLUS user-added custom providers (name + base URL, OpenAI-compatible) stored locally. Search box finds providers; clicking a provider lazily fetches ITS live model list from the API using the stored key.
2. "Modules" = models. Zero hardcoded model names. Curated starter lists are DELETED; capability detection heuristics stay (they classify fetched ids).
3. Models fetch on demand only (click), cached in memory with 10-min TTL. Website load performs zero provider network calls.
4. Compare + Lab deleted outright (features, routes, tests, adapter methods `embed`/`moderate`).
5. Live voice = OpenAI Realtime over WebRTC (ephemeral-token flow), enabled automatically when the selected model id matches `/realtime/`.
6. Production bar: CSP, timeouts, 429 Retry-After handling + one auto-retry, sanitized rendering (existing), security regression tests, deep QA.

---

### Task H1 — Purge Compare & Lab, slim the adapter contract

**Delete:** `features/compare/`, `features/lab/`, `lib/math.ts`, uiStore `view`/tabs/`compareModels`, TopBar tabs, `embed()`/`moderate()` from `ProviderAdapter` + all implementations/tests referencing them.
**Keep:** transcribe/speak (voice), streamChat, testConnection; add `listModels(): Promise<string[]>` stub returning `[]` (implemented in H2).
**Tests:** update `providers.test.ts` (drop embed/moderate cases), palette compare branch, app smoke.
**Verify:** build + tests green. Commit `refactor: remove compare/lab, slim adapter contract`.

### Task H2 — Live model discovery (zero-hardcode)

**Files:** rewrite `src/catalog/index.ts`; touch `adapters/openai.ts` (GET `/models` → `data[].id`), `adapters/anthropic.ts` (GET `/models`, `x-api-key`+version headers → `data[].id`), `adapters/google.ts` (GET `/models` → `models[].name` minus `models/` prefix, filter `supportedGenerationMethods ∋ generateContent`), `adapters/compatible.ts` inherits openai.

```ts
// catalog/index.ts — entire public surface
export async function ensureModels(pid: ProviderId): Promise<ModelInfo[]>  // TTL 10min memory cache; fetch via adapter.listModels(); normalizeModel heuristics
export function cachedModels(pid: ProviderId): ModelInfo[]                 // [] when not yet loaded — NEVER triggers network
export function invalidate(pid?: ProviderId): void
```

Boot path does NOT call these anywhere. Delete `starter.ts`, `pickDefaultModel` starter reliance (default active model = empty until user picks; composer disabled with hint "pick a model").
**Tests:** fake adapters returning id lists incl. junk → normalized caps, TTL caching (fake timers), invalidate, google filtering.
Commit `feat: live model discovery, zero hardcoded models`.

### Task H3 — Custom providers + provider-first UI

**Files:** `state/settings.ts` (+`customProviders: {id,name,baseUrl}[]`, validated https/localhost), `catalog/providers.ts` (+`getProvider(id)` merging builtins & customs, tint from id hash), `features/shell/Rail.tsx` (Threads section + Providers section: rows expand on click → `ensureModels` w/ skeleton dots → clickable models; "+ Add provider" mini-form), `palette/Palette.tsx` (two groups: Providers (always) + Models (only from already-loaded caches); choosing a provider loads+expands inline), `composer/Composer.tsx` (no active model ⇒ disabled send + hint).
**Tests:** settings custom-provider validation; rail interaction (render provider → mock fetch → models appear); palette shows provider before models.
Commit `feat: custom providers + lazy provider-first discovery UI`.

### Task H4 — Resilience: timeouts, 429 Retry-After, one auto-retry

**Files:** new `lib/net.ts`:

```ts
export async function fetchWithRetry(input, init?, { retries = 1, timeoutMs = 60_000 } = {}): Promise<Response>
// timeout via combined AbortController; on 429/503 & attempts left: sleep(Retry-After || exp backoff+jitter) once; surfaces ApiError(429,'Rate limited …')
```

All adapter fetches route through it. Bubble/composer render "retrying in Xs…" state when a retry sleeps (module-level event or returned meta via promise — smallest: toast).
**Tests:** fake timers — 429 then success (retried, no throw); 429 twice (throws humanized); Retry-After honored; timeout aborts.
Commit `feat: timeouts, retry-after backoff, rate-limit UX`.

### Task H5 — Security hardening pass

**Files:** `index.html` CSP meta (`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src blob:; connect-src https: wss: ws://localhost:* http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'`), `SECURITY.md` (threat model: keys-at-rest, transport, XSS, CSRF-n/a-no-cookies, supply chain pinning note), tests `tests/security/security.test.ts`:
- exported JSON contains no `sk-`/key-shaped strings and no vault material;
- vault ciphertext blob shape only (`salt/iv/data/iterations/v`);
- `renderMarkdown` strips script/javascript: even when nested in markdown bombs;
- base-URL validator rejects `http://evil.com`, accepts localhost http + any https;
- localStorage never receives plaintext key after setKey (stringify scan).
Commit `feat: CSP + security suite`.

### Task H6 — Realtime voice chat (WebRTC)

**Files:** `src/features/voice/realtime.ts`, `features/voice/LivePanel.tsx`, composer "● Live" affordance when `activeModel.modelId` matches `/realtime/`.

```ts
// realtime.ts — whole API
export interface Live handle { stop(): void; sendText(t: string): void }
export async function startLive(o: {
  model: string; apiKey: string;
  onUser(text: string): void; onAssistant(text: string): void;
  onState(s: 'connecting' | 'listening' | 'error'): void; onError(msg: string): void;
}): Promise<Live>
```

Flow (smallest correct): POST `/v1/realtime/sessions` (Bearer key, `{model}`) → `client_secret.value` → `RTCPeerConnection`, getUserMedia mic track, `ontrack` → hidden `<audio>.play()` → datachannel `oai-events` → createOffer/setLocalDescription → POST answer SDP to `/v1/realtime?model=` with `Authorization: Bearer <ephemeral>` + `Content-Type: application/sdp` → setRemoteDescription. DC events parsed: `response.audio_transcript.delta`→onAssistant, `conversation.item.input_audio_transcription.completed`→onUser, `error`→onError. `sendText` injects `response.create` with text item. `handle.stop()` closes pc+tracks.
**UI:** orb button (pulse while listening), transcript pane reusing `.thread-wrap`, Mute (disable mic track), End.
**Tests:** mock `RTCPeerConnection`/`getUserMedia`/fetch — asserts ephemeral flow order, transcript routing, stop cleanup.
Commit `feat: realtime WebRTC live voice`.

### Task H7 — Chat UX: phases, reasoning, code headers, skeletons

**Turn shape:** +`reasoning?: string`, +`phase?: 'connecting'|'thinking'` (derived: content empty && streaming). `StreamSignals.onDelta` gains sibling `onReasoning?`.
- **Bubble:** empty+streaming → shimmer pill "Connecting…→Thinking…" (CSS gradient sweep); `reasoning` renders `<details class="reason"><summary>🧠 Reasoning</summary>…` with pulse dot while reasoning streams; code blocks upgraded in `markdown.ts` post-pass: wrap `pre` with `.code-head` showing detected language + copy btn (single implementation, replaces per-bubble DOM hack).
- **Skeleton:** `.dots` component reused by Rail model-loading + palette.
**Tests:** reasoning delta routing (openai `reasoning_content`, anthropic `thinking_delta`), phase classes, code-head wrapper.
Commit `feat: thinking/reasoning visuals, code headers, skeletons`.

### Task H8 — Deep test & coverage sweep

Run full suite + coverage; fill gaps until ≥80% lines on all four logic dirs; fix any flake; `npm run build`; manual QA checklist executed via Playwright (wizard→unlock→provider expand→model pick→mock-stream reply→live-panel mount with mocked RTC→lock/unlock→reload persistence).
Commit `test: coverage sweep + qa fixes`.

### Task H9 — Docs truth-out

Update `README.md` (harness identity, discovery model, voice, security), append v2 addendum to spec doc. Final commit `docs: harness v2`.

---

# DEFERRED PHASES (approved direction — build AFTER harness v2 completes)

## Phase P — Split-key secure proxy ("relay-gate", two-key custody)

**Threat model solved:** today the provider API key lives in the user's browser vault. Even though it's AES-GCM encrypted at rest and never leaves except to the provider, a compromised device can exfiltrate the plaintext while unlocked. Split-key custody means **no single location ever holds a usable provider key.**

### Architecture
- **relay-gate**: tiny stateless HTTPS service (one Docker container or free edge-worker). Holds provider keys, encrypted at rest with a server master secret (env/KMS). Never returns a provider key to anyone, ever — it only *uses* it server-side to forward calls.
- **Enrollment (once per provider key):**
  1. Client generates `pairingKey` = 32 random bytes (base64url), stores it ONLY in the local vault.
  2. `POST /enroll {provider, apiKey}` over TLS → gate persists `{recordId, salt, iv, ciphertext=AES-GCM(masterSecret-derived, apiKey)}` → responds `{recordId, pairingCheck}` where `pairingCheck = HKDF(pairingKey, salt)` truncated — proof-of-pairing, not a secret.
- **Every request:** browser → gate: `{recordId}` + `X-Pairing-Key: <pairingKey>` + payload. Gate: derive wrap key `HKDF(pairingKey, salt)` → verify check → decrypt provider key **in memory** → inject upstream auth → stream SSE back → zeroize. Plaintext never logged, never cached.
- **Leak analysis:** DB dump ⇒ ciphertext only (needs pairingKey). Stolen pairingKey ⇒ useless without matching server record, instantly revocable. Both stolen ⇒ scoped to ONE record, revocable, auditable. Local vault stays as-is for users who prefer full-local custody — custody becomes a setting.

### Tasks
- [ ] P1 `gate/` service (~200 LOC): enroll/proxy/revoke endpoints, master-secret envelope encryption, SSE pipe-through, in-memory zeroize, no persistent logs (hash-only audit counters)
- [ ] P2 Hardening: per-record token-bucket rate limit, body size caps, timeout+retry policy identical to client's, TLS-only, CORS locked to Pages origin, health endpoint
- [ ] P3 Client: Settings → "Key custody: Local vault | relay-gate"; enrollment flow; adapter transport swap (gate base URL + pairing headers instead of direct provider auth)
- [ ] P4 Revocation UX (revoke from either side), re-enrollment, multi-provider records
- [ ] P5 Tests: crypto roundtrip, wrong pairing rejected, rate-limit trip, SSE integrity; load smoke

## Phase G — GitHub-native platform (own auth + storage, zero paid services)

**Principle:** the entire product is static (already true). So identity and storage move into infrastructure every user already controls — **their own GitHub account** — making Relay the first BYOK harness with BYO-backend. No central user DB exists anywhere; there is nothing to breach.

### Identity (own system — no Google/OAuth dependency)
- Username + password chosen in-app. Password → **loginKey** = PBKDF2-SHA256(password, salt=username, 600k). From loginKey derive, via HKDF: `encKey` (data encryption) and `authHash` (verification, different info-string) — password never stored or sent anywhere.
- First run creates a private repo `<username>.relay` in the user's GitHub account using a **fine-grained PAT the user pastes once** (scope: Contents R/W on that single repo only — least privilege, revocable from GitHub UI anytime).
- `profile.json` in the repo stores `{username, authHash, kdf params, created}` — login = fetch profile, derive authHash, constant-time compare. Wrong password fails before any decryption attempt.
- **Recovery kit:** printable code = XOR-split of a random data key wrapped by loginKey (so password reset ≠ data loss without weakening security).

### Storage
- Everything (sessions, rolling memory, settings, vault blob) syncs as AES-GCM blobs (key = encKey) written through GitHub Contents API; each save is a commit → **free versioned backup/history** built into git itself.
- Optional mirror target: user's own Google Drive via its free REST API (OAuth token they generate) — same encrypted-blob format, same code path behind a `StorageTarget` interface.
- Conflict rule: last-writer-wins per file with timestamp vector; export/import remains the universal escape hatch.

### "Runs 24/7 for everyone"
- Serving: GitHub Pages CDN (unlimited, free). Compute: none needed for chat (browser→provider/gate direct). Anything that truly needs a cron (e.g., scheduled memory snapshots) = GitHub Actions on `repository_dispatch`/schedule in the user's own repo, scoped secrets, documented cold-start limits. Real-time paths stay serverless by design.

### Reverse-engineering notes to implement against
- Constant-time compare pattern (crypto.timingSafeEqual equivalent via double-HMAC) · Argon2id vs PBKDF2 tradeoff (PBKDF2 via WebCrypto now, Argon2 WASM later) · PAT scope minimization · Contents-API etag optimistic concurrency · rate-limit headers respect (reuse lib/net.ts) · audit trail = local ring buffer, exportable, zero telemetry.

### Tasks
- [ ] G1 `platform/kdf.ts`: loginKey/HKDF split, constant-time compare, recovery-kit XOR-split
- [ ] G2 `platform/githubStore.ts`: PAT bootstrap (create private repo if missing), get/put/delete encrypted blobs w/ etag retries, profile login flow
- [ ] G3 Login/Signup screens replacing wizard entry when cloud mode chosen (local mode stays default)
- [ ] G4 Sync engine: debounced push, pull-on-focus, conflict timestamps; DriveTarget behind StorageTarget interface
- [ ] G5 Security suite extensions: no plaintext at rest in repo (stringify scans), authHash independence from encKey, replay-safe etags
- [ ] G6 Docs: threat model, recovery procedure, self-host checklist

Build order: P1→P5, then G1→G6. Each phase ships independently usable.
