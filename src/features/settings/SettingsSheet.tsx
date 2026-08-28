import { useState } from 'react';
import { X, Lock, ChevronDown, ChevronRight, Star, Plus } from 'lucide-react';
import type { ProviderId } from '../../catalog/types';
import { useUiStore } from '../../state/uiStore';
import { listProviders, PROVIDERS, PROVIDER_IDS } from '../../catalog/providers';
import { isAllowedBase } from '../../adapters/base';
import { loadSettings, saveSettings } from '../../state/settings';
import { toast } from '../../lib/toast';
import { useVaultStore } from '../../vault/vaultStore';
import { DataPort } from './DataPort';
import { custodyOf, enrollToGate, revokeOnGate } from '../../vault/gate';

const SECTIONS = ['keys', 'favorites', 'instructions', 'custody', 'data', 'app', 'advanced'] as const;
type Section = (typeof SECTIONS)[number];

function SectionHeader({
  label,
  open,
  icon,
  badge,
  onClick,
}: {
  label: string;
  open: boolean;
  icon?: React.ReactNode;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button className="sec-title" onClick={onClick}>
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span className="chip" style={{ fontSize: 11, marginLeft: 4 }}>{badge} stored</span>
      )}
    </button>
  );
}

export function SettingsSheet() {
  const setSettingsOpen = useUiStore((st) => st.setSettingsOpen);
  const keys = useVaultStore((s) => s.keys);
  const initial = loadSettings();

  const [autoLockMin, setAutoLockMin] = useState(initial.autoLockMin);
  const [budget, setBudget] = useState(initial.contextBudgetTokens);
  const [sections, setSections] = useState<Record<Section, boolean>>({
    keys: true,
    favorites: false,
    instructions: false,
    custody: false,
    data: false,
    app: false,
    advanced: false,
  });
  const [addingKey, setAddingKey] = useState(false);
  const [addProvider, setAddProvider] = useState<ProviderId | ''>('');
  const [addDraft, setAddDraft] = useState('');

  const toggle = (s: Section) => setSections((p) => ({ ...p, [s]: !p[s] }));

  function removeFavorite(providerId: ProviderId, modelId: string) {
    const s = loadSettings();
    saveSettings({
      favoriteModels: s.favoriteModels.filter((f) => !(f.providerId === providerId && f.modelId === modelId)),
    });
    toast('Removed from favorites');
  }

  async function saveNewKey() {
    if (!addProvider || !addDraft.trim()) return;
    await useVaultStore.getState().setKey(addProvider, addDraft.trim());
    toast(`${PROVIDERS[addProvider]?.name ?? addProvider} key saved`);
    setAddDraft('');
    setAddProvider('');
    setAddingKey(false);
    const { ensureModels } = await import('../../catalog');
    try { await ensureModels(addProvider); } catch { /* best effort */ }
  }

  return (
    <>
    <div className="settings-scrim" onClick={() => setSettingsOpen(false)} aria-hidden />
    <div className="settings-panel" role="dialog" aria-label="Settings" onMouseDown={(e) => {
      if (e.target === e.currentTarget) setSettingsOpen(false);
    }}>
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="icon-btn" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* ── API KEYS ────────────────────────────────────────────── */}
        <SectionHeader label="API keys" open={sections.keys} badge={Object.keys(keys).length} onClick={() => toggle('keys')} />
        {sections.keys && (
          <>
            {Object.keys(keys).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.keys(keys).map((pid) => {
                  const p = PROVIDERS[pid] ?? listProviders().find((l) => l.id === pid);
                  return (
                    <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--paper)', borderRadius: 6, fontSize: 13 }}>
                      <span className="tint-dot" style={{ ['--tint' as string]: p?.tint }} />
                      <span style={{ fontWeight: 500 }}>{p?.name ?? pid}</span>
                      <span className="key-status" style={{ color: 'var(--ok)', fontSize: 11 }}>stored</span>
                      <span style={{ flex: 1 }} />
                      <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => {
                        void useVaultStore.getState().removeKey(pid as ProviderId);
                        toast(`${p?.name ?? pid} key removed`);
                      }}>Remove</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5 }}>
                No keys stored. Add one below, or manage keys on the Providers page.
              </p>
            )}

            {!addingKey ? (
              <button className="btn" style={{ alignSelf: 'flex-start', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setAddingKey(true)}>
                <Plus size={13} aria-hidden /> Add key
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, padding: '8px 10px', background: 'var(--paper)', borderRadius: 6 }}>
                <select value={addProvider} onChange={(e) => setAddProvider(e.target.value as ProviderId)} style={{ flex: '0 0 130px', padding: '5px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--hairline)' }}>
                  <option value="">Select provider…</option>
                  {listProviders().map((pm) => (
                    <option key={pm.id} value={pm.id} disabled={!!keys[pm.id]}>
                      {pm.name}{keys[pm.id] ? ' (has key)' : ''}
                    </option>
                  ))}
                </select>
                <input type="password" placeholder="paste key…" value={addDraft} style={{ flex: 1, minWidth: 100, padding: '5px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--hairline)' }} onChange={(e) => setAddDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void saveNewKey()} />
                <button className="btn btn-primary" disabled={!addProvider || !addDraft.trim()} onClick={() => void saveNewKey()}>Save</button>
                <button className="btn" onClick={() => { setAddingKey(false); setAddDraft(''); setAddProvider(''); }}>Cancel</button>
              </div>
            )}
          </>
        )}

        <hr className="sec-div" />

        {/* ── FAVORITES ───────────────────────────────────────────── */}
        <SectionHeader label="Favorite models" open={sections.favorites} icon={<Star size={14} aria-hidden />} onClick={() => toggle('favorites')} />
        {sections.favorites && (
          <div className="field">
            {initial.favoriteModels.length === 0 ? (
              <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                No favorites yet. Star models in the palette (⌘K) to add them here.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {initial.favoriteModels.map((fav) => (
                  <div key={`${fav.providerId}/${fav.modelId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--paper)', borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>{fav.label}</span>
                    <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeFavorite(fav.providerId, fav.modelId)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <hr className="sec-div" />

        {/* ── CUSTOM INSTRUCTIONS ─────────────────────────────────── */}
        <SectionHeader label="Custom instructions" open={sections.instructions} onClick={() => toggle('instructions')} />
        {sections.instructions && (
          <>
            <div className="field">
              <label htmlFor="sysprompt">How should the AI respond? (applies to every chat)</label>
              <textarea id="sysprompt" className="ui-textarea" rows={3} placeholder="e.g. You are a concise assistant. Prefer bullet points. Answer in English." defaultValue={initial.systemPrompt} onBlur={(e) => {
                const v = e.target.value;
                if (v === initial.systemPrompt) return;
                saveSettings({ systemPrompt: v });
                toast('Custom instructions saved');
              }} />
            </div>
            <div className="field">
              <label htmlFor="temp">
                Temperature · <span style={{ fontFamily: 'var(--font-mono)' }}>{initial.temperature}</span> (lower = focused, higher = creative)
              </label>
              <input id="temp" type="range" min={0} max={2} step={0.1} defaultValue={initial.temperature} onChange={(e) => saveSettings({ temperature: Number(e.target.value) })} />
            </div>
          </>
        )}

        <hr className="sec-div" />

        {/* ── SPLIT-KEY CUSTODY ───────────────────────────────────── */}
        <SectionHeader label="Split-key custody" open={sections.custody} onClick={() => toggle('custody')} />
        {sections.custody && (
          <>
            <div className="field">
              <label htmlFor="gate">Gate URL</label>
              <input id="gate" placeholder="https://your-gate.example.com" defaultValue={initial.gateUrl} onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === initial.gateUrl) return;
                saveSettings({ gateUrl: v });
                toast('Gate URL saved');
              }} />
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Enrolled providers send only a pairing key through your gate — the real API key never touches this browser again.
              </span>
            </div>
            {PROVIDER_IDS.filter((p) => custodyOf(p) !== 'none').map((p) => {
              const mode = custodyOf(p);
              return (
                <div className="field" key={`c-${p}`}>
                  <label>{PROVIDERS[p].name}</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="chip">{mode === 'gate' ? '🔒 gate-held' : 'local'}</span>
                    {mode === 'gate' ? (
                      <button className="btn btn-danger" onClick={() => void revokeOnGate(p).then(() => toast('Revoked on gate')).catch((e) => toast(e.message))}>Revoke</button>
                    ) : (
                      <button className="btn" onClick={() => void enrollToGate(p, PROVIDERS[p].kind).then(() => toast(`${PROVIDERS[p].name} enrolled`)).catch((e) => toast(e.message))}>Enroll</button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <hr className="sec-div" />

        {/* ── DATA ─────────────────────────────────────────────────── */}
        <SectionHeader label="Data" open={sections.data} onClick={() => toggle('data')} />
        {sections.data && <DataPort />}

        <hr className="sec-div" />

        {/* ── APP ──────────────────────────────────────────────────── */}
        <SectionHeader label="App" open={sections.app} onClick={() => toggle('app')} />
        {sections.app && (
          <>
            <div className="field">
              <label htmlFor="autolock">Auto-lock vault after (minutes idle)</label>
              <input id="autolock" type="number" min={1} max={240} style={{ width: 130 }} value={autoLockMin} onChange={(e) => {
                const v = Math.max(1, Math.min(240, Number(e.target.value) || 15));
                setAutoLockMin(v);
                saveSettings({ autoLockMin: v });
              }} />
            </div>
            <div className="field">
              <label htmlFor="budget">Context budget — compact history beyond (~tokens)</label>
              <input id="budget" type="number" min={2000} max={200000} step={1000} style={{ width: 130 }} value={budget} onChange={(e) => {
                const v = Math.max(2000, Math.min(200000, Number(e.target.value) || 12000));
                setBudget(v);
                saveSettings({ contextBudgetTokens: v });
              }} />
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Older turns fold into a rolling AI memory so long threads stay cheap on every model.
              </span>
            </div>
          </>
        )}

        <hr className="sec-div" />

        {/* ── ADVANCED ─────────────────────────────────────────────── */}
        <SectionHeader label="Advanced — base URL overrides" open={sections.advanced} onClick={() => toggle('advanced')} />
        {sections.advanced && (
          <>
            <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: 12.5 }}>
              Only for compatible/local providers or proxies. https required; localhost exempt.
            </p>
            {PROVIDER_IDS.filter((p) => PROVIDERS[p].kind === 'compatible' || initial.bases[p]).map((p) => (
              <div className="field" key={`b-${p}`}>
                <label htmlFor={`base-${p}`}>{PROVIDERS[p].name}</label>
                <input id={`base-${p}`} placeholder={PROVIDERS[p].defaultBase} defaultValue={initial.bases[p] ?? ''} onBlur={(e) => {
                  const clean = e.target.value.trim();
                  if (clean && !isAllowedBase(clean)) {
                    toast('Base must be https (localhost exempt).');
                    return;
                  }
                  saveSettings({ bases: { ...loadSettings().bases, [p]: clean } });
                }} />
              </div>
            ))}
          </>
        )}

        <div className="wizard-actions">
          <button className="btn btn-danger" onClick={() => useVaultStore.getState().lock()}>
            <Lock size={13} aria-hidden /> Lock vault
          </button>
          <span />
        </div>
      </div>
    </div>
    </>
  );
}
