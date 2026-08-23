import type { ProviderId } from '../catalog/types';
import type { AdapterDeps } from '../adapters/types';
import { effectiveBase } from '../adapters/base';
import { loadSettings } from '../state/settings';
import { useVaultStore } from './vaultStore';
import { fetchWithRetry } from '../lib/net';

/**
 * Split-key custody (relay-gate). When a provider is enrolled, its adapter
 * traffic targets `${gate}/v1/<recordId>` and the pairing key rides in the
 * wire-format auth header — the gate accepts any of them. The real provider
 * key never touches the browser again.
 */
export function resolveDeps(providerId: ProviderId): AdapterDeps {
  const gateUrl = loadSettings().gateUrl?.trim();
  const rec = useVaultStore.getState().gateRecords[providerId];
  if (gateUrl && rec) {
    return {
      baseUrl: `${gateUrl.replace(/\/+$/, '')}/v1/${rec.recordId}`,
      apiKey: () => rec.pairingKey,
    };
  }
  return {
    baseUrl: effectiveBase(providerId),
    apiKey: () => useVaultStore.getState().keys[providerId],
  };
}

export function custodyOf(pid: ProviderId): 'gate' | 'local' | 'none' {
  if (loadSettings().gateUrl?.trim() && useVaultStore.getState().gateRecords[pid]) return 'gate';
  return useVaultStore.getState().keys[pid] ? 'local' : 'none';
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate pairing key → enroll on the gate → store record in the vault. */
export async function enrollToGate(
  pid: ProviderId,
  kind: 'openai' | 'anthropic' | 'google' | 'compatible',
): Promise<void> {
  const gateUrl = loadSettings().gateUrl?.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(gateUrl ?? '')) throw new Error('Set a valid relay-gate URL first.');
  if (useVaultStore.getState().gateRecords[pid]) throw new Error('Already enrolled.');
  const localKey = useVaultStore.getState().keys[pid];
  if (!localKey) throw new Error('Save a key locally first — it is transferred to the gate once.');

  const pairingKey = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const res = await fetchWithRetry(`${gateUrl}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: kind,
      baseUrl: kind === 'compatible' ? effectiveBase(pid) : undefined,
      apiKey: localKey,
      pairingKey,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !j.id) throw new Error(j.error ?? `Enroll failed (${res.status}).`);
  await useVaultStore.getState().setGateRecord(pid, { recordId: j.id, pairingKey });
}

/** Revoke server-side and drop the local pairing material. */
export async function revokeOnGate(pid: ProviderId): Promise<void> {
  const rec = useVaultStore.getState().gateRecords[pid];
  const gateUrl = loadSettings().gateUrl?.trim().replace(/\/+$/, '');
  if (!rec || !gateUrl) return;
  const res = await fetchWithRetry(`${gateUrl}/v1/${rec.recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${rec.pairingKey}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Revoke failed (${res.status}).`);
  await useVaultStore.getState().removeGateRecord(pid);
}
