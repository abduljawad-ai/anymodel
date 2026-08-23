import { useEffect, useState } from 'react';
import { cachedModels, ensureModels, invalidate, isChatCapable, isLoaded } from '../../catalog';
import { listProviders } from '../../catalog/providers';
import type { ModelInfo, ProviderMeta } from '../../catalog/types';
import { createAdapter } from '../../adapters/factory';
import { resolveDeps, custodyOf } from '../../vault/gate';
import { isAllowedBase } from '../../adapters/base';
import { loadSettings, saveSettings } from '../../state/settings';
import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';
import { toast } from '../../lib/toast';

type Status = 'idle' | 'loading' | 'error';

function statusChip(pid: string) {
  const mode = custodyOf(pid);
  if (mode === 'gate') return <span className="chip" title="Split-key custody via relay-gate">🔒 gate</span>;
  if (mode === 'local') return <span className="chip">🔑 local key</span>;
  return <span className="chip" style={{ opacity: 0.6 }}>no key</span>;
}

/** One provider card: key management + live model discovery + selection. */
function ProviderCard({ meta }: { meta: ProviderMeta }) {
  const [, force] = useState(0);
  const [editingKey, setEditingKey] = useState(false);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>(cachedModels(meta.id));
  const [status, setStatus] = useState<Status>('idle');
  const hasKey = !!useVaultStore((s) => s.keys[meta.id]);

  async function saveKey() {
    if (!draft.trim()) return;
    await useVaultStore.getState().setKey(meta.id, draft);
    setDraft('');
    setEditingKey(false);
    toast(`${meta.name} key saved`);
    force((n) => n + 1);
  }

  async function test() {
    const adapter = createAdapter(meta.id, resolveDeps(meta.id));
    toast(`Testing ${meta.name}…`);
    const r = await adapter.testConnection();
    toast(r.ok ? `✓ ${meta.name}: ${r.detail}` : `✗ ${meta.name}: ${r.detail}`);
  }

  async function load() {
    setOpen(true);
    setStatus('loading');
    try {
      setModels(await ensureModels(meta.id));
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      toast(e instanceof Error ? e.message : `Could not fetch ${meta.name} models`);
    }
  }

  function pick(m: ModelInfo) {
    useUiStore.getState().setActiveModel({ providerId: meta.id, modelId: m.id });
    useUiStore.getState().setView('chat');
    toast(`${m.label} ready — back to chat`);
  }

  const suggested = (meta.popular ?? []).map((id) => ({ id, info: undefined as ModelInfo | undefined }));

  return (
    <div className="prov-card">
      <div className="prov-head">
        <span className="tint-dot" style={{ ['--tint' as string]: meta.tint }} />
        <strong>{meta.name}</strong>
        <span className="chip">{meta.kind === 'compatible' ? 'OpenAI-compatible' : meta.kind}</span>
        {statusChip(meta.id)}
        {meta.local && <span className="chip">local</span>}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-all' }}>
        {meta.defaultBase}
      </div>
      {meta.keyUrl && (
        <a href={meta.keyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
          get a key ↗
        </a>
      )}

      <div className="prov-actions">
        {!hasKey ? (
          editingKey ? (
            <>
              <input
                type="password"
                autoFocus
                placeholder={`${meta.name} API key${meta.local ? ' (often optional)' : ''}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void saveKey()}
              />
              <button className="btn btn-primary" onClick={() => void saveKey()}>
                Save
              </button>
              <button className="btn" onClick={() => setEditingKey(false)}>
                ✕
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditingKey(true)}>
              Set key
            </button>
          )
        ) : (
          <>
            <button className="btn" onClick={() => void test()}>
              Test
            </button>
            <button
              className="btn btn-danger"
              title="Remove stored key"
              onClick={() =>
                void useVaultStore.getState().removeKey(meta.id).then(() => force((n) => n + 1))
              }
            >
              Remove key
            </button>
          </>
        )}

        <button
          className="btn"
          disabled={!useVaultStore.getState().keys[meta.id] && !meta.local}
          onClick={() => void load()}
        >
          {isLoaded(meta.id) ? 'Refresh models' : 'Load models'}
        </button>
      </div>

      {(open || isLoaded(meta.id)) && (
        <div className="prov-models">
          {status === 'loading' && (
            <span className="dots" aria-label="loading models">
              <i />
              <i />
              <i />
            </span>
          )}
          {status !== 'loading' &&
            models.map((m) => (
              <button key={m.id} className={`chip model-chip ${isChatCapable(m) ? '' : 'aux'}`} onClick={() => pick(m)} title={[m.id, ...m.caps].join(' · ')}>
                {m.label}
              </button>
            ))}
          {status === 'error' && <span style={{ color: 'var(--err)', fontSize: 12.5 }}>fetch failed — check key/base URL, then retry</span>}
        </div>
      )}

      {!isLoaded(meta.id) && (suggested.length > 0 || models.length === 0) && (
        <div className="prov-suggested">
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>SUGGESTED</span>
          {suggested.map((s) => (
            <button key={s.id} className="chip" onClick={() => pick({ id: s.id, providerId: meta.id, label: s.id.replace(/[-_/.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), caps: [] })}>
              {s.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Add any OpenAI-compatible endpoint as a first-class provider. */
function AddProviderCard({ onAdded }: { onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [base, setBase] = useState('');

  function save() {
    const id = name.trim().toLowerCase().replace(/\W+/g, '-').slice(0, 40);
    const url = base.trim().replace(/\/+$/, '');
    if (!id || !url) {
      toast('Name and base URL required.');
      return;
    }
    if (!isAllowedBase(url)) {
      toast('Base must be https (localhost exempt).');
      return;
    }
    const cur = loadSettings().customProviders.filter((c) => c.id !== id);
    saveSettings({ customProviders: [...cur, { id, name: name.trim(), baseUrl: url }] });
    setName('');
    setBase('');
    setAdding(false);
    invalidate(id);
    toast(`${name.trim()} added`);
    onAdded();
  }

  if (!adding)
    return (
      <button className="btn prov-add" onClick={() => setAdding(true)}>
        ＋ Add custom provider
      </button>
    );

  return (
    <div className="prov-card">
      <strong>Add custom provider</strong>
      <p style={{ margin: '4px 0', fontSize: 12.5, color: 'var(--muted)' }}>
        Any OpenAI-compatible endpoint (vLLM, LiteLLM, proxies, gateways…). Models are fetched live from its /models.
      </p>
      <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="https://host/v1" value={base} onChange={(e) => setBase(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={save}>
          Save provider
        </button>
        <button className="btn" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Full providers page: directory + customs + add flow. */
export function ProvidersPage() {
  const [, tick] = useState(0);

  useEffect(() => {
    const h = () => tick((t) => t + 1);
    window.addEventListener('relay-providers-changed', h);
    return () => window.removeEventListener('relay-providers-changed', h);
  }, []);

  const providers = listProviders();

  return (
    <div className="providers-page">
      <header className="prov-page-head">
        <h2>Providers</h2>
        <p>Pick a famous provider or add any custom endpoint. Keys stay encrypted in your vault (or gate-held). Models are fetched live — nothing here is hardcoded.</p>
      </header>
      <div className="prov-grid">
        {providers.map((p) => (
          <ProviderCard key={p.id} meta={p} />
        ))}
        <AddProviderCard onAdded={() => tick((t) => t + 1)} />
      </div>
    </div>
  );
}
