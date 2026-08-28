import { decryptJson, encryptJson } from '../../src/vault/crypto';

test('roundtrips a secrets object', async () => {
  const blob = await encryptJson({ openai: 'sk-test' }, 'hunter2');
  expect(blob.v).toBe(2);
  expect(blob.argon2).toBeDefined();
  expect(blob.argon2.timeCost).toBe(3);
  const out = await decryptJson<{ openai: string }>(blob, 'hunter2');
  expect(out.openai).toBe('sk-test');
});

test('wrong passphrase rejects with WRONG_PASSPHRASE', async () => {
  const blob = await encryptJson({ a: 1 }, 'right');
  await expect(decryptJson(blob, 'wrong')).rejects.toThrow('WRONG_PASSPHRASE');
});

test('unique salt/iv/ciphertext per encryption', async () => {
  const a = await encryptJson({ x: 1 }, 'p');
  const b = await encryptJson({ x: 1 }, 'p');
  expect(a.salt).not.toBe(b.salt);
  expect(a.iv).not.toBe(b.iv);
  expect(a.data).not.toBe(b.data);
});
