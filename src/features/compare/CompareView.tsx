import { useState } from 'react';
import { PROVIDERS } from '../../catalog/providers';
import { listModels } from '../../catalog';
import type { ModelInfo } from '../../catalog/types';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase } from '../../adapters/base';
import { uid } from '../../lib/id';
import { toast } from '../../lib/toast';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';

interface ColumnState {
  ref: ModelInfo;
  text: string;
  streaming: boolean;
  error: string | null;
}

/** Split-pane duel: one prompt → N models → promote a winner into the thread. */
export function CompareView() {
  const selected = useUiStore((s) => s.compareModels);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setView = useUiStore((s) => s.setView);
  const [prompt, setPrompt] = useState('');
  const [cols, setCols] = useState<ColumnState[]>([]);
  const [running, setRunning] = useState(false);

  async function fanOut() {
    if (!prompt.trim()) return;
    if (selected.length === 0) {
      toast('Pick 2–3 models first — “+ Add model”.');
      return;
    }
    const keys = useVaultStore.getState().keys;
    for (const m of selected) {
      if (!keys[m.providerId]) {
        toast(`No ${PROVIDERS[m.providerId].name} key — add it in Settings.`);
        return;
      }
    }

    // Seed columns
    const seeded: ColumnState[] = selected.map((ref) => ({
      ref: { ...(listModels(ref.providerId).find((m) => m.id === ref.modelId) ?? { id: ref.modelId, label: ref.modelId, providerId: ref.providerId, caps: [] }), },
      text: '',
      streaming: true,
      error: null,
    }));
    setCols(seeded);
    setRunning(true);

    await Promise.all(
      seeded.map(async (col, i) => {
        const adapter = createAdapter(col.ref.providerId, {
          baseUrl: effectiveBase(col.ref.providerId),
          apiKey: () => useVaultStore.getState().keys[col.ref.providerId],
        });
        try {
          await adapter.streamChat(
            { model: col.ref.id, messages: [{ role: 'user', content: prompt.trim() }] },
            {
              signal: new AbortController().signal,
              onDelta: (d) =>
                setCols((cs) => cs.map((c, j) => (j === i ? { ...c, text: c.text + d } : c))),
              onDone: () =>
                setCols((cs) => cs.map((c, j) => (j === i ? { ...c, streaming: false } : c))),
            },
          );
        } catch (e) {
          setCols((cs) =>
            cs.map((c, j) =>
              j === i ? { ...c, streaming: false, error: e instanceof Error ? e.message : String(e) } : c,
            ),
          );
        }
      }),
    );
    setRunning(false);
  }

  function promote(col: ColumnState) {
    const st = useSessionStore.getState();
    const sid = st.active()?.id ?? st.createSession(useUiStore.getState().activeModel);
    st.addTurn(sid, { id: uid('u_'), role: 'user', content: prompt.trim() });
    st.addTurn(sid, {
      id: uid('a_'),
      role: 'assistant',
      content: col.text,
      modelId: col.ref.id,
      providerId: col.ref.providerId,
    });
    useUiStore.getState().setActiveModel({ providerId: col.ref.providerId, modelId: col.ref.id });
    toast(`Promoted ${col.ref.label} into the thread`);
    setView('thread');
  }

  return (
    <div className="compare-wrap">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {selected.length === 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            No models picked yet.
          </span>
        )}
        {selected.map((m) => (
          <span className="chip" key={`${m.providerId}/${m.modelId}`}>
            <span className="tint-dot" style={{ ['--tint' as string]: PROVIDERS[m.providerId].tint }} />
            {m.modelId}
          </span>
        ))}
        <button className="btn" onClick={() => setPaletteOpen(true)} disabled={selected.length >= 3}>
          + Add model{selected.length >= 3 ? ' (max 3)' : ''}
        </button>
      </div>

      <div className="composer-inner" style={{ position: 'relative' }}>
        <textarea
          rows={2}
          value={prompt}
          placeholder="One prompt, several minds…"
          aria-label="Compare prompt"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !running) {
              e.preventDefault();
              void fanOut();
            }
          }}
        />
        <div className="composer-row">
          <span className="send-hint">answers stream side-by-side</span>
          <button className="btn btn-primary" onClick={() => void fanOut()} disabled={running}>
            {running ? 'Running…' : 'Run ⚡'}
          </button>
        </div>
      </div>

      <div className="compare-cols">
        {cols.map((col, i) => (
          <div className="col" key={i}>
            <div className="col-head">
              <span className="chip">
                <span className="tint-dot" style={{ ['--tint' as string]: PROVIDERS[col.ref.providerId].tint }} />
                {col.ref.label}
              </span>
              {!col.streaming && (col.text || col.error) && (
                <button className="btn btn-primary" onClick={() => promote(col)}>
                  ★ Promote
                </button>
              )}
            </div>
            {col.error ? (
              <div className="error-card" role="alert">⚠ {col.error}</div>
            ) : (
              <div className={`msg-content ${col.streaming ? 'caret' : ''}`}>{col.text || '…'}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
