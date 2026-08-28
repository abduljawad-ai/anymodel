import { useEffect, useMemo, useRef, useState } from 'react';
import { Star, Search, Loader2 } from 'lucide-react';
import { cachedModels, ensureModels, isChatCapable } from '../../catalog';
import { listProviders, getProviderMeta } from '../../catalog/providers';
import type { ModelInfo, ProviderMeta } from '../../catalog/types';
import { IconButton } from '../../ui/IconButton';
import { useUiStore } from '../../state/uiStore';
import { loadSettings, saveSettings } from '../../state/settings';
import { toast } from '../../lib/toast';
import { onModelsChanged, keyedButUnloaded } from '../providers/autoLoad';

interface Entry extends ModelInfo {
  haystack: string;
  providerName: string;
  providerTint: string;
}

const CAP_SYNONYMS: Record<string, string[]> = {
  vision: ['vision', 'image in', 'picture', 'photo'],
  image: ['image', 'images', 'picture', 'photo', 'generate', 'dall', 'flux'],
  video: ['video', 'clip', 'movie', 'generate video'],
  stt: ['stt', 'transcribe', 'transcription', 'whisper', 'audio in', 'dictation'],
  tts: ['tts', 'speak', 'speech', 'voice out', 'read aloud'],
  reasoning: ['reasoning', 'reason', 'think', 'smart', 'o1', 'o3'],
  tools: ['tools', 'function calling', 'agents'],
};

function buildEntries(): Entry[] {
  const out: Entry[] = [];
  for (const p of listProviders()) {
    const meta = getProviderMeta(p.id);
    const providerName = meta?.name ?? p.id;
    const tint = meta?.tint ?? '#888';
    for (const m of cachedModels(p.id)) {
      const capWords = m.caps.flatMap((c) => [c, ...(CAP_SYNONYMS[c] ?? [])]);
      out.push({
        ...m,
        providerName,
        providerTint: tint,
        haystack: `${m.label} ${m.id} ${providerName} ${capWords.join(' ')}`.toLowerCase(),
      });
    }
  }
  return out;
}

export function Palette() {
  const activeModel = useUiStore((s) => s.activeModel);
  const setActiveModel = useUiStore((s) => s.setActiveModel);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => buildEntries(), [tick]);

  const favorites = useMemo(() => loadSettings().favoriteModels, [tick]);

  const filtered = useMemo(() => {
    void tick;
    const needle = query.trim().toLowerCase();
    if (!needle) return entries.filter((e) => isChatCapable(e));
    return entries.filter((e) => needle.split(/\s+/).every((w) => e.haystack.includes(w)));
  }, [entries, query, tick]);

  const loadables = useMemo(() => {
    void tick;
    const needle = query.trim().toLowerCase();
    return keyedButUnloaded()
      .map((pid) => getProviderMeta(pid))
      .filter((p): p is ProviderMeta => !!p)
      .filter((p) => !needle || `${p.name} ${p.id}`.toLowerCase().includes(needle));
  }, [query, tick]);

  const groups = useMemo(() => {
    const out: Array<{ provider: ProviderMeta; models: Entry[] }> = [];
    for (const e of filtered) {
      const last = out[out.length - 1];
      if (last && last.provider.id === e.providerId) {
        last.models.push(e);
      } else {
        const meta = getProviderMeta(e.providerId);
        out.push({ provider: meta ?? { id: e.providerId, name: e.providerId, kind: 'compatible', tint: '#888', defaultBase: '' }, models: [e] });
      }
    }
    return out;
  }, [filtered]);

  const flat = useMemo(() => groups.flatMap((g) => g.models), [groups]);

  const navItems = useMemo(() => [
    ...loadables.map((p) => ({ kind: 'load' as const, pid: p.id, meta: p })),
    ...flat.map((e) => ({ kind: 'model' as const, entry: e })),
  ], [loadables, flat]);

  useEffect(() => {
    setQuery('');
    setSel(0);
    inputRef.current?.focus();
  }, []);

  useEffect(() => onModelsChanged(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  function choose(entry: Entry) {
    setActiveModel({ providerId: entry.providerId, modelId: entry.id });
    setPaletteOpen(false);
  }

  function toggleFavorite(entry: Entry) {
    const settings = loadSettings();
    const exists = settings.favoriteModels.some(
      (f) => f.providerId === entry.providerId && f.modelId === entry.id,
    );
    if (exists) {
      saveSettings({
        favoriteModels: settings.favoriteModels.filter(
          (f) => !(f.providerId === entry.providerId && f.modelId === entry.id),
        ),
      });
      toast('Removed from favorites');
    } else {
      saveSettings({
        favoriteModels: [
          ...settings.favoriteModels,
          { providerId: entry.providerId, modelId: entry.id, label: entry.label },
        ],
      });
      toast('Added to favorites');
    }
  }

  async function handleLoad(pid: string, name: string) {
    setLoading((prev) => ({ ...prev, [pid]: true }));
    try {
      const ms = await ensureModels(pid);
      toast(`${name}: ${ms.length} models loaded`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'load failed');
    } finally {
      setLoading((prev) => ({ ...prev, [pid]: false }));
    }
  }

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
        void handleLoad(item.pid, item.meta.name);
      } else {
        choose(item.entry);
      }
    } else if (ev.key === 'Escape') {
      setPaletteOpen(false);
    }
  }

  function isFav(entry: Entry) {
    return favorites.some((f) => f.providerId === entry.providerId && f.modelId === entry.id);
  }

  function isActive(entry: Entry) {
    return activeModel.providerId === entry.providerId && activeModel.modelId === entry.id;
  }

  let navIndex = 0;

  return (
    <>
      <div
        className="dialog-scrim open"
        onMouseDown={() => setPaletteOpen(false)}
      />
      <div
        className="dialog open palette"
        role="dialog"
        aria-modal="true"
        aria-label="Switch model"
      >
        <div className="palette-search">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: 8, color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              value={query}
              placeholder="Search models, providers, capabilities..."
              onChange={(e) => { setQuery(e.target.value); setSel(0); }}
              onKeyDown={onKeyDown}
              aria-label="Search models"
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                color: 'var(--fg)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div className="palette-list" ref={listRef}>
          {favorites.length > 0 && !query.trim() && (
            <>
              <div className="palette-group-label">Favorites</div>
              {favorites.map((fav) => {
                const entry = entries.find(
                  (e) => e.providerId === fav.providerId && e.id === fav.modelId,
                );
                if (!entry) return null;
                const i = navIndex++;
                const active = isActive(entry);
                const favStar = isFav(entry);
                return (
                  <button
                    key={`fav-${fav.providerId}/${fav.modelId}`}
                    className={`palette-item${active ? ' current' : ''}${i === sel ? ' selected' : ''}`}
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(entry)}
                  >
                    <span className="palette-item-name">{entry.label}</span>
                    <span className="palette-item-meta">
                      {active && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>current</span>}
                      <IconButton
                        icon={<Star size={14} fill={favStar ? 'var(--accent)' : 'none'} color={favStar ? 'var(--accent)' : 'var(--fg-subtle)'} />}
                        aria-label={favStar ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(ev) => { ev.stopPropagation(); toggleFavorite(entry); }}
                      />
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {loadables.length > 0 && (
            <>
              <div className="palette-group-label">Load Models</div>
              {loadables.map((p) => {
                const i = navIndex++;
                const isLoading = !!loading[p.id];
                return (
                  <button
                    key={`load-${p.id}`}
                    className={`palette-item${i === sel ? ' selected' : ''}`}
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => void handleLoad(p.id, p.name)}
                    disabled={isLoading}
                  >
                    <span className="palette-item-name">
                      {isLoading ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          Loading {p.name}...
                        </span>
                      ) : (
                        `Load ${p.name} models`
                      )}
                    </span>
                    <span className="palette-item-meta">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', padding: '2px 6px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>has key</span>
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {filtered.length === 0 && loadables.length === 0 && (
            <div style={{ padding: 16, color: 'var(--fg-subtle)', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
              No models yet — add a key on the Providers page, models load automatically.
            </div>
          )}

          {groups.map((g) => (
            <div key={g.provider.id}>
              <div className="palette-group-label">{g.provider.name}</div>
              {g.models.map((e) => {
                const i = navIndex++;
                const active = isActive(e);
                const fav = isFav(e);
                return (
                  <button
                    key={`${e.providerId}/${e.id}`}
                    className={`palette-item${active ? ' current' : ''}${i === sel ? ' selected' : ''}`}
                    data-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(e)}
                  >
                    <span className="palette-item-name">{e.label}</span>
                    <span className="palette-item-meta">
                      {active && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>current</span>}
                      {e.caps.map((c) => (
                        <span key={c} style={{ fontSize: 'var(--text-xs)', padding: '1px 5px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
                          {c}
                        </span>
                      ))}
                      <IconButton
                        icon={<Star size={14} fill={fav ? 'var(--accent)' : 'none'} color={fav ? 'var(--accent)' : 'var(--fg-subtle)'} />}
                        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(ev) => { ev.stopPropagation(); toggleFavorite(e); }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="palette-hint">
          ↑↓ navigate · Enter select · Esc close
        </div>
      </div>
    </>
  );
}
