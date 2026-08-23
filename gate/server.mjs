/**
 * relay-gate — split-key custody proxy (zero dependencies, Node >= 18).
 *
 * The provider API key lives HERE, encrypted with a key derived from the
 * client's pairing key (HKDF -> AES-256-GCM). Neither side alone yields a
 * usable key:
 *   - stolen record store  => ciphertext only
 *   - stolen pairing key   => nothing here matches it; revocable per record
 * Plaintext exists in memory only for the lifetime of one proxied request.
 *
 * Env: GATE_MASTER (required, >=16 chars), ALLOWED_ORIGIN, PORT,
 *      RATE_CAPACITY (default 40), RATE_PER_SEC (default 2)
 */
import http from 'node:http';
import { randomUUID, timingSafeEqual, webcrypto as crypto } from 'node:crypto';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.ALLOWED_ORIGIN || '';
const BODY_CAP = 25 * 1024 * 1024;
const CAPACITY = Number(process.env.RATE_CAPACITY || 40);
const PER_SEC = Number(process.env.RATE_PER_SEC || 2);
const MASTER = process.env.GATE_MASTER;

if (!MASTER || MASTER.length < 16) {
  console.error('[relay-gate] GATE_MASTER env required (>=16 chars)');
  process.exit(1);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** provider family -> default upstream base */
const UPSTREAM = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

/** id -> { provider, base, salt, iv, ct, check } */
const records = new Map();
/** id -> { tokens, last } token buckets */
const buckets = new Map();

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (str) => new Uint8Array(Buffer.from(str, 'base64url'));

async function hkdf(ikm, salt, info) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) }, key, 256),
  );
}

function constantEq(a, b) {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Wrap + check material derived from a pairing key and the record salt. */
async function material(pairingB64, salt) {
  const ikm = unb64u(pairingB64);
  return {
    wrap: await hkdf(ikm, salt, 'relay-gate-wrap-v1'),
    check: b64u(await hkdf(ikm, salt, 'relay-gate-check-v1')),
  };
}

/** Pairing credential may arrive in any wire-format auth header. */
function credential(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return String(req.headers['x-api-key'] || req.headers['x-goog-api-key'] || '').trim();
}

function allow(res) {
  if (!ORIGIN) return;
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,X-Api-Key,X-Goog-Api-Key,Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function send(res, code, body) {
  allow(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Per-record token bucket. */
function limited(id) {
  const now = Date.now();
  let b = buckets.get(id);
  if (!b) buckets.set(id, (b = { tokens: CAPACITY, last: now }));
  b.tokens = Math.min(CAPACITY, b.tokens + ((now - b.last) / 1000) * PER_SEC);
  b.last = now;
  if (b.tokens < 1) return { ok: false, retry: Math.ceil((1 - b.tokens) / PER_SEC) };
  b.tokens -= 1;
  return { ok: true, retry: 0 };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_CAP) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Decrypt-on-use; WRONG_PAIRING when the credential doesn't match the record. */
async function unwrap(rec, cred) {
  const m = await material(cred, rec.salt);
  if (!constantEq(m.check, rec.check)) throw new Error('WRONG_PAIRING');
  const key = await crypto.subtle.importKey('raw', m.wrap, 'AES-GCM', false, ['decrypt']);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(rec.iv) }, key, unb64u(rec.ct)));
}

function injectAuth(provider, apiKey, h) {
  if (provider === 'anthropic') {
    h['x-api-key'] = apiKey;
    h['anthropic-version'] = '2023-06-01';
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (provider === 'google') {
    h['x-goog-api-key'] = apiKey;
  } else {
    h.Authorization = `Bearer ${apiKey}`;
  }
  return h;
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://gate');

  if (req.method === 'OPTIONS') {
    allow(res);
    return res.writeHead(204).end();
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, records: records.size });
  }

  // ---- enrollment ---------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/enroll') {
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString());
    } catch {
      return send(res, 400, { error: 'invalid json or body too large' });
    }
    const { provider, baseUrl, apiKey, pairingKey } = body ?? {};
    if (!apiKey || typeof pairingKey !== 'string' || pairingKey.length < 43) {
      return send(res, 400, { error: 'apiKey and 256-bit pairingKey (b64url) required' });
    }
    if (!UPSTREAM[provider === 'compatible' ? 'openai' : provider]) {
      return send(res, 400, { error: 'unknown provider family' });
    }
    if (provider === 'compatible' && !/^https:\/\//.test(baseUrl || '')) {
      return send(res, 400, { error: 'compatible providers require an https baseUrl' });
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const m = await material(pairingKey, salt);
    const key = await crypto.subtle.importKey('raw', m.wrap, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(apiKey))));
    const id = randomUUID();
    records.set(id, { provider, base: baseUrl || null, salt, iv, ct: b64u(ct), check: m.check });
    return send(res, 200, { id });
  }

  // ---- proxy / revoke: /v1/<recordId>[/<upstream-path>] --------------------
  const mProxy = /^\/v1\/([\w-]+)(?:\/(.*))?$/.exec(url.pathname);
  if (!mProxy) return send(res, 404, { error: 'not found' });

  const [, id, restPath = ''] = mProxy;
  const rec = records.get(id);
  if (!rec) return send(res, 404, { error: 'unknown record' });

  const lim = limited(id);
  if (!lim.ok) {
    res.setHeader('Retry-After', String(lim.retry));
    return send(res, 429, { error: `rate limited — retry in ${lim.retry}s` });
  }

  const cred = credential(req);
  if (!cred) return send(res, 401, { error: 'missing pairing credential' });

  let apiKey;
  try {
    apiKey = await unwrap(rec, cred);
  } catch {
    return send(res, 401, { error: 'WRONG_PAIRING' });
  }

  if (req.method === 'DELETE') {
    records.delete(id);
    buckets.delete(id);
    return send(res, 200, { revoked: true });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  // ---- forward (SSE-safe pipe-through) --------------------------------------
  const target =
    (rec.base || UPSTREAM[rec.provider]) + '/' + restPath + (url.search || '');
  const headers = injectAuth(rec.provider === 'compatible' ? 'openai' : rec.provider, apiKey, {
    'Content-Type': req.headers['content-type'] || 'application/json',
  });

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers,
      body: await readBody(req),
      signal: AbortSignal.timeout(300_000),
    });
    allow(res);
    const outHeaders = { 'Content-Type': upstream.headers.get('content-type') || 'application/json' };
    const ra = upstream.headers.get('retry-after');
    if (ra) outHeaders['Retry-After'] = ra;
    res.writeHead(upstream.status, outHeaders);
    if (upstream.body) {
      const pipe = Readable.fromWeb(upstream.body);
      pipe.pipe(res);
      pipe.on('error', () => res.destroy());
    } else {
      res.end();
    }
  } catch {
    send(res, 502, { error: 'upstream unreachable' });
  }
}

export function start(opts = {}) {
  const server = http.createServer((rq, rs) => {
    handle(rq, rs).catch((e) => {
      const code = e.message === 'BODY_TOO_LARGE' ? 413 : 500;
      try {
        send(rs, code, { error: code === 413 ? 'body too large' : 'internal error' });
      } catch {
        /* socket already gone */
      }
    });
  });
  return server.listen(opts.port ?? PORT);
}

if (process.argv[1]?.endsWith('server.mjs')) {
  start();
  console.log(`[relay-gate] listening on :${PORT}${ORIGIN ? ` origin=${ORIGIN}` : ''}`);
}
