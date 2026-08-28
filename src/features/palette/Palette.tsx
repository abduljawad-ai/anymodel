import { useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { cachedModels, isChatCapable, ensureModels } from '../../catalog';
import { toast } from '../../lib/toast';
import { onModelsChanged, keyedButUnloaded } from '../providers/autoLoad';
import type { ModelInfo, ProviderId } from '../../catalog/types';
import { getProviderMeta, listProviders } from '../../catalog/providers';
import { useUiStore } from '../../state/uiStore';
import { loadSettings, saveSettings } from '../../state/settings';

/** Search synonyms so "vision", "voice" etc. find the right models. */
const CAP_SYNONYMS: Record<string, string[]> = {
  vision: ['vision', 'image in', 'picture', 'photo'],
  image: ['image', 'images', 'picture', 'photo', 'generate', 'dall', 'flux'],
  video: ['video', 'clip', 'movie', 'generate video'],
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
  const activeModel = useUiStore((s) => s.activeModel);
  const setActiveModel = useUiStore((s) => s.setActiveModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Show all chat-capable models from all providers — recompute when models load.
  const entries = useMemo(() => {
    return allEntries();
  }, [tick]);

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

  function toggleFavorite(e: Entry) {
    const settings = loadSettings();
    const exists = settings.favoriteModels.some(
      (f) => f.providerId === e.providerId && f.modelId === e.id
    );
    if (exists) {
      saveSettings({
        favoriteModels: settings.favoriteModels.filter(
          (f) => !(f.providerId === e.providerId && f.modelId === e.id)
        ),
      });
      toast('Removed from favorites');
    } else {
      saveSettings({
        favoriteModels: [
          ...settings.favoriteModels,
          { providerId: e.providerId as ProviderId, modelId: e.id, label: e.label },
        ],
      });
      toast('Added to favorites');
    }
  }

  const favorites = useMemo(() => loadSettings().favoriteModels, [tick]);

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

  // Unified keyboard-nav list: loadable rows first, then all model entries.
  const navItems = useMemo(
    () => [
      ...loadables.map((p) => ({ kind: 'load' as const, pid: p.id, meta: p })),
      ...flat.map((e) => ({ kind: 'model' as const, entry: e })),
    ],
    [loadables, flat],
  );

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setSel((i) => Math.min(i + 1, navItems.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setSel((i) => Math.max(i - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const item = navItems[sel];
      if (!item) return;
      if (item.kind === 'load') {
        void ensureModels(item.pid)
          .then((ms) => toast(`${item.meta.name}: ${ms.length} models loaded`))
          .catch((e) => toast(e instanceof Error ? e.message : 'load failed'));
      } else {
        choose(item.entry);
      }
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
      <div className="palette" role="dialog" aria-modal="true" aria-label="Switch model">
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
          {favorites.length > 0 && !q && (
            <>
              <div className="palette-group">FAVORITES</div>
              {favorites.map((fav, fi) => {
                const entry = entries.find((e) => e.providerId === fav.providerId && e.id === fav.modelId);
                if (!entry) return null;
                const i = fi;
                const isActive = fav.providerId === activeModel.providerId && fav.modelId === activeModel.modelId;
                return (
                  <button
                    key={`fav-${fav.providerId}/${fav.modelId}`}
                    className={`palette-item ${isActive ? 'active' : ''}`}
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(entry)}
                  >
                    <span
                      className="tint-dot"
                      style={{ ['--tint' as string]: getProviderMeta(fav.providerId)?.tint }}
                    />
                    <span>{fav.label}</span>
                    {isActive && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>✓ current</span>}
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(entry);
                      }}
                      aria-label="Remove from favorites"
                      style={{ marginLeft: 'auto' }}
                    >
                      <Star size={12} aria-hidden style={{ fill: 'var(--accent)', color: 'var(--accent)' }} />
                    </button>
                  </button>
                );
              })}
            </>
          )}
          {loadables.length > 0 && (
            <>
              <div className="palette-group">LOAD MODELS</div>
              {loadables.map((p, li) => {
                const i = favorites.length + li;
                return (
                  <button
                    key={`load-${p.id}`}
                    className="palette-item"
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
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
                );
              })}
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
                const i = favorites.length + loadables.length + flat.indexOf(e);
                const isActive = e.providerId === activeModel.providerId && e.id === activeModel.modelId;
                const isFav = favorites.some((f) => f.providerId === e.providerId && f.modelId === e.id);
                return (
                  <button
                    key={`${e.providerId}/${e.id}`}
                    className={`palette-item ${isActive ? 'active' : ''}`}
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(e)}
                  >
                    <span
                      className="tint-dot"
                      style={{ ['--tint' as string]: getProviderMeta(e.providerId)?.tint }}
                    />
                    <span>{e.label}</span>
                    {isActive && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>✓ current</span>}
                    <button
                      className="icon-btn"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggleFavorite(e);
                      }}
                      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      style={{ marginLeft: isActive ? 0 : 'auto' }}
                    >
                      <Star size={12} aria-hidden style={{ fill: isFav ? 'var(--accent)' : 'none', color: isFav ? 'var(--accent)' : 'var(--muted)' }} />
                    </button>
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
