import { useEffect, useState } from 'react';
import { useSessionStore } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { cachedModels, ensureModels, isLoaded } from '../../catalog';
import { listProviders, type ProviderMetaLike } from './providerTypes';
import type { ModelInfo } from '../../catalog/types';
import { saveSettings, loadSettings } from '../../state/settings';
import { toast } from '../../lib/toast';
import { isAllowedBase } from '../../adapters/base';

function relTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/** One provider row: click to lazily discover its live model list. */
function ProviderRow({ meta }: { meta: ProviderMetaLike }) {
  const [open, setOpen] = useState(isLoaded(meta.id));
  const [models, setModels] = useState<ModelInfo[]>(cachedModels(meta.id));
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function toggle() {
    setOpen((o) => !o);
    if (open || isLoaded(meta.id)) return;
    setStatus('loading');
    try {
      setModels(await ensureModels(meta.id));
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      toast(e instanceof Error ? e.message : `Could not load ${meta.name} models`);
    }
  }

  return (
    <div className="prov-row">
      <button className="session-item" style={{ width: '100%' }} onClick={() => void toggle()}>
        <span className="tint-dot" style={{ ['--tint' as string]: meta.tint }} />
        <span className="session-title" style={{ flex: 1 }}>{meta.name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          {status === 'loading' ? <span className="dots"><i /><i /><i /></span> : status === 'error' ? '✗' : open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 6px 8px 14px' }}>
          {models.length === 0 && status !== 'loading' && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>no models listed</span>
          )}
          {models.map((m) => (
            <button
              key={m.id}
              className="chip"
              style={{ cursor: 'pointer' }}
              title={m.caps.join(', ') || m.id}
              onClick={() => {
                useUiStore.getState().setActiveModel({ providerId: meta.id, modelId: m.id });
                useUiStore.getState().setRailOpen(false);
                toast(`${m.label} ready`);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Add any OpenAI-compatible endpoint as a first-class provider. */
function AddProvider() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [base, setBase] = useState('');

  function save() {
    const id = name.trim().toLowerCase().replace(/\W+/g, '-');
    const url = base.trim().replace(/\/+$/, '');
    if (!id || !url) return;
    if (!isAllowedBase(url)) return toast('Base URL must be https (localhost exempt).');
    const cur = loadSettings().customProviders.filter((c) => c.id !== id);
    saveSettings({ customProviders: [...cur, { id, name: name.trim(), baseUrl: url }] });
    setName('');
    setBase('');
    setAdding(false);
    toast(`${name.trim()} added — click it to load models`);
    window.dispatchEvent(new Event('relay-providers-changed'));
  }

  if (!adding)
    return (
      <button className="btn" style={{ fontSize: 13 }} onClick={() => setAdding(true)}>
        + Add provider
      </button>
    );
  return (
    <div className="field" style={{ margin: 0 }}>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="https://…/v1" value={base} onChange={(e) => setBase(e.target.value)} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
      </div>
    </div>
  );
}

/** Sessions sidebar + live provider discovery. */
export function Rail() {
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force((n) => n + 1);
    window.addEventListener('relay-providers-changed', h);
    return () => window.removeEventListener('relay-providers-changed', h);
  }, []);

  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const activeModel = useUiStore((s) => s.activeModel);
  const railOpen = useUiStore((s) => s.railOpen);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <aside className={`rail ${railOpen ? 'open' : ''}`} aria-label="Sessions and providers">
      <div className="rail-brand">
        <span className="glyph">⟐</span> Relay
      </div>

      <button
        className="btn btn-primary rail-new"
        onClick={() => {
          useSessionStore.getState().createSession(activeModel);
          useUiStore.getState().setRailOpen(false);
        }}
      >
        + New thread
      </button>

      <nav className="rail-sessions">
        {sessions.map((s) => (
          <div key={s.id} className={`session-item ${s.id === activeId ? 'active' : ''}`}>
            <button
              className="session-title"
              style={{ all: 'unset', cursor: 'pointer', flex: 1 }}
              onClick={() => {
                useSessionStore.getState().setActive(s.id);
                useUiStore.getState().setRailOpen(false);
              }}
              title={s.title}
            >
              {s.title}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>{relTime(s.updatedAt)}</span>
            </button>
            <button
              className={`session-del ${confirmId === s.id ? 'confirm' : ''}`}
              title="Delete session"
              onClick={() => {
                if (confirmId === s.id) {
                  useSessionStore.getState().deleteSession(s.id);
                  setConfirmId(null);
                } else {
                  setConfirmId(s.id);
                  setTimeout(() => setConfirmId((c) => (c === s.id ? null : c)), 2500);
                }
              }}
            >
              {confirmId === s.id ? 'sure?' : '✕'}
            </button>
          </div>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 6 }}>
          PROVIDERS — CLICK TO LOAD MODELS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {listProviders().map((p) => (
            <ProviderRow key={p.id} meta={p} />
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <AddProvider />
        </div>
      </div>
    </aside>
  );
}
