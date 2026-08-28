import { useState } from 'react';
import { X, Lock, ChevronDown, ChevronRight, Star } from 'lucide-react';
import type { ProviderId } from '../../catalog/types';
import { useUiStore } from '../../state/uiStore';
import { listProviders, PROVIDERS, PROVIDER_IDS } from '../../catalog/providers';
import { isAllowedBase } from '../../adapters/base';
import { loadSettings, saveSettings } from '../../state/settings';
import { toast } from '../../lib/toast';
import { useVaultStore } from '../../vault/vaultStore';
import { DataPort } from './DataPort';
import { custodyOf, enrollToGate, revokeOnGate } from '../../vault/gate';

/**
 * Settings — one concern per section, in the order users need them:
 *   1. KEYS      — paste/save per provider (testing lives on the Providers page)
 *   2. CUSTODY   — split-key relay-gate enrollment per provider
 *   3. DATA      — backup / restore / export
 *   4. APP       — auto-lock, context budget
 *   5. ADVANCED  — base-URL overrides (compatible/local providers only)
 */
export function SettingsSheet() {
  const setSettingsOpen = useUiStore((st) => st.setSettingsOpen);
  const keys = useVaultStore((s) => s.keys);
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [flash, setFlash] = useState<Partial<Record<ProviderId, string>>>({});
  const [autoLockMin, setAutoLockMin] = useState(loadSettings().autoLockMin);
  const [budget, setBudget] = useState(loadSettings().contextBudgetTokens);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    keys: true,
    instructions: true,
    favorites: true,
    custody: false,
    data: true,
    app: true,
    advanced: false,
  });
  // Track initial values so blur handlers only save + toast on real changes.
  const initialRef = useState(() => loadSettings())[0];

  function toggleSection(section: string) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function removeFavorite(providerId: ProviderId, modelId: string) {
    const settings = loadSettings();
    saveSettings({
      favoriteModels: settings.favoriteModels.filter(
        (f) => !(f.providerId === providerId && f.modelId === modelId)
      ),
    });
    toast('Removed from favorites');
  }

  async function saveKey(p: ProviderId) {
    const v = drafts[p]?.trim();
    if (!v) return;
    await useVaultStore.getState().setKey(p, v);
    setDrafts((d) => ({ ...d, [p]: '' }));
    setFlash((f) => ({ ...f, [p]: '✓ saved — loading models…' }));
    const { ensureModels } = await import('../../catalog');
    try {
      const ms = await ensureModels(p);
      setFlash((f) => ({ ...f, [p]: `✓ saved · ${ms.length} models ready` }));
    } catch (e) {
      setFlash((f) => ({ ...f, [p]: `saved, but model load failed: ${e instanceof Error ? e.message : 'unknown error'}` }));
    }
    setTimeout(() => setFlash((f) => ({ ...f, [p]: '' })), 3000);
  }

  return (
    <div
      className="sheet"
      role="dialog"
      aria-label="Settings"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="icon-btn" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* 1 · KEYS ------------------------------------------------------------ */}
        <button
          className="sec-title"
          onClick={() => toggleSection('keys')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.keys ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          API keys
        </button>
        {expandedSections.keys && listProviders().map((pm) => (
          <div className="field" key={pm.id}>
            <label htmlFor={`set-${pm.id}`}>
              {pm.keyUrl ? (
                <a href={pm.keyUrl} target="_blank" rel="noreferrer">
                  {pm.name} ↗
                </a>
              ) : (
                pm.name
              )}
              <span style={{ opacity: 0.55 }}> · {keys[pm.id] ? 'stored' : 'not set'}</span>
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id={`set-${pm.id}`}
                type="password"
                placeholder={keys[pm.id] ? '••••••••••••' : pm.local ? 'usually optional' : 'paste key…'}
                value={drafts[pm.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [pm.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && void saveKey(pm.id)}
              />
              <button className="btn" onClick={() => void saveKey(pm.id)} disabled={!drafts[pm.id]?.trim()}>
                Save
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  void useVaultStore.getState().removeKey(pm.id);
                  toast(`${pm.name} key removed`);
                }}
                disabled={!keys[pm.id]}
              >
                <X size={13} aria-hidden />
              </button>
            </div>
            {flash[pm.id] && <span className="key-status ok">{flash[pm.id]}</span>}
          </div>
        ))}

        <hr className="sec-div" />

        {/* FAVORITES ----------------------------------------------------------- */}
        <button
          className="sec-title"
          onClick={() => toggleSection('favorites')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.favorites ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Star size={14} aria-hidden /> Favorite models
        </button>
        {expandedSections.favorites && (
          <div className="field">
            {loadSettings().favoriteModels.length === 0 ? (
              <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                No favorites yet. Star models in the palette (⌘K) to add them here.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loadSettings().favoriteModels.map((fav) => (
                  <div
                    key={`${fav.providerId}/${fav.modelId}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--paper)', borderRadius: 6 }}
                  >
                    <span style={{ fontSize: 13 }}>{fav.label}</span>
                    <button
                      className="btn btn-danger"
                      onClick={() => removeFavorite(fav.providerId, fav.modelId)}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <hr className="sec-div" />

        {/* CUSTOM INSTRUCTIONS ------------------------------------------------- */}
        <button
          className="sec-title"
          onClick={() => toggleSection('instructions')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.instructions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Custom instructions
        </button>
        {expandedSections.instructions && (
          <>
            <div className="field">
              <label htmlFor="sysprompt">How should the AI respond? (applies to every chat)</label>
              <textarea
                id="sysprompt"
                className="ui-textarea"
                rows={3}
                placeholder="e.g. You are a concise assistant. Prefer bullet points. Answer in English."
                defaultValue={initialRef.systemPrompt}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v === initialRef.systemPrompt) return;
                  saveSettings({ systemPrompt: v });
                  toast('Custom instructions saved');
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="temp">
                Temperature · <span style={{ fontFamily: 'var(--font-mono)' }}>{loadSettings().temperature}</span>{' '}
                (lower = focused, higher = creative)
              </label>
              <input
                id="temp"
                type="range"
                min={0}
                max={2}
                step={0.1}
                defaultValue={loadSettings().temperature}
                onChange={(e) => saveSettings({ temperature: Number(e.target.value) })}
              />
            </div>
          </>
        )}

        <hr className="sec-div" />

        {/* 2 · CUSTODY --------------------------------------------------------- */}
        <button
          className="sec-title"
          onClick={() => toggleSection('custody')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.custody ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Split-key custody (relay-gate)
        </button>
        {expandedSections.custody && (
          <>
            <div className="field">
              <label htmlFor="gate">Gate URL</label>
              <input
                id="gate"
                placeholder="https://your-gate.example.com"
                defaultValue={initialRef.gateUrl}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === initialRef.gateUrl) return;
                  saveSettings({ gateUrl: v });
                  toast('Gate URL saved');
                }}
              />
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
                      <button
                        className="btn btn-danger"
                        onClick={() =>
                          void revokeOnGate(p)
                            .then(() => toast('Revoked on gate'))
                            .catch((e) => toast(e.message))
                        }
                      >
                        Revoke
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={() =>
                          void enrollToGate(p, PROVIDERS[p].kind)
                            .then(() => toast(`${PROVIDERS[p].name} enrolled`))
                            .catch((e) => toast(e.message))
                        }
                      >
                        Enroll
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <hr className="sec-div" />

        {/* 3 · DATA ------------------------------------------------------------ */}
        <button
          className="sec-title"
          onClick={() => toggleSection('data')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.data ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Data
        </button>
        {expandedSections.data && <DataPort />}

        <hr className="sec-div" />

        {/* 4 · APP -------------------------------------------------------------- */}
        <button
          className="sec-title"
          onClick={() => toggleSection('app')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.app ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          App
        </button>
        {expandedSections.app && (
          <>
            <div className="field">
              <label htmlFor="autolock">Auto-lock vault after (minutes idle)</label>
              <input
                id="autolock"
                type="number"
                min={1}
                max={240}
                style={{ width: 130 }}
                value={autoLockMin}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(240, Number(e.target.value) || 15));
                  setAutoLockMin(v);
                  saveSettings({ autoLockMin: v });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="budget">Context budget — compact history beyond (~tokens)</label>
              <input
                id="budget"
                type="number"
                min={2000}
                max={200000}
                step={1000}
                style={{ width: 130 }}
                value={budget}
                onChange={(e) => {
                  const v = Math.max(2000, Math.min(200000, Number(e.target.value) || 12000));
                  setBudget(v);
                  saveSettings({ contextBudgetTokens: v });
                }}
              />
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Older turns fold into a rolling AI memory so long threads stay cheap on every model.
              </span>
            </div>
          </>
        )}

        <hr className="sec-div" />

        {/* 5 · ADVANCED ---------------------------------------------------------- */}
        <button
          className="sec-title"
          onClick={() => toggleSection('advanced')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
        >
          {expandedSections.advanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced — base URL overrides
        </button>
        {expandedSections.advanced && (
          <>
            <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: 12.5 }}>
              Only for compatible/local providers or proxies. https required; localhost exempt.
            </p>
            {PROVIDER_IDS.filter((p) => PROVIDERS[p].kind === 'compatible' || loadSettings().bases[p]).map((p) => (
              <div className="field" key={`b-${p}`}>
                <label htmlFor={`base-${p}`}>{PROVIDERS[p].name}</label>
                <input
                  id={`base-${p}`}
                  placeholder={PROVIDERS[p].defaultBase}
                  defaultValue={loadSettings().bases[p] ?? ''}
                  onBlur={(e) => {
                    const clean = e.target.value.trim();
                    if (clean && !isAllowedBase(clean)) {
                      toast('Base must be https (localhost exempt).');
                      return;
                    }
                    saveSettings({ bases: { ...loadSettings().bases, [p]: clean } });
                  }}
                />
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
  );
}
