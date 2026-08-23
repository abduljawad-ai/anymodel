import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [setSettingsOpen]);

  async function saveKey(p: ProviderId) {
    const v = drafts[p]?.trim();
    if (!v) return;
    await useVaultStore.getState().setKey(p, v);
    setDrafts((d) => ({ ...d, [p]: '' }));
    setFlash((f) => ({ ...f, [p]: '✓ saved' }));
    setTimeout(() => setFlash((f) => ({ ...f, [p]: '' })), 2000);
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
        <h2>Settings</h2>

        {/* 1 · KEYS ------------------------------------------------------------ */}
        <h3 className="sec-title">API keys</h3>
        {listProviders().map((pm) => (
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
                ✕
              </button>
            </div>
            {flash[pm.id] && <span className="key-status ok">{flash[pm.id]}</span>}
          </div>
        ))}

        <hr className="sec-div" />

        {/* 2 · CUSTODY --------------------------------------------------------- */}
        <h3 className="sec-title">Split-key custody (relay-gate)</h3>
        <div className="field">
          <label htmlFor="gate">Gate URL</label>
          <input
            id="gate"
            placeholder="https://your-gate.example.com"
            defaultValue={loadSettings().gateUrl}
            onBlur={(e) => {
              saveSettings({ gateUrl: e.target.value.trim() });
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

        <hr className="sec-div" />

        {/* 3 · DATA ------------------------------------------------------------ */}
        <h3 className="sec-title">Data</h3>
        <DataPort />

        <hr className="sec-div" />

        {/* 4 · APP -------------------------------------------------------------- */}
        <h3 className="sec-title">App</h3>
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

        <hr className="sec-div" />

        {/* 5 · ADVANCED ---------------------------------------------------------- */}
        <h3 className="sec-title">Advanced — base URL overrides</h3>
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

        <div className="wizard-actions">
          <button className="btn btn-danger" onClick={() => useVaultStore.getState().lock()}>
            🔒 Lock vault
          </button>
          <button className="btn btn-primary" onClick={() => setSettingsOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
