import { useVaultStore } from '../../src/vault/vaultStore';

const s = () => useVaultStore.getState();

test('vault lifecycle', async () => {
  // Clear any existing vault state
  s().lock();
  s().init();
  await new Promise((r) => setTimeout(r, 50)); // wait for async init

  expect(s().status).toBe('empty');
  await s().createVault('pass123');
  expect(s().status).toBe('unlocked');
  await s().setKey('openai', 'sk-test-1');
  expect(s().keys.openai).toBe('sk-test-1');

  // Verify vault is NOT stored in localStorage (old method)
  expect(localStorage.getItem('relay.vault.v1')).toBeNull();

  s().lock();
  expect(s().status).toBe('locked');
  expect(s().keys).toEqual({}); // plaintext cleared from memory

  expect(await s().unlock('nope')).toBe(false);
  expect(s().status).toBe('locked');
  expect(await s().unlock('pass123')).toBe(true);
  expect(s().keys.openai).toBe('sk-test-1'); // decrypted back
});

test('setKey requires unlock', async () => {
  s().lock();
  s().init();
  await new Promise((r) => setTimeout(r, 50));
  await s().createVault('p');
  s().lock();
  await s().setKey('google', 'gk');
  expect(s().keys.google).toBeUndefined();
});
