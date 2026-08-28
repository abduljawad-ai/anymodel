import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
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
  text: string;
  setText: (text: string) => void;
}

export interface MicRecorderRef {
  stop: () => void;
}

export const MicRecorder = forwardRef<MicRecorderRef, MicRecorderProps>(({ text, setText }, ref) => {
  const [active, setActive] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const startTextRef = useRef('');

  const stopRecording = useCallback(() => {
    if (active) {
      recognitionRef.current?.stop();
      setActive(false);
      recognitionRef.current = null;
    }
  }, [active]);

  useImperativeHandle(ref, () => ({
    stop: stopRecording,
  }));

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
      stopRecording();
      return;
    }

    startTextRef.current = text;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true; // Enabled for real-time
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      const st = startTextRef.current.trim();
      const newText = st ? `${st} ${currentTranscript.trim()}` : currentTranscript.trim();
      setText(newText);
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
  }, [active, text, setText]);

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
