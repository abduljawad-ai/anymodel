import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { useVaultStore } from '../../vault/vaultStore';
import { idbClear } from '../../vault/idb';
import { useUiStore } from '../../state/uiStore';
import type { ProviderId } from '../../catalog/types';
import { PROVIDERS } from '../../catalog/providers';
import { confirmDialog } from '../../lib/confirmDialog';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase } from '../../adapters/base';

const QUICK = ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'openrouter'] as const;
const QUICK_IDS = [...QUICK];

type Mode = 'create' | 'unlock' | 'keys';

export function Wizard() {
  const initialStatus = useVaultStore.getState().status;
  const [mode, setMode] = useState<Mode>(
    initialStatus === 'unlocked' ? 'keys' : initialStatus === 'locked' ? 'unlock' : 'create',
  );
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [testState, setTestState] = useState<Partial<Record<ProviderId, string>>>({});

  const inputType = showPass ? 'text' : 'password';

  function validateCreate(): boolean {
    if (pass.length < 8) { setErr('Use at least 8 characters.'); return false; }
    if (pass !== pass2) { setErr('Passphrases do not match.'); return false; }
    setErr('');
    return true;
  }

  async function createPassphrase() {
    if (!validateCreate()) return;
    setBusy(true);
    try {
      await useVaultStore.getState().createVault(pass);
      useUiStore.getState().setInSetup(true);
      setMode('keys');
    } finally {
      setBusy(false);
    }
  }

  async function unlockVault() {
    if (!pass) { setErr('Enter your passphrase.'); return; }
    setErr('');
    setBusy(true);
    try {
      const ok = await useVaultStore.getState().unlock(pass);
      if (!ok) {
        setErr('Wrong passphrase — try again.');
        setPass('');
      } else {
        useUiStore.getState().setInSetup(false);
        setPass('');
      }
    } finally {
      setBusy(false);
    }
  }

  async function resetVault() {
    const ok = await confirmDialog('Erase this vault and all stored keys? This cannot be undone.', {
      title: 'Reset vault',
      confirmLabel: 'Erase',
      destructive: true,
    });
    if (ok) {
      localStorage.removeItem('relay.vault.v1');
      await idbClear();
      window.location.reload();
    }
  }

  function skipToApp() {
    useUiStore.getState().setInSetup(false);
  }

  async function saveAndTest(p: ProviderId) {
    const key = keyDrafts[p]?.trim();
    if (!key || testState[p] === 'testing…') return;
    try {
      await useVaultStore.getState().setKey(p, key);
      setTestState((s) => ({ ...s, [p]: 'testing…' }));
      const adapter = createAdapter(p, {
        baseUrl: effectiveBase(p),
        apiKey: () => useVaultStore.getState().keys[p],
      });
      const res = await adapter.testConnection();
      setTestState((s) => ({ ...s, [p]: res.ok ? `✓ ${res.detail}` : `✗ ${res.detail}` }));
      const { ensureModels } = await import('../../catalog');
      const ms = await ensureModels(p);
      if (ms.length === 0) setTestState((s) => ({ ...s, [p]: '✓ key saved (no models listed)' }));
    } catch (e) {
      setTestState((s) => ({ ...s, [p]: `✗ ${e instanceof Error ? e.message : 'save failed'}` }));
    }
  }

  function finishKeys() {
    if (!useVaultStore.getState().hasAnyKey()) {
      setErr('Add at least one key to continue (or skip for now).');
      return;
    }
    setErr('');
    useUiStore.getState().setInSetup(false);
  }

  return (
    <div className="wizard">
      <div className="wizard-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 32, color: 'var(--accent)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>⟐</span>
          <span style={{ fontWeight: 700, fontSize: 22 }}>Relay</span>
        </div>
        <p style={{ color: 'var(--fg-muted)', marginTop: 0, marginBottom: 16, fontSize: 'var(--text-sm)' }}>
          One thread. Every model. Your keys never leave this browser.
        </p>

        {/* ── CREATE VAULT ──────────────────────────────────────── */}
        {mode === 'create' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-subtle)', margin: '12px 0 8px' }}>
              Step 1 / 2 — Vault Passphrase
            </div>
            <div className="field">
              <label htmlFor="w-pass">Passphrase (encrypts your API keys at rest)</label>
              <div style={{ position: 'relative' }}>
                <input className="input" id="w-pass" type={inputType} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createPassphrase()} placeholder="min 8 characters" autoFocus style={{ width: '100%', paddingRight: 36 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 2 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="w-pass2">Repeat passphrase</label>
              <input className="input" id="w-pass2" type={inputType} value={pass2} onChange={(e) => setPass2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createPassphrase()} placeholder="repeat passphrase" />
            </div>
            {err && <p className="wizard-err"><AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{err}</p>}
            <div className="wizard-actions">
              <span />
              <button className="btn btn-primary btn-md" onClick={() => void createPassphrase()} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : null} Create vault →
              </button>
            </div>
          </>
        )}

        {/* ── UNLOCK VAULT ──────────────────────────────────────── */}
        {mode === 'unlock' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-subtle)', margin: '12px 0 8px' }}>
              <Lock size={12} style={{ marginRight: 4, verticalAlign: -1 }} aria-hidden />
              Vault locked — enter passphrase
            </div>
            <div className="field">
              <label htmlFor="w-unlock">Passphrase</label>
              <div style={{ position: 'relative' }}>
                <input className="input" id="w-unlock" type={inputType} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="your vault passphrase" autoFocus onKeyDown={(e) => e.key === 'Enter' && void unlockVault()} style={{ width: '100%', paddingRight: 36 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 2 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {err && <p className="wizard-err"><AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{err}</p>}
            <div className="wizard-actions">
              <button className="btn btn-danger btn-md" title="Erase the encrypted vault and start fresh (deletes stored keys)" onClick={() => void resetVault()}>
                Reset vault
              </button>
              <button className="btn btn-primary btn-md" onClick={() => void unlockVault()} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : null} Unlock →
              </button>
            </div>
          </>
        )}

        {/* ── ADD KEYS ──────────────────────────────────────────── */}
        {mode === 'keys' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-subtle)', margin: '12px 0 8px' }}>
              <Sparkles size={12} style={{ marginRight: 4, verticalAlign: -1 }} aria-hidden />
              Step 2 / 2 — Add API Keys (any or all)
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: 12 }}>
              Keys are encrypted locally — they never leave your browser.
            </p>
            {QUICK_IDS.map((p) => (
              <div className="field" key={p}>
                <label htmlFor={`k-${p}`}>
                  <a href={PROVIDERS[p].keyUrl} target="_blank" rel="noreferrer">{PROVIDERS[p].name} API key ↗</a>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" id={`k-${p}`} type="password" placeholder={PROVIDERS[p].local ? 'optional for local servers' : 'paste key…'} value={keyDrafts[p] ?? ''} onChange={(e) => setKeyDrafts((s) => ({ ...s, [p]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && void saveAndTest(p)} />
                  <button className="btn btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => void saveAndTest(p)} disabled={!keyDrafts[p]?.trim() || testState[p] === 'testing…'}>
                    {testState[p] === 'testing…' ? <Loader2 size={12} className="spin" /> : null}
                    {testState[p] === 'testing…' ? 'Testing…' : 'Save + test'}
                  </button>
                </div>
                {testState[p] && testState[p] !== 'testing…' && (
                  <span className={`wizard-key-status ${testState[p]?.startsWith('✓') ? 'ok' : 'err'}`}>{testState[p]}</span>
                )}
              </div>
            ))}
            {err && <p className="wizard-err"><AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{err}</p>}
            <div className="wizard-actions">
              <span />
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-md" onClick={skipToApp} title="Skip for now — add keys later via Settings">Skip for now</button>
                <button className="btn btn-primary btn-md" onClick={finishKeys}>
                  <Sparkles size={14} aria-hidden /> Start chatting →
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
