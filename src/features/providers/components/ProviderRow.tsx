import { useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, Key, RefreshCw, Loader2 } from 'lucide-react';
import { cachedModels, ensureModels, invalidate, isChatCapable, isLoaded } from '../../../catalog';
import type { ModelInfo, ProviderMeta } from '../../../catalog/types';
import { PROVIDERS } from '../../../catalog/providers';
import { createAdapter } from '../../../adapters/factory';
import { resolveDeps, custodyOf } from '../../../vault/gate';
import { loadSettings, saveSettings } from '../../../state/settings';
import { useUiStore } from '../../../state/uiStore';
import { useVaultStore } from '../../../vault/vaultStore';
import { toast } from '../../../lib/toast';
import { onModelsChanged, ensureSaneActiveModel } from '../autoLoad';

export function ProviderRow({ meta }: { meta: ProviderMeta }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [editingKey, setEditingKey] = useState(false);
  const [draft, setDraft] = useState('');
  const [models, setModels] = useState<ModelInfo[]>(cachedModels(meta.id));
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const hasKey = !!useVaultStore((s) => s.keys[meta.id]);
  const mode = custodyOf(meta.id);

  useEffect(() => onModelsChanged(() => setModels(cachedModels(meta.id))), [meta.id]);

  async function saveKey() {
    if (!draft.trim()) return;
    await useVaultStore.getState().setKey(meta.id, draft);
    setDraft('');
    setEditingKey(false);
    toast(`${meta.name} key saved \u2014 loading models\u2026`);
    force((n) => n + 1);
    try {
      setModels(await ensureModels(meta.id));
      setOpen(true);
      ensureSaneActiveModel();
      toast(`${meta.name}: ${cachedModels(meta.id).length} models ready`);
    } catch {
      toast(`${meta.name}: could not fetch models \u2014 check key, use Refresh later`);
    }
  }

  async function test() {
    toast(`Testing ${meta.name}\u2026`);
    const r = await createAdapter(meta.id, resolveDeps(meta.id)).testConnection();
    toast(r.ok ? `\u2713 ${meta.name}: ${r.detail}` : `\u2717 ${meta.name}: ${r.detail}`);
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
    <div className={`prov-row${open ? ' expanded' : ''}`}>
      <button className="prov-row-line" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tint-dot" style={{ ['--tint' as string]: meta.tint }} />
        <strong>{meta.name}</strong>
        <span className="chip">{meta.kind === 'compatible' ? 'compat' : meta.kind}</span>
        {mode === 'gate' && <span className="chip">\uD83D\uDD12 gate</span>}
        {mode === 'local' && <span className="chip">\uD83D\uDD11</span>}
        {!hasKey && !meta.local && <span className="chip" style={{ opacity: 0.55 }}>no key</span>}
        <span style={{ flex: 1 }} />
        <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div className="prov-detail">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-all' }}>
              {meta.defaultBase}
            </span>
            {meta.keyUrl && (
              <a href={meta.keyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                get key <ExternalLink size={11} />
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

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                <Key size={12} /> Set API key
              </button>
            )}

            <button
              className="btn"
              disabled={!hasKey && !meta.local}
              onClick={() => void load()}
            >
              {status === 'loading' ? (
                <Loader2 size={12} className="spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {isLoaded(meta.id) ? ' Refresh' : ' Load'} models
            </button>
          </div>

          {(isLoaded(meta.id) || status !== 'idle') && (
            <div className="prov-models">
              {status === 'loading' && (
                <span className="dots" aria-label="loading">
                  <i /><i /><i />
                </span>
              )}
              {status === 'error' && (
                <span style={{ color: 'var(--err)', fontSize: 12.5 }}>fetch failed \u2014 check key / base URL</span>
              )}
              {models.map((m) => (
                <button
                  key={m.id}
                  className={`chip model-chip${isChatCapable(m) ? '' : ' aux'}`}
                  title={[m.id, ...m.caps].join(' \u00b7 ')}
                  onClick={() => pick(m)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {!isLoaded(meta.id) && status === 'idle' && (meta.popular?.length ?? 0) > 0 && (
            <div className="prov-models">
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
