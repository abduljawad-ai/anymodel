import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, Square, ArrowUp } from 'lucide-react';
import { anyActive, stopStream } from '../../state/streamRegistry';
import { sendTurn } from '../thread/useSend';
import { fileToDataUrl } from './ImageAttach';
import { MicRecorder } from './MicRecorder';

/**
 * Composer — attach · mic · send/stop. The model lives in the top bar.
 * Clean, standard chat input: nothing decorative, everything works.
 */
export function Composer() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
              void fileToDataUrl(f).then(setImage).catch(() => {});
            }
          }
        }}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          placeholder="Message your AI…"
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
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f || !f.type.startsWith('image/')) return;
              try {
                setImage(await fileToDataUrl(f));
              } catch {
                setImage(null);
              }
              e.target.value = '';
            }}
          />
          <button
            className="icon-btn"
            title="Attach image (vision models)"
            aria-label="Attach image"
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip size={16} aria-hidden />
          </button>
          {image && (
            <div className="attach-preview">
              <img src={image} alt="preview" />
              <button className="icon-btn" aria-label="Remove attachment" onClick={() => setImage(null)}>
                <X size={14} aria-hidden />
              </button>
            </div>
          )}
          <MicRecorder onTranscript={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />

          {streaming ? (
            <button className="btn btn-danger stop-btn composer-send" onClick={() => stopStream()} aria-label="Stop generating">
              <Square size={13} aria-hidden /> Stop
            </button>
          ) : (
            <button
              className="btn btn-primary send-btn composer-send"
              onClick={submit}
              disabled={!text.trim() && !image}
              aria-label="Send message"
            >
              Send <ArrowUp size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
