import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVaultStore } from '../../src/vault/vaultStore';
import { saveSettings } from '../../src/state/settings';

describe('enrollToGate / revokeOnGate', () => {
  beforeEach(() => {
    localStorage.clear();
    useVaultStore.getState().init();
    useVaultStore.setState({ keys: {}, gateRecords: {}, status: 'unlocked' });
    saveSettings({ gateUrl: '' });
    vi.restoreAllMocks();
  });

  it('refuses to enroll without a gate URL', async () => {
    const { enrollToGate } = await import('../../src/vault/gate');
    useVaultStore.setState({ keys: { openai: 'sk' } });
    await expect(enrollToGate('openai', 'openai')).rejects.toThrow(/gate URL/i);
  });

  it('refuses to enroll without a local key', async () => {
    const { enrollToGate } = await import('../../src/vault/gate');
    saveSettings({ gateUrl: 'https://gate.test' });
    await expect(enrollToGate('openai', 'openai')).rejects.toThrow(/key locally/i);
  });

  it('enrolls and stores the gate record', async () => {
    const { enrollToGate } = await import('../../src/vault/gate');
    saveSettings({ gateUrl: 'https://gate.test' });
    useVaultStore.setState({ keys: { openai: 'sk-local' } });
    const fm = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ id: 'rec9' }), { status: 200 });
    });
    await enrollToGate('openai', 'openai');
    const rec = useVaultStore.getState().gateRecords.openai;
    expect(rec?.recordId).toBe('rec9');
    expect(rec?.pairingKey).toBeTruthy();
    fm.mockRestore();
  });

  it('revokes server-side and drops the record', async () => {
    const { revokeOnGate } = await import('../../src/vault/gate');
    saveSettings({ gateUrl: 'https://gate.test' });
    useVaultStore.setState({
      gateRecords: { openai: { recordId: 'rec1', pairingKey: 'pair1' } },
    });
    const fm = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 204 }));
    await revokeOnGate('openai');
    expect(useVaultStore.getState().gateRecords.openai).toBeUndefined();
    fm.mockRestore();
  });
});
