import { useMemo } from 'react';
import { PROVIDERS } from '../../catalog/providers';
import type { Turn } from '../../state/sessionStore';

/** Ordered unique models that have carried the baton in this thread. */
export function BatonTrail({ turns }: { turns: Turn[] }) {
  const trail = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ key: string; label: string; tint: string }> = [];
    for (const t of turns) {
      if (t.role !== 'assistant' || !t.modelId || !t.providerId) continue;
      const k = `${t.providerId}/${t.modelId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ key: k, label: t.modelId, tint: PROVIDERS[t.providerId].tint });
    }
    return out;
  }, [turns]);

  if (trail.length < 2) return null;
  return (
    <div className="baton-trail" aria-label="Models used in this thread">
      {trail.map((m, i) => (
        <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {i > 0 && (
            <span className="arrow" aria-hidden>
              →
            </span>
          )}
          <span className="chip">
            <span className="tint-dot" style={{ ['--tint' as string]: m.tint }} />
            {m.label}
          </span>
        </span>
      ))}
    </div>
  );
}
