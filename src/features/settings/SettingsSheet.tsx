import { useEffect, useState } from 'react';
import type { ProviderId } from '../../catalog/types';
import { useUiStore } from '../../state/uiStore';
import { PROVIDERS, PROVIDER_IDS } from '../../catalog/providers';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase, isAllowedBase } from '../../adapters/base';
import { loadSettings, saveSettings } from '../../state/settings';
import { toast } from '../../lib/toast';
import { useVaultStore } from '../../vault/vaultStore';
import { DataPort } from './DataPort';

/** Bottom sheet: keys, custom bases, auto-lock, theme, data port. */
export function SettingsSheet() {
  const setSettingsOpen = useUiStore((st) => st.setSettingsOpen);
  const keys = useVaultStore((s) => s.keys);
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [status, setStatus] = useState<Partial<Record<ProviderId, string>>>({});
  const [bases, setBases] = useState(loadSettings().bases);
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
    setStatus((s) => ({ ...s, [p]: '✓ saved' }));
  }

  async function testKey(p: ProviderId) {
    if (!useVaultStore.getState().keys[p]) return;
    setStatus((s) => ({ ...s, [p]: 'testing…' }));
    const adapter = createAdapter(p, {
      baseUrl: effectiveBase(p),
      apiKey: () => useVaultStore.getState().keys[p],
    });
    const res = await adapter.testConnection();
    setStatus((s) => ({ ...s, [p]: res.ok ? `✓ ${res.detail}` : `✗ ${res.detail}` }));
  }

  function saveBase(p: ProviderId, url: string) {
    const clean = url.trim();
    if (clean && !isAllowedBase(clean)) {
      toast('Base URL must be https (localhost http allowed).');
      return;
    }
    const next = { ...bases, [p]: clean };
    setBases(next);
    saveSettings({ bases: next });
    toast('Base URL saved');
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

        <section aria-label="API keys">
          {PROVIDER_IDS.map((p) => (
            <div className="field" key={p}>
              <label htmlFor={`set-${p}`}>
                {PROVIDERS[p].name} key {keys[p] ? '· stored' : '· not set'}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id={`set-${p}`}
                  type="password"
                  placeholder={keys[p] ? '••••••••••••' : 'paste key…'}
                  value={drafts[p] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
                />
                <button className="btn" onClick={() => void saveKey(p)}>
                  Save
                </button>
                <button className="btn" onClick={() => void testKey(p)} disabled={!keys[p]}>
                  Test
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    void useVaultStore.getState().removeKey(p);
                    setStatus((s) => ({ ...s, [p]: 'removed' }));
                  }}
                  disabled={!keys[p]}
                >
                  ✕
                </button>
              </div>
              {status[p] && (
                <span className={`key-status ${status[p]?.startsWith('✓') ? 'ok' : status[p]?.startsWith('✗') ? 'err' : ''}`}>
                  {status[p]}
                </span>
              )}
            </div>
          ))}
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', margin: '18px 0' }} />

        <section aria-label="Custom base URLs">
          <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: 13 }}>
            Custom base URLs (OpenAI-compatible servers, proxies). https required; localhost exempt.
          </p>
          {PROVIDER_IDS.map((p) => (
            <div className="field" key={`b-${p}`}>
              <label htmlFor={`base-${p}`}>{PROVIDERS[p].name} base</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id={`base-${p}`}
                  placeholder={PROVIDERS[p].defaultBase}
                  defaultValue={bases[p] ?? ''}
                  onBlur={(e) => saveBase(p, e.target.value)}
                />
              </div>
            </div>
          ))}
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', margin: '18px 0' }} />

        <div className="field">
          <label htmlFor="autolock">Auto-lock vault after (minutes idle)</label>
          <input
            id="autolock"
            type="number"
            min={1}
            max={240}
            style={{ width: 110 }}
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
            Older turns fold into a rolling AI-written memory so long chats stay cheap on every model.
          </span>
        </div>

        <DataPort />

        <div className="wizard-actions">
          <button className="btn btn-danger" onClick={() => useVaultStore.getState().lock()}>
            🔒 Lock vault now
          </button>
          <button className="btn btn-primary" onClick={() => setSettingsOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
