import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, Square, ArrowUp } from 'lucide-react';
import { anyActive, onStreamActivity, stopStream } from '../../state/streamRegistry';
import { sendTurn } from '../thread/useSend';
import { fileToDataUrl } from './ImageAttach';
import type { MicRecorderRef } from './MicRecorder';
import { MicRecorder } from './MicRecorder';
import { PromptLibrary } from './PromptLibrary';
import { toast } from '../../lib/toast';

export function Composer() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<MicRecorderRef>(null);

  useEffect(() => onStreamActivity(() => setStreaming(anyActive())), []);

  useEffect(() => {
    const onFill = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') {
        setText(detail);
        requestAnimationFrame(() => taRef.current?.focus());
      }
    };
    const onFocus = () => taRef.current?.focus();
    window.addEventListener('relay-fill-composer', onFill);
    window.addEventListener('relay-focus-composer', onFocus);
    return () => {
      window.removeEventListener('relay-fill-composer', onFill);
      window.removeEventListener('relay-focus-composer', onFocus);
    };
  }, []);

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
    micRef.current?.stop();
    void sendTurn(payloadText, payloadImage ?? undefined);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  return (
    <div className="composer" data-composer>
      <div
        className="composer-inner"
        onPaste={(e) => {
          const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
          if (item) {
            const f = item.getAsFile();
            if (f) {
              e.preventDefault();
              if (image) toast('Replaced the current attachment');
              void fileToDataUrl(f).then(setImage).catch(() => toast('Could not read that image'));
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
              else if (text.trim()) toast('Still generating — please wait for the reply to finish');
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
                toast('Could not read that image');
              }
              e.target.value = '';
            }}
          />
          <button
            className="icon-btn"
            title="Attach image"
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
          <MicRecorder ref={micRef} text={text} setText={setText} />
          <PromptLibrary onSelect={(prompt) => setText((cur) => cur + prompt)} />

          {streaming ? (
            <button className="btn btn-danger btn-sm composer-send" onClick={() => stopStream()} aria-label="Stop generating">
              <Square size={13} aria-hidden /> Stop
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm composer-send"
              onClick={submit}
              disabled={!text.trim() && !image}
              aria-label="Send message"
            >
              <ArrowUp size={14} aria-hidden /> Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
