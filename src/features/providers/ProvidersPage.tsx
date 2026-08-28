import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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

  const providers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = listProviders();
    if (!needle) return all;
    return all.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(needle));
  }, [q]);

  return (
    <div className="providers-page">
      <h2>Providers &amp; models</h2>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }} />
        <input
          className="prov-search"
          style={{ paddingLeft: 30 }}
          placeholder="Search providers\u2026 (e.g. groq, openrouter, ollama)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search providers"
        />
      </div>
      <div className="prov-list">
        {providers.map((p) => (
          <ProviderRow key={p.id} meta={p} />
        ))}
        {providers.length === 0 && (
          <p style={{ color: 'var(--muted)', padding: 12 }}>No providers match &ldquo;{q}&rdquo;.</p>
        )}
        <AddProviderRow onAdded={() => tick((t) => t + 1)} />
      </div>
    </div>
  );
}
