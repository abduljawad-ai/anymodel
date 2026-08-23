import { useEffect, useMemo, useRef, useState } from 'react';
import { cachedModels, isChatCapable, ensureModels } from '../../catalog';
import { toast } from '../../lib/toast';
import { onModelsChanged, keyedButUnloaded } from '../providers/autoLoad';
import type { Capability, ModelInfo, ProviderId } from '../../catalog/types';
import { getProviderMeta, listProviders } from '../../catalog/providers';
import { useUiStore } from '../../state/uiStore';

/** Search synonyms so "vision", "voice" etc. find the right models. */
const CAP_SYNONYMS: Record<Capability, string[]> = {
  vision: ['vision', 'image', 'picture', 'photo'],
  stt: ['stt', 'transcribe', 'transcription', 'whisper', 'audio in', 'dictation'],
  tts: ['tts', 'speak', 'speech', 'voice out', 'read aloud'],
  reasoning: ['reasoning', 'reason', 'think', 'smart', 'o1', 'o3'],
  tools: ['tools', 'function calling', 'agents'],
};

interface Entry extends ModelInfo {
  haystack: string;
}

function allEntries(): Entry[] {
  const out: Entry[] = [];
  for (const p of listProviders()) {
    const providerName = p.name.toLowerCase();
    for (const m of cachedModels(p.id)) {
      const capWords = m.caps.flatMap((c) => [c, ...(CAP_SYNONYMS[c as keyof typeof CAP_SYNONYMS] ?? [])]);
      out.push({
        ...m,
        haystack: `${m.label} ${m.id} ${providerName} ${capWords.join(' ')}`.toLowerCase(),
      });
    }
  }
  return out;
}

/** ⌘K cross-provider model switcher with type-to-filter + keyboard nav. */
export function Palette() {
  const setActiveModel = useUiStore((s) => s.setActiveModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Only show a provider's models when its key exists — except compatible (local).
  const entries = useMemo(() => {
    const keys = JSON.parse(localStorage.getItem('relay.vault.v1') ?? '{}');
    void keys; // key *presence* isn't enough post-encryption; we show everything instead
    return allEntries();
  }, []);

  const filtered = useMemo(() => {
    void tick; // recomputes when model lists load
    const needle = q.trim().toLowerCase();
    if (!needle) return entries.filter((e) => isChatCapable(e));
    return entries.filter((e) => needle.split(/\s+/).every((w) => e.haystack.includes(w)));
  }, [entries, q, tick]);

  // Dead-end fix: keyed providers whose models aren't loaded appear as
  // one-click "load" rows (also matched by search text).
  const loadables = useMemo(() => {
    void tick;
    const needle = q.trim().toLowerCase();
    return keyedButUnloaded()
      .map((pid) => getProviderMeta(pid))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => !needle || `${p.name} ${p.id}`.toLowerCase().includes(needle));
  }, [q, tick]);

  // Reset + focus on open.
  useEffect(() => {
    setQ('');
    setSel(0);
    inputRef.current?.focus();
  }, []);

  // Live-refresh when any provider's models finish loading.
  useEffect(() => onModelsChanged(() => setTick((t) => t + 1)), []);

  // Keep selection visible.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [sel, filtered.length]);

  function choose(e: Entry) {
    setActiveModel({ providerId: e.providerId as ProviderId, modelId: e.id });
    setPaletteOpen(false);
  }

  // Group filtered entries by provider for display.
  const groups = useMemo(() => {
    const out: Array<{ providerId: ProviderId; models: Entry[] }> = [];
    for (const e of filtered) {
      const last = out[out.length - 1];
      if (last && last.providerId === e.providerId) last.models.push(e);
      else out.push({ providerId: e.providerId as ProviderId, models: [e] });
    }
    return out;
  }, [filtered]);

  // Flat index for keyboard selection across groups.
  const flat = useMemo(() => groups.flatMap((g) => g.models), [groups]);

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setSel((i) => Math.min(i + 1, flat.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setSel((i) => Math.max(i - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const entry = flat[sel];
      if (entry) choose(entry);
    } else if (ev.key === 'Escape') {
      setPaletteOpen(false);
    }
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setPaletteOpen(false);
      }}
    >
      <div className="palette" role="dialog" aria-label="Switch model">
        <input
          ref={inputRef}
          value={q}
          placeholder={'Search models, providers, capabilities…'}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Search models"
        />
        <div className="palette-list" ref={listRef}>
          {loadables.length > 0 && (
            <>
              <div className="palette-group">LOAD MODELS</div>
              {loadables.map((p) => (
                <button
                  key={`load-${p.id}`}
                  className="palette-item"
                  onClick={() =>
                    void ensureModels(p.id)
                      .then((ms) => toast(`${p.name}: ${ms.length} models loaded`))
                      .catch((e) => toast(e instanceof Error ? e.message : 'load failed'))
                  }
                >
                  <span className="tint-dot" style={{ ['--tint' as string]: p.tint }} />
                  <span>⇩ Load {p.name} models</span>
                  <span className="caps">
                    <span className="cap-chip">has key</span>
                  </span>
                </button>
              ))}
            </>
          )}
          {filtered.length === 0 && loadables.length === 0 && (
            <p style={{ padding: 14, color: 'var(--muted)' }}>
              No models yet — add a key on the Providers page, models load automatically.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.providerId}>
              <div className="palette-group">{getProviderMeta(g.providerId)?.name ?? g.providerId}</div>
              {g.models.map((e) => {
                const i = flat.indexOf(e);
                return (
                  <button
                    key={`${e.providerId}/${e.id}`}
                    className="palette-item"
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(e)}
                  >
                    <span
                      className="tint-dot"
                      style={{ ['--tint' as string]: getProviderMeta(e.providerId)?.tint }}
                    />
                    <span>{e.label}</span>
                    <span className="caps">
                      {e.caps.map((c) => (
                        <span key={c} className="cap-chip">
                          {c}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--hairline)', fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          ↑↓ navigate · ↵ select · esc close
        </div>
      </div>
    </div>
  );
}
