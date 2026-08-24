import { describe, it, expect, beforeEach } from 'vitest';
import { resolveDeps, custodyOf } from '../../src/vault/gate';
import { useVaultStore } from '../../src/vault/vaultStore';
import { saveSettings } from '../../src/state/settings';

describe('resolveDeps / custodyOf', () => {
  beforeEach(() => {
    localStorage.clear();
    useVaultStore.getState().init();
    useVaultStore.setState({ keys: {}, gateRecords: {}, status: 'unlocked' });
    saveSettings({ gateUrl: '' });
  });

  it('uses direct provider base + key when not enrolled', () => {
    useVaultStore.setState({ keys: { openai: 'sk-local' } });
    const deps = resolveDeps('openai');
    expect(deps.baseUrl).toContain('api.openai.com');
    expect(deps.apiKey()).toBe('sk-local');
    expect(custodyOf('openai')).toBe('local');
  });

  it('routes through the gate when enrolled', () => {
    saveSettings({ gateUrl: 'https://gate.test' });
    useVaultStore.setState({
      keys: {},
      gateRecords: { openai: { recordId: 'rec1', pairingKey: 'pair1' } },
    });
    const deps = resolveDeps('openai');
    expect(deps.baseUrl).toBe('https://gate.test/v1/rec1');
    expect(deps.apiKey()).toBe('pair1');
    expect(custodyOf('openai')).toBe('gate');
  });

  it('reports none when no key exists anywhere', () => {
    expect(custodyOf('openai')).toBe('none');
  });
});
