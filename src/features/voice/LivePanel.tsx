import { useRef, useState } from 'react';
import { startLive, type LiveHandle } from './realtime';
import { useVaultStore } from '../../vault/vaultStore';
import { useUiStore } from '../../state/uiStore';

interface Line {
  who: 'you' | 'model';
  text: string;
}

/** Full-screen live voice session: orb, live transcript, mute/end. */
export function LivePanel({ onClose }: { onClose: () => void }) {
  const activeModel = useUiStore((s) => s.activeModel);
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<'connecting' | 'listening'>('connecting');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const handle = useRef<LiveHandle | null>(null);

  async function begin() {
    try {
      handle.current = await startLive({
        apiKey: useVaultStore.getState().keys.openai ?? '',
        model: activeModel.modelId,
        onUser: (t) => setLines((l) => [...l, { who: 'you', text: t }]),
        onAssistant: (d) =>
          setLines((l) => {
            const last = l[l.length - 1];
            if (last?.who === 'model') return [...l.slice(0, -1), { who: 'model', text: last.text + d }];
            return [...l, { who: 'model', text: d }];
          }),
        onState: setState,
        onError: (m) => setError(m),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="overlay" style={{ placeItems: 'center' }} role="dialog" aria-label="Live voice">
      <div className="palette" style={{ padding: 20, maxHeight: '80vh' }}>
        <h3 style={{ margin: '0 0 4px' }}>Live · {activeModel.modelId}</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
          {error ? error : state === 'connecting' ? 'Connecting…' : 'Speak freely — transcript appears live.'}
        </p>

        <div style={{ display: 'grid', placeItems: 'center', padding: '18px 0' }}>
          <button
            aria-label={state === 'listening' ? 'Listening' : 'Start listening'}
            onClick={() => void begin()}
            disabled={!!handle.current || !!error}
            style={{
              width: 92, height: 92, borderRadius: '50%', border: 'none',
              cursor: handle.current ? 'default' : 'pointer',
              background: 'var(--accent)', opacity: state === 'listening' ? 1 : 0.75,
              boxShadow: state === 'listening' ? '0 0 0 12px var(--accent-soft)' : undefined,
            }}
          />
        </div>

        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 13.5 }}>
              <strong style={l.who === 'you' ? undefined : { color: 'var(--accent)' }}>
                {l.who === 'you' ? 'You: ' : 'Model: '}
              </strong>
              {l.text}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() =>
              setMuted((m) => {
                handle.current?.mute(!m);
                return !m;
              })
            }
            disabled={!handle.current}
          >
            {muted ? '🔇 Muted' : '🎙 Mute'}
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-danger"
            onClick={() => {
              handle.current?.stop();
              onClose();
            }}
          >
            ■ End
          </button>
        </div>
      </div>
    </div>
  );
}
