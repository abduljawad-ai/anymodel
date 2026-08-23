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
async function runAssistantTurn(sid: string): Promise<void> {
  const st = useSessionStore.getState();
  const s = st.active()!;
  const { providerId, modelId } = s.modelKey;

  if (!useVaultKeys()[providerId]) {
    toast(`Add a ${PROVIDERS[providerId].name} key first — Settings → Keys.`);
    return;
  }

  const aid = uid('a_');
  st.addTurn(sid, { id: aid, role: 'assistant', content: '', modelId, providerId, streaming: true });

  const history = buildHistory(useSessionStore.getState().active()!.turns.filter((t) => t.id !== aid));
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
      useSessionStore.getState().patchTurn(sid, aid, {
        streaming: false,
        error: {
          status: e instanceof ApiError ? e.status : undefined,
          message: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }
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
