import { useEffect, useMemo, useState } from 'react';
import { cachedModels, ensureModels, invalidate, isChatCapable, isLoaded } from '../../catalog';
import type { ModelInfo, ProviderMeta } from '../../catalog/types';
import { listProviders, PROVIDERS } from '../../catalog/providers';
import { createAdapter } from '../../adapters/factory';
import { resolveDeps, custodyOf } from '../../vault/gate';
import { isAllowedBase } from '../../adapters/base';
import { loadSettings, saveSettings } from '../../state/settings';
import { useUiStore } from '../../state/uiStore';
import { useVaultStore } from '../../vault/vaultStore';
import { toast } from '../../lib/toast';
import { onModelsChanged, ensureSaneActiveModel } from './autoLoad';

/** Compact single-line provider row — expands on click into full controls. */
function ProviderRow({ meta }: { meta: ProviderMeta }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [editingKey, setEditingKey] = useState(false);
  const [draft, setDraft] = useState('');
  const [models, setModels] = useState<ModelInfo[]>(cachedModels(meta.id));
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const hasKey = !!useVaultStore((s) => s.keys[meta.id]);
  const mode = custodyOf(meta.id);

  async function saveKey() {
    if (!draft.trim()) return;
    await useVaultStore.getState().setKey(meta.id, draft);
    setDraft('');
    setEditingKey(false);
    toast(`${meta.name} key saved — loading models…`);
    force((n) => n + 1);
    // Auto-discover models immediately; no manual "Load models" needed.
    try {
      setModels(await ensureModels(meta.id));
      setOpen(true);
      ensureSaneActiveModel();
      toast(`${meta.name}: ${cachedModels(meta.id).length} models ready`);
    } catch {
      toast(`${meta.name}: could not fetch models — check key, use Refresh later`);
    }
  }

  // Keep row data fresh when models load from anywhere else.
  useEffect(() => onModelsChanged(() => setModels(cachedModels(meta.id))), [meta.id]);

  async function test() {
    toast(`Testing ${meta.name}…`);
    const r = await createAdapter(meta.id, resolveDeps(meta.id)).testConnection();
    toast(r.ok ? `✓ ${meta.name}: ${r.detail}` : `✗ ${meta.name}: ${r.detail}`);
  }

  async function load() {
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
    toast(`${m.label} ready`);
  }

  return (
    <div>
      <button className="prov-row-line" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tint-dot" style={{ ['--tint' as string]: meta.tint }} />
        <strong>{meta.name}</strong>
        <span className="chip">{meta.kind === 'compatible' ? 'compat' : meta.kind}</span>
        {mode === 'gate' && <span className="chip">🔒 gate</span>}
        {mode === 'local' && <span className="chip">🔑</span>}
        {!hasKey && !meta.local && <span className="chip" style={{ opacity: 0.55 }}>no key</span>}
        <span className="grow" />
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="prov-detail">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-all' }}>
              {meta.defaultBase}
            </span>
            {meta.keyUrl && (
              <a href={meta.keyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                get key ↗
              </a>
            )}
            {meta.local && <span className="chip">local</span>}
            {!PROVIDERS[meta.id] && (
              <button
                className="btn btn-danger"
                style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }}
                title="Delete this custom provider"
                onClick={() => {
                  saveSettings({
                    customProviders: loadSettings().customProviders.filter((c) => c.id !== meta.id),
                  });
                  invalidate(meta.id);
                  toast(`${meta.name} deleted`);
                  window.dispatchEvent(new Event('relay-providers-changed'));
                }}
              >
                Delete provider
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {editingKey ? (
              <>
                <input
                  type="password"
                  autoFocus
                  placeholder={`${meta.name} API key${meta.local ? ' (often optional)' : ''}`}
                  value={draft}
                  style={{ flex: 1, minWidth: 160 }}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void saveKey()}
                />
                <button className="btn btn-primary" onClick={() => void saveKey()}>
                  Save
                </button>
                <button className="btn" onClick={() => setEditingKey(false)}>
                  Cancel
                </button>
              </>
            ) : hasKey ? (
              <>
                <button className="btn" onClick={() => void test()}>
                  Test
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => void useVaultStore.getState().removeKey(meta.id).then(() => force((n) => n + 1))}
                >
                  Remove key
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setEditingKey(true)}>
                Set API key
              </button>
            )}

            <button
              className="btn"
              disabled={!hasKey && !meta.local}
              onClick={() => void load()}
            >
              {isLoaded(meta.id) ? 'Refresh models' : 'Load models'}
            </button>
          </div>

          {(isLoaded(meta.id) || status !== 'idle') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {status === 'loading' && (
                <span className="dots" aria-label="loading">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              {status === 'error' && <span style={{ color: 'var(--err)', fontSize: 12.5 }}>fetch failed — check key / base URL</span>}
              {models.map((m) => (
                <button key={m.id} className={`chip model-chip ${isChatCapable(m) ? '' : 'aux'}`} title={[m.id, ...m.caps].join(' · ')} onClick={() => pick(m)}>
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {!isLoaded(meta.id) && status === 'idle' && (meta.popular?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>SUGGESTED</span>
              {meta.popular!.map((id) => (
                  <button
                    key={id}
                    className="chip model-chip"
                    onClick={() =>
                      pick({
                        id,
                        providerId: meta.id,
                        label: id.replace(/[-_/.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                        caps: [],
                      })
                    }
                  >
                    {id}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Add any OpenAI-compatible endpoint as a first-class provider. */
function AddProviderRow({ onAdded }: { onAdded: () => void }) {
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
      <button className="prov-row-line" style={{ borderStyle: 'dashed', color: 'var(--muted)' }} onClick={() => setAdding(true)}>
        ＋ Add custom provider
      </button>
    );

  return (
    <div className="prov-detail" style={{ borderTop: '1px solid var(--hairline)', marginTop: 6 }}>
      <strong>Add custom provider</strong>
      <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="https://host/v1" value={base} onChange={(e) => setBase(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
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

export function ProvidersPage() {
  const [q, setQ] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    const h = () => tick((t) => t + 1);
    window.addEventListener('relay-providers-changed', h);
    return () => window.removeEventListener('relay-providers-changed', h);
  }, []);

  // Live search across provider names and ids ("groq", "grove", "ollama"…).
  const providers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = listProviders();
    if (!needle) return all;
    return all.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(needle));
  }, [q]);

  return (
    <div className="providers-page">
      <h2 style={{ margin: 0 }}>Providers & models</h2>
      <input
        className="prov-search"
        placeholder="Search providers… (e.g. groq, openrouter, ollama)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search providers"
      />
      <div className="prov-list">
        {providers.map((p) => (
          <ProviderRow key={p.id} meta={p} />
        ))}
        {providers.length === 0 && (
          <p style={{ color: 'var(--muted)', padding: 12 }}>No providers match “{q}”.</p>
        )}
        <AddProviderRow onAdded={() => tick((t) => t + 1)} />
      </div>
    </div>
  );
}
