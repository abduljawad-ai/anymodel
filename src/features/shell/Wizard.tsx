import { useState } from 'react';
import { useVaultStore } from '../../vault/vaultStore';
import { useUiStore } from '../../state/uiStore';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase } from '../../adapters/base';
import type { ProviderId } from '../../catalog/types';
import { PROVIDERS } from '../../catalog/providers';
const QUICK = ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'openrouter'] as const;
const QUICK_IDS = [...QUICK];

/**
 * First-run gate: create passphrase → optionally add keys (with live
 * connection test) → enter the app.
 */
export function Wizard() {
  // 'empty' vault → create flow. 'locked' vault → unlock flow.
  // 'unlocked' (keyless) → straight to key setup.
  const initialStatus = useVaultStore.getState().status;
  const [mode, setMode] = useState<'create' | 'unlock' | 'keys'>(
    initialStatus === 'unlocked' ? 'keys' : initialStatus === 'locked' ? 'unlock' : 'create'
  );
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [testState, setTestState] = useState<Partial<Record<ProviderId, string>>>({});

  async function createPassphrase() {
    if (pass.length < 8) return setErr('Use at least 8 characters.');
    if (pass !== pass2) return setErr('Passphrases do not match.');
    setErr('');
    setBusy(true);
    try {
      await useVaultStore.getState().createVault(pass);
      // Keep the wizard mounted for the guided key-setup step (status is now
      // 'unlocked', which would otherwise drop the user straight into the app).
      useUiStore.getState().setInSetup(true);
      setMode('keys');
    } finally {
      setBusy(false);
    }
  }

  async function unlockVault() {
    if (!pass) return setErr('Enter your passphrase.');
    setErr('');
    setBusy(true);
    try {
      const ok = await useVaultStore.getState().unlock(pass);
      if (!ok) {
        setErr('Wrong passphrase — try again.');
        setPass('');
      } else {
        // Returning user — go straight to the app shell.
        useUiStore.getState().setInSetup(false);
        setPass('');
      }
    } finally {
      setBusy(false);
    }
  }

  function skipToApp() {
    // Vault is already unlocked (created in step 1); leave setup and enter the app.
    useUiStore.getState().setInSetup(false);
    window.location.reload();
  }

  async function saveAndTest(p: ProviderId) {
    const key = keyDrafts[p]?.trim();
    if (!key) return;
    if (testState[p] === 'testing…') return; // busy guard — no double-fire
    try {
      await useVaultStore.getState().setKey(p, key);
      setTestState((s) => ({ ...s, [p]: 'testing…' }));
      const adapter = createAdapter(p, {
        baseUrl: effectiveBase(p),
        apiKey: () => useVaultStore.getState().keys[p],
      });
      const res = await adapter.testConnection();
      setTestState((s) => ({ ...s, [p]: res.ok ? `✓ ${res.detail}` : `✗ ${res.detail}` }));
      // Models for this provider are now one click away everywhere — preload.
      const { ensureModels } = await import('../../catalog');
      const ms = await ensureModels(p);
      if (ms.length === 0) setTestState((s) => ({ ...s, [p]: '✓ key saved (no models listed)' }));
    } catch (e) {
      setTestState((s) => ({ ...s, [p]: `✗ ${e instanceof Error ? e.message : 'save failed'}` }));
    }
  }

  return (
    <div className="wizard">
      <div className="wizard-card">
        <div className="rail-brand" style={{ marginBottom: 4 }}>
          <span className="glyph">⟐</span> Relay
        </div>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          One thread. Every model. Your keys never leave this browser.
        </p>

        {mode === 'create' && (
          <>
            <div className="wizard-step">STEP 1 / 2 — VAULT PASSPHRASE</div>
            <div className="field">
              <label htmlFor="w-pass">Passphrase (encrypts your API keys at rest)</label>
              <input
                id="w-pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="min 8 characters"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="w-pass2">Repeat passphrase</label>
              <input id="w-pass2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
            </div>
            {err && <p className="key-status err">{err}</p>}
            <div className="wizard-actions">
              <span />
              <button className="btn btn-primary" onClick={createPassphrase} disabled={busy}>
                Create vault →
              </button>
            </div>
          </>
        )}

        {mode === 'unlock' && (
          <>
            <div className="wizard-step">VAULT LOCKED — ENTER PASSPHRASE</div>
            <div className="field">
              <label htmlFor="w-unlock">Passphrase</label>
              <input
                id="w-unlock"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="your vault passphrase"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void unlockVault();
                }}
              />
            </div>
            {err && <p className="key-status err">{err}</p>}
            <div className="wizard-actions">
              <button
                className="btn btn-danger"
                title="Erase the encrypted vault and start fresh (deletes stored keys)"
                onClick={() => {
                  if (window.confirm('Erase this vault and all stored keys? This cannot be undone.')) {
                    localStorage.removeItem('relay.vault.v1');
                    window.location.reload();
                  }
                }}
              >
                Reset vault
              </button>
              <button className="btn btn-primary" onClick={() => void unlockVault()} disabled={busy}>
                Unlock →
              </button>
            </div>
          </>
        )}

        {mode === 'keys' && (
          <>
            <div className="wizard-step">STEP 2 / 2 — ADD KEYS (ANY OR ALL)</div>
            {QUICK_IDS.map((p) => (
              <div className="field" key={p}>
                <label htmlFor={`k-${p}`}>
                  <a href={PROVIDERS[p].keyUrl} target="_blank" rel="noreferrer">{PROVIDERS[p].name} API key ↗</a>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    id={`k-${p}`}
                    type="password"
                    placeholder={PROVIDERS[p].local ? 'optional for local servers' : 'paste key…'}
                    value={keyDrafts[p] ?? ''}
                    onChange={(e) => setKeyDrafts((s) => ({ ...s, [p]: e.target.value }))}
                  />
                  <button className="btn" onClick={() => saveAndTest(p)}>
                    Save + test
                  </button>
                </div>
                {testState[p] && (
                  <span className={`key-status ${testState[p]?.startsWith('✓') ? 'ok' : 'err'}`}>
                    {testState[p]}
                  </span>
                )}
              </div>
            ))}
            <div className="wizard-actions">
              <span />
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={skipToApp} title="Skip for now — add keys later via Settings">
                  Skip for now
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!useVaultStore.getState().hasAnyKey()) {
                      setErr('Add at least one key to continue (or skip for now).');
                      return;
                    }
                    setErr('');
                    useUiStore.getState().setInSetup(false);
                    window.location.reload();
                  }}
                >
                  Start chatting →
                </button>
              </span>
            </div>
            {err && <p className="key-status err">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
