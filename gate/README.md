# relay-gate — split-key custody proxy

Holds provider API keys encrypted with client-derived pairing keys
(HKDF → AES-256-GCM). Neither the server's records nor a stolen pairing key
alone yields a usable credential. Plaintext exists in RAM only for the
lifetime of one proxied request.

## Run

```bash
GATE_MASTER="$(openssl rand -base64 32)" \
ALLOWED_ORIGIN="https://youruser.github.io" \
PORT=8787 \
node gate/server.mjs
```

Zero npm dependencies. Any Node ≥ 18 box, container, or Node-capable edge runtime.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness + record count |
| POST | `/enroll` | `{provider, baseUrl?, apiKey, pairingKey(b64url,32B)}` → `{id}` |
| POST | `/v1/<id>/<upstream-path>` | send the pairing key in ANY wire-format auth header (Bearer / x-api-key / x-goog-api-key); SSE streamed back verbatim |
| DELETE | `/v1/<id>` | revoke — requires valid pairing credential |

Per-record token-bucket rate limits (env-tunable), 25 MB body cap, no bodies or keys ever logged.
