import { useEffect, useRef, useState } from 'react';
import { toast } from '../../lib/toast';
import { anyActive, stopStream } from '../../state/streamRegistry';
import { useSessionStore } from '../../state/sessionStore';
import { loadSettings, saveSettings } from '../../state/settings';
import { getProviderMeta } from '../../catalog/providers';
import type { ModelRef } from '../../state/uiStore';
import { sendTurn } from '../thread/useSend';
import { ImageAttach, fileToDataUrl } from './ImageAttach';
import { MicRecorder } from './MicRecorder';
import { ModelDial } from './ModelDial';
import { useUiStore } from '../../state/uiStore';

/** Recent models = unique assistant models in the active thread + current pick. */
function recentModels(limit = 4): ModelRef[] {
  const s = useSessionStore.getState().active();
  const out: ModelRef[] = [useUiStore.getState().activeModel];
  if (s) {
    for (const t of [...s.turns].reverse()) {
      if (t.role === 'assistant' && t.modelId && t.providerId) {
        const ref = { providerId: t.providerId, modelId: t.modelId };
        if (!out.some((m) => m.modelId === ref.modelId && m.providerId === ref.providerId)) out.push(ref);
      }
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Bottom-right pill: model recents + thinking effort + deep-research toggle. */
function ModeSelector() {
  const cfg = loadSettings();
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const label = cfg.researchMode ? 'Research' : cfg.effort === 'high' ? 'High' : 'Standard';

  function setEffort(e: 'standard' | 'high') {
    saveSettings({ effort: e });
    toast(`Thinking effort: ${e} — applied to every model`);
    setOpen(false);
  }
  function toggleResearch() {
    const next = !loadSettings().researchMode;
    saveSettings({ researchMode: next });
    setOpen(false);
    toast(next ? 'Deep research ON — reason → search → synthesize loop' : 'Deep research off');
  }

  return (
    <span style={{ position: 'relative', marginLeft: 'auto' }} ref={popRef}>
      <button className="dial-btn" onClick={() => setOpen((o) => !o)} aria-label="Mode and effort">
        <span style={{ color: cfg.researchMode ? 'var(--accent)' : undefined }}>
          {cfg.researchMode ? '🔍 Research' : `⚡ ${label}`}
        </span>
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <div className="mode-pop" role="menu">
          <div className="pop-sec">RECENT MODELS</div>
          {recentModels().map((m) => (
            <button
              key={`${m.providerId}/${m.modelId}`}
              className="pop-row"
              onClick={() => {
                useUiStore.getState().setActiveModel(m);
                setOpen(false);
              }}
            >
              <span className="tint-dot" style={{ ['--tint' as string]: getProviderMeta(m.providerId)?.tint }} />
              <span>{m.modelId}</span>
            </button>
          ))}
          <button
            className="pop-row"
            onClick={() => {
              setOpen(false);
              useUiStore.getState().setPaletteOpen(true);
            }}
          >
            Browse all… ⌘K
          </button>

          <div className="pop-div" />
          <div className="pop-sec">THINKING EFFORT — applies to every model</div>
          {(['standard', 'high'] as const).map((e) => (
            <button key={e} className="pop-row" onClick={() => setEffort(e)}>
              <span>{e === 'standard' ? 'Standard — fast chat' : 'High — forced step-by-step reasoning'}</span>
              {cfg.effort === e && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
            </button>
          ))}

          <div className="pop-div" />
          <button className="pop-row" onClick={toggleResearch}>
            🔍 Deep research loop
            <span style={{ marginLeft: 'auto', color: loadSettings().researchMode ? 'var(--accent)' : 'var(--muted)' }}>
              {loadSettings().researchMode ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      )}
    </span>
  );
}

/**
 * The composer: autosize textarea, attach/paste, mic, model dial, mode
 * selector, Send/Stop. Enter sends; Shift+Enter breaks lines.
 */
export function Composer() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Track global stream activity for the Stop affordance.
  useEffect(() => {
    const iv = setInterval(() => setStreaming(anyActive()), 200);
    return () => clearInterval(iv);
  }, []);

  // Autosize.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [text]);

  function submit() {
    const payloadText = text;
    const payloadImage = image;
    if (!payloadText.trim() && !payloadImage) return;
    setText('');
    setImage(null);
    void sendTurn(payloadText, payloadImage ?? undefined);
  }

  return (
    <div className="composer">
      <div
        className="composer-inner"
        onPaste={(e) => {
          const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
          if (item) {
            const f = item.getAsFile();
            if (f) {
              e.preventDefault();
              void fileToDataUrl(f).then(setImage).catch(() => toast('Could not read pasted image'));
            }
          }
        }}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          placeholder="Ask anything — switch models any time with ⌘K…"
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!streaming) submit();
            }
          }}
        />
        <div className="composer-row">
          <ModelDial />
          <ImageAttach image={image} setImage={setImage} />
          <MicRecorder onTranscript={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />
          <button
            className={`icon-btn ${loadSettings().researchMode ? 'research-on' : ''}`}
            title="Deep research — reason → web search → synthesize (Exa)"
            aria-label="Toggle deep research"
            onClick={() => {
              const next = !loadSettings().researchMode;
              saveSettings({ researchMode: next });
              toast(next ? '🔍 Deep research ON' : 'Deep research off');
            }}
          >
            🔍
          </button>

          <ModeSelector />

          {streaming ? (
            <button className="btn btn-danger" onClick={() => stopStream()} aria-label="Stop generating">
              ■ Stop
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!text.trim() && !image}
              aria-label="Send message"
            >
              Send ↵
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
