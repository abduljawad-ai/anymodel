import { useState } from 'react';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase } from '../../adapters/base';
import { cosineSimilarity } from '../../lib/math';
import { toast } from '../../lib/toast';
import { useVaultStore } from '../../vault/vaultStore';

/** Embeddings bench: two texts → cosine similarity, via whichever provider has a key. */
function EmbeddingsBench() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [sim, setSim] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const keys = useVaultStore.getState().keys;
    let adapter = null as ReturnType<typeof createAdapter> | null;
    let model = '';
    if (keys.openai) {
      adapter = createAdapter('openai', { baseUrl: effectiveBase('openai'), apiKey: () => keys.openai });
      model = 'text-embedding-3-small';
    } else if (keys.google) {
      adapter = createAdapter('google', { baseUrl: effectiveBase('google'), apiKey: () => keys.google });
      model = '';
    } else {
      toast('Embeddings need an OpenAI or Google key.');
      return;
    }
    setBusy(true);
    try {
      const [va, vb] = await adapter.embed([a, b], model);
      setSim(cosineSimilarity(va, vb));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Embedding failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bench">
      <h3 style={{ marginTop: 0 }}>Embeddings — cosine similarity</h3>
      <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Text A…" aria-label="Text A" />
      <textarea value={b} onChange={(e) => setB(e.target.value)} placeholder="Text B…" aria-label="Text B" style={{ marginTop: 8 }} />
      <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !a.trim() || !b.trim()} style={{ marginTop: 10 }}>
        {busy ? 'Embedding…' : 'Compare'}
      </button>
      {sim !== null && (
        <div className="bench-result">
          similarity: <strong>{(sim * 100).toFixed(1)}%</strong>
          <div className="sim-bar">
            <div className="sim-fill" style={{ width: `${Math.abs(sim) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

interface ModResult {
  flagged: boolean;
  categories: Record<string, boolean>;
}

/** Moderation bench: text → category flags (OpenAI). */
function ModerationBench() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ModResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const key = useVaultStore.getState().keys.openai;
    if (!key) {
      toast('Moderation needs an OpenAI key.');
      return;
    }
    setBusy(true);
    try {
      const adapter = createAdapter('openai', {
        baseUrl: effectiveBase('openai'),
        apiKey: () => useVaultStore.getState().keys.openai,
      });
      setResult(await adapter.moderate(text, ''));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Moderation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bench">
      <h3 style={{ marginTop: 0 }}>Moderation — category flags</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text to screen…" aria-label="Moderation input" />
      <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !text.trim()} style={{ marginTop: 10 }}>
        {busy ? 'Screening…' : 'Screen'}
      </button>
      {result && (
        <div className="bench-result">
          verdict: <strong>{result.flagged ? 'flagged' : 'clean'}</strong>
          <div className="cat-chips">
            {Object.entries(result.categories).map(([cat, on]) => (
              <span key={cat} className={`cat-flag ${on ? 'on' : ''}`}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LabView() {
  return (
    <div className="lab-wrap">
      <p style={{ color: 'var(--muted)', margin: 0 }}>
        Small workbenches for poking at provider endpoints directly.
      </p>
      <EmbeddingsBench />
      <ModerationBench />
    </div>
  );
}
