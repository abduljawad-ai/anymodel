import { useEffect, useRef, useState } from 'react';
import { toast } from '../../lib/toast';
import { anyActive, stopStream } from '../../state/streamRegistry';
import { loadSettings, saveSettings } from '../../state/settings';
import { sendTurn } from '../thread/useSend';
import { ImageAttach, fileToDataUrl } from './ImageAttach';
import { MicRecorder } from './MicRecorder';
import { ModelDial } from './ModelDial';
import { LivePanel } from '../voice/LivePanel';



/** Effort pill — thinking effort applies to EVERY model. */
function EffortPill() {
  const [open, setOpen] = useState(false);
  const cfg = loadSettings();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <span style={{ position: 'relative', marginLeft: 'auto' }} ref={ref}>
      <button className="dial-btn" onClick={() => setOpen((o) => !o)} aria-label="Thinking effort">
        ⚡ {cfg.effort === 'high' ? 'High' : 'Standard'} <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div className="mode-pop" role="menu">
          <div className="pop-sec">THINKING EFFORT — APPLIES TO EVERY MODEL</div>
          {(['standard', 'high'] as const).map((e) => (
            <button
              key={e}
              className="pop-row"
              onClick={() => {
                saveSettings({ effort: e });
                toast(e === 'high' ? 'High — forced step-by-step reasoning' : 'Standard — fast chat');
                setOpen(false);
              }}
            >
              <span>{e === 'standard' ? 'Standard · fast chat' : 'High · forced reasoning'}</span>
              {cfg.effort === e && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/**
 * Composer row (left→right): model · attach · mic · research · effort · send.
 * Model switching = dial/⌘K only. Research toggle = 🔍 only. No duplicates.
 */
export function Composer() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
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
    // Re-focus the textarea for the next message.
    requestAnimationFrame(() => taRef.current?.focus());
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
            className="icon-btn"
            title="Live voice mode (WebRTC)"
            aria-label="Open live voice"
            onClick={() => setVoiceOpen(true)}
          >
            🎙️
          </button>
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

          <EffortPill />

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
      {voiceOpen && <LivePanel onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}
