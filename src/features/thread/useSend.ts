import { ApiError, type ChatMessage } from '../../adapters/types';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase } from '../../adapters/base';
import type { ProviderId } from '../../catalog/types';
import { PROVIDERS } from '../../catalog/providers';
import { uid } from '../../lib/id';
import { estimateTokens, estimateTurnTokens } from '../../lib/tokens';
import { toast } from '../../lib/toast';
import { startStream, stopStream } from '../../state/streamRegistry';
import { useSessionStore, type Turn } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';
import { loadSettings } from '../../state/settings';
import { memoryPrompt, splitForCompaction, textTokens, truncationNotice, HOT_TAIL } from '../../lib/memory';

/** Map stored turns → wire messages (skip errors/empty; cap context). */
export function buildHistory(turns: Turn[], cap = 20): ChatMessage[] {
  return turns
    .filter((t) => !t.error && t.content.trim())
    .slice(-cap)
    .map((t) => ({
      role: t.role,
      content: t.content,
      ...(t.imageUrl && t.role === 'user' ? { imageUrl: t.imageUrl } : {}),
    }));
}

/**
 * THE single send entry. Appends the user turn, opens a streaming
 * assistant turn stamped with the session's current model, pipes deltas
 * into the store; Stop via streamRegistry; failures become inline error
 * cards on the assistant turn.
 */
export async function sendTurn(text: string, imageUrl?: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed && !imageUrl) return;

  const keys = useVaultKeys();
  const ss = useSessionStore.getState();
  if (!ss.activeId) ss.createSession(useUiStore.getState().activeModel);
  const sid = useSessionStore.getState().activeId!;
  const { providerId } = useSessionStore.getState().active()!.modelKey;

  if (!keys[providerId]) {
    toast(`Add a ${PROVIDERS[providerId].name} key first — Settings → Keys.`);
    return;
  }

  ss.addTurn(sid, {
    id: uid('u_'),
    role: 'user',
    content: trimmed,
    imageUrl,
    tokensEst: estimateTurnTokens({ content: trimmed, imageUrl }),
  });

  await runAssistantTurn(sid);
}

/** Create + stream an assistant turn for the session's current model slot. */
async function runAssistantTurn(sid: string, forceCompact = false): Promise<void> {
  const st = useSessionStore.getState();
  const s0 = st.active()!;
  const { providerId, modelId } = s0.modelKey;

  if (!useVaultKeys()[providerId]) {
    toast(`Add a ${PROVIDERS[providerId].name} key first — Settings → Keys.`);
    return;
  }

  const aid = uid('a_');
  st.addTurn(sid, { id: aid, role: 'assistant', content: '', modelId, providerId, streaming: true });

  await ensureMemory(sid, modelId, providerId, forceCompact);
  const s = useSessionStore.getState().active()!;
  const mem = s.memory;
  const liveTurns = mem ? s.turns.slice(mem.upto + 1).filter((t) => t.id !== aid) : s.turns.filter((t) => t.id !== aid);
  let history = buildHistory(liveTurns);
  if (mem?.text.trim()) {
    history = [{ role: 'system', content: `Conversation memory so far (older turns were compacted):\n${mem.text}\nContinue seamlessly.` }, ...history];
  }
  const ac = startStream(aid);
  const adapter = createAdapter(providerId, {
    baseUrl: effectiveBase(providerId),
    apiKey: () => vaultKey(providerId),
  });

  try {
    await adapter.streamChat(
      { model: modelId, messages: history },
      {
        signal: ac.signal,
        onDelta: (d) => useSessionStore.getState().appendDelta(sid, aid, d),
        onDone: () => {},
      },
    );
    const done = useSessionStore.getState().active()!.turns.find((t) => t.id === aid);
    useSessionStore.getState().patchTurn(sid, aid, {
      streaming: false,
      tokensEst: estimateTokens(done?.content ?? ''),
    });
    announce(modelId);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      useSessionStore.getState().patchTurn(sid, aid, { streaming: false });
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      const status = e instanceof ApiError ? e.status : undefined;
      if (!forceCompact && status !== undefined && status <= 413 && /context|too long|maximum|length/i.test(msg)) {
        // Reactive tier (Claude Code tier-5): emergency compact, retry once.
        useSessionStore.setState({
          sessions: useSessionStore.getState().sessions.map((x) =>
            x.id === sid ? { ...x, turns: x.turns.filter((t) => t.id !== aid) } : x,
          ),
        });
        await emergencyTruncate(sid);
        return runAssistantTurn(sid, true);
      }
      useSessionStore.getState().patchTurn(sid, aid, {
        streaming: false,
        error: { status, message: msg },
      });
    }
  }
}

type StreamFn = (req: { model: string; messages: { role: string; content: string }[]; maxTokens?: number }) => Promise<string>;
/** Test seam: override the summarizer transport. */
let memoryStreamOverride: StreamFn | undefined;
export function _setMemoryStreamFn(fn: StreamFn | undefined): void {
  memoryStreamOverride = fn;
}

/**
 * Delta summarization (MemGPT FIFO-head + Claude Code contract).
 * Recursion-safe: the summarizer call bypasses compaction.
 */
export async function ensureMemory(sid: string, modelId: string, providerId: ProviderId, force = false): Promise<void> {
  const st = useSessionStore.getState();
  const s = st.active();
  if (!s) return;
  const mem = s.memory;
  const live = s.turns.slice(mem ? mem.upto + 1 : 0);
  const budget = loadSettings().contextBudgetTokens - textTokens(mem?.text ?? '');
  const split = force ? forceSplit(live) : splitForCompaction(live, budget);
  if (!split) return;

  const segment = split.evicted.map((t) => `${t.role}: ${t.content}`).join('\n\n').slice(-12_000);
  const upto = (mem ? mem.upto : -1) + split.keptFrom;
  const built: StreamFn = async (req) => {
    const adapter = createAdapter(providerId, {
      baseUrl: effectiveBase(providerId),
      apiKey: () => useVaultStore.getState().keys[providerId],
    });
    let out = '';
    await adapter.streamChat(
      { model: modelId, messages: req.messages as never, maxTokens: 480 },
      { onDelta: (d) => (out += d), onDone: () => {}, signal: new AbortController().signal },
    );
    return out;
  };
  const streamFn = memoryStreamOverride ?? built;
  try {
    const text = (await streamFn({ model: modelId, messages: [{ role: 'user', content: memoryPrompt(mem?.text ?? '', segment) }] })).trim() ||
      truncationNotice(split.evicted.length, segment.length);
    st.setMemory(sid, { text, upto, compactions: (mem?.compactions ?? 0) + 1, at: Date.now() });
  } catch {
    // Circuit breaker fallback: hard truncation, never loop.
    st.setMemory(sid, {
      text: ((mem?.text ? mem.text + '\n' : '') + truncationNotice(split.evicted.length, segment.length)).trim(),
      upto,
      compactions: (mem?.compactions ?? 0) + 1,
      at: Date.now(),
    });
  }
}

type SlimTurn = { role: 'user' | 'assistant'; content: string };
function forceSplit(turns: readonly SlimTurn[]): { evicted: Array<{ index: number; role: 'user' | 'assistant'; content: string }>; keptFrom: number } | null {
  if (turns.length <= HOT_TAIL) return null;
  const cut = turns.length - HOT_TAIL;
  return { evicted: turns.slice(0, cut).map((t, i) => ({ index: i, role: t.role, content: t.content })), keptFrom: cut };
}

async function emergencyTruncate(sid: string): Promise<void> {
  const st = useSessionStore.getState();
  const s = st.active();
  if (!s) return;
  const split = forceSplit(s.turns);
  if (!split) return;
  const note = truncationNotice(split.evicted.length, split.evicted.reduce((n, t) => n + t.content.length, 0));
  st.setMemory(sid, {
    text: ((s.memory?.text ? s.memory.text + '\n' : '') + note).trim(),
    upto: (s.memory?.upto ?? -1) + split.keptFrom,
    compactions: (s.memory?.compactions ?? 0) + 1,
    at: Date.now(),
  });
}

/** Drop the trailing assistant turn and generate a fresh one over the same history. */
export async function regenerate(): Promise<void> {
  const st = useSessionStore.getState();
  const s = st.active();
  if (!s) return;
  const last = s.turns[s.turns.length - 1];
  if (!last || last.role !== 'assistant') return;
  st.patchTurn(s.id, last.id, {});
  useSessionStore.setState({
    sessions: st.sessions.map((x) =>
      x.id === s.id ? { ...x, turns: x.turns.filter((t) => t.id !== last.id) } : x,
    ),
  });
  await runAssistantTurn(s.id);
}

export function stopCurrentTurn(turnId?: string): void {
  stopStream(turnId);
}

function announce(modelId: string): void {
  const el = document.getElementById('aria-announcer');
  if (el) el.textContent = `Reply from ${modelId} finished`;
}

function useVaultKeys() {
  return useVaultStore.getState().keys;
}
function vaultKey(providerId: ProviderId) {
  return useVaultStore.getState().keys[providerId];
}
