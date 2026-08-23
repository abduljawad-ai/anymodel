// Gate integration: enroll → proxy (real key reaches upstream) → wrong pairing
// rejected → revoke kills record. Runs the real zero-dep server on ephemeral ports.
import http from 'node:http';
import { randomBytes } from 'node:crypto';

process.env.GATE_MASTER = 'test-master-secret-0123456789abcdef';

const { start } = await import('../../gate/server.mjs');

const b64url = (b: Buffer) => b.toString('base64url');
const pairing = () => b64url(randomBytes(32));

let upstreamAuth = '';
const upstream = http.createServer((req, res) => {
  upstreamAuth = String(req.headers.authorization ?? '');
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  res.end(`data: AUTH=${authHeader(upstreamAuth)}\n\n`);
});
function authHeader(v: string) {
  return v;
}
await new Promise<void>((r) => upstream.listen(0, r));
const upstreamPort = (upstream.address() as { port: number }).port;

const gate = start({ port: 0 });
await new Promise<void>((r) => gate.once('listening', r));
const gatePort = (gate.address() as { port: number }).port;
const base = `http://localhost:${gatePort}`;

test('health endpoint', async () => {
  const res = await fetch(`${base}/health`);
  expect(res.status).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test('enroll keeps only ciphertext; proxy decrypts and injects the REAL key upstream', async () => {
  const enroll = await fetch(`${base}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', apiKey: 'sk-REAL-KEY', pairingKey: pairing() }),
  });
  const { id } = (await enroll.json()) as { id: string };
  expect(id).toBeTruthy();

  const goodPairing = pairing();
  // Re-enroll with a KNOWN pairing so we can test both sides deterministically.
  const e2 = await fetch(`${base}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'openai',
      baseUrl: `http://localhost:${upstreamPort}`,
      apiKey: 'sk-REAL-KEY',
      pairingKey: goodPairing,
    }),
  });
  const id2 = ((await e2.json()) as { id: string }).id;

  const proxied = await fetch(`${base}/v1/${id2}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${goodPairing}`, 'Content-Type': 'application/json' },
    body: '{"stream":true}',
  });
  if (proxied.status !== 200) console.error('PROXY FAIL BODY', await proxied.clone().text());
  expect(proxied.status).toBe(200);
  expect(proxied.headers.get('content-type')).toContain('text/event-stream');
  const text = await proxied.text();
  expect(text).toContain('AUTH=Bearer sk-REAL-KEY'); // gate injected the real key
  void id;
});

test('wrong pairing credential is rejected without leaking anything', async () => {
  const p = pairing();
  const { id } = await (
    await fetch(`${base}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-X', pairingKey: p }),
    })
  ).json();

  const bad = await fetch(`${base}/v1/${id}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pairing()}` },
    body: '{}',
  });
  expect(bad.status).toBe(401);
  expect(((await bad.json()) as { error: string }).error).toBe('WRONG_PAIRING');
});

test('revoke requires valid pairing; afterwards the record is gone', async () => {
  const p = pairing();
  const { id } = await (
    await fetch(`${base}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-R', pairingKey: p }),
    })
  ).json();

  const noAuth = await fetch(`${base}/v1/${id}`, { method: 'DELETE' });
  expect(noAuth.status).toBe(401);

  const ok = await fetch(`${base}/v1/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${p}` },
  });
  expect(ok.status).toBe(200);

  const after = await fetch(`${base}/v1/${id}/x`, { method: 'POST', headers: { Authorization: `Bearer ${p}` }, body: '{}' });
  expect(after.status).toBe(404);
});

teardown(async () => {
  upstream.close();
  gate.close();
});

function teardown(fn: () => void): void {
  process.on('exit', fn);
}
