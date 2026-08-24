import { useEffect, useRef, useState } from 'react';
import { Mic, X, LoaderCircle } from 'lucide-react';
import { createAdapter } from '../../adapters/factory';
import { resolveDeps } from '../../vault/gate';
import type { ProviderId } from '../../catalog/types';
import { toast } from '../../lib/toast';
import { useVaultStore } from '../../vault/vaultStore';

function pickSttProvider(): ProviderId | null {
  const keys = useVaultStore.getState().keys;
  if (keys.openai) return 'openai';
  if (keys.compatible) return 'compatible';
  return null;
}

/**
 * Mic button: click to start/stop recording (webm), then run provider
 * STT and hand the transcript back to the composer.
 */
export function MicRecorder({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  async function toggle() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    if (!pickSttProvider()) {
      toast('Voice input needs an OpenAI (or compatible) key.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const p = pickSttProvider()!;
          const adapter = createAdapter(p, resolveDeps(p));
          const text = await adapter.transcribe(blob, 'whisper-1');
          if (text.trim()) onTranscript(text.trim());
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Transcription failed');
        } finally {
          setBusy(false);
          setSeconds(0);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast('Microphone permission denied.');
    }
  }

  function cancel() {
    // Stop without transcribing.
    const rec = recRef.current;
    if (!rec) return;
    rec.onstop = () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
    chunksRef.current = [];
    rec.stop();
    setRecording(false);
    setSeconds(0);
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {recording ? (
        <>
          <span className="rec-dot" aria-hidden />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{seconds}s</span>
          <button className="icon-btn" onClick={cancel} title="Cancel recording" aria-label="Cancel recording">
            <X size={14} aria-hidden />
          </button>
        </>
      ) : null}
      <button
        className={`icon-btn ${recording ? '' : ''}`}
        style={recording || busy ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
        onClick={() => void toggle()}
        disabled={busy}
        title={busy ? 'Transcribing…' : recording ? 'Stop & transcribe' : 'Record voice message'}
        aria-label={busy ? 'Transcribing' : recording ? 'Stop recording' : 'Record voice'}
      >
        {busy ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Mic size={16} aria-hidden />}
      </button>
    </span>
  );
}
