import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from '../../lib/toast';

interface SRConstructor {
  new (): SpeechRecognition;
}
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  }
}

const SpeechRecognitionAPI: SRConstructor | undefined =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : undefined;

interface MicRecorderProps {
  onTranscript: (text: string) => void;
}

export function MicRecorder({ onTranscript }: MicRecorderProps) {
  const [active, setActive] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      toast('Speech recognition is not supported in this browser.', { error: true });
      return;
    }

    if (active) {
      recognitionRef.current?.stop();
      setActive(false);
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
        .trim();

      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        toast('Microphone permission denied.', { error: true });
      } else if (event.error !== 'aborted') {
        toast(`Speech recognition error: ${event.error}`, { error: true });
      }
      setActive(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setActive(false);
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
    setActive(true);
  }, [active, onTranscript]);

  return (
    <button
      className={`mic-btn ${active ? 'mic-active' : ''}`}
      onClick={toggle}
      title={active ? 'Stop recording' : 'Record voice'}
      aria-label={active ? 'Stop recording' : 'Record voice'}
      type="button"
    >
      {active ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
    </button>
  );
}
