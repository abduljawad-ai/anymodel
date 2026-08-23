import { useVaultStore } from '../../src/vault/vaultStore';

const s = () => useVaultStore.getState();

test('vault lifecycle', async () => {
  localStorage.clear();
  s().init();
  expect(s().status).toBe('empty');
  await s().createVault('pass123');
  expect(s().status).toBe('unlocked');
  await s().setKey('openai', 'sk-test-1');
  expect(s().keys.openai).toBe('sk-test-1');

  const raw = localStorage.getItem('relay.vault.v1')!;
  expect(raw).not.toContain('sk-test-1'); // encrypted at rest

  s().lock();
  expect(s().status).toBe('locked');
  expect(s().keys).toEqual({}); // plaintext cleared from memory

  expect(await s().unlock('nope')).toBe(false);
  expect(s().status).toBe('locked');
  expect(await s().unlock('pass123')).toBe(true);
  expect(s().keys.openai).toBe('sk-test-1'); // decrypted back
});

test('setKey requires unlock', async () => {
  localStorage.clear();
  s().init();
  await s().createVault('p');
  s().lock();
  await s().setKey('google', 'gk');
  expect(s().keys.google).toBeUndefined();
});
