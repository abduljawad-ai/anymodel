import { useEffect, useRef, useState } from 'react';
import { toast } from '../../lib/toast';
import { anyActive } from '../../state/streamRegistry';
import { sendTurn, stopStream } from '../thread/useSend';
import { ImageAttach, fileToDataUrl } from './ImageAttach';
import { ModelDial } from './ModelDial';

/**
 * The composer: autosize textarea, image attach/paste, model dial,
 * Send/Stop. Enter sends; Shift+Enter breaks lines.
 */
export function Composer() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Track global stream activity for the Stop affordance.
  useEffect(() => {
    const iv = setInterval(() => setStreaming(anyActive()), 250);
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

          <span className="send-hint">Enter ↵ send · Shift+Enter newline</span>

          {streaming ? (
            <button
              className="btn btn-danger"
              onClick={() => stopStream()}
              aria-label="Stop generating"
            >
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
