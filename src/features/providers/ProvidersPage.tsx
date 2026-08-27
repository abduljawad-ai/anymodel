import { useEffect, useMemo, useState } from 'react';
import { listProviders } from '../../catalog/providers';
import { ProviderRow } from './components/ProviderRow';
import { AddProviderRow } from './components/AddProviderRow';

export function ProvidersPage() {
  const [q, setQ] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    const h = () => tick((t) => t + 1);
    window.addEventListener('relay-providers-changed', h);
    return () => window.removeEventListener('relay-providers-changed', h);
  }, []);

  // Live search across provider names and ids ("groq", "grove", "ollama"…).
  const providers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = listProviders();
    if (!needle) return all;
    return all.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(needle));
  }, [q]);

  return (
    <div className="providers-page">
      <h2 style={{ margin: 0 }}>Providers & models</h2>
      <input
        className="prov-search"
        placeholder="Search providers… (e.g. groq, openrouter, ollama)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search providers"
      />
      <div className="prov-list">
        {providers.map((p) => (
          <ProviderRow key={p.id} meta={p} />
        ))}
        {providers.length === 0 && (
          <p style={{ color: 'var(--muted)', padding: 12 }}>No providers match "{q}".</p>
        )}
        <AddProviderRow onAdded={() => tick((t) => t + 1)} />
      </div>
    </div>
  );
}
