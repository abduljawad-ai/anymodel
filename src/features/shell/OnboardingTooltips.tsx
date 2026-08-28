import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';


const STORAGE_KEY = 'relay.onboarding.done';

interface Step {
  title: string;
  message: string;
  target: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Relay',
    message: 'Your personal AI chatbot. You bring your own API keys — no server, no middleman.',
    target: '',
  },
  {
    title: 'Pick a model',
    message: 'Press ⌘K to open the Model Palette and choose which model to chat with.',
    target: '[data-model-chip]',
  },
  {
    title: 'Start chatting',
    message: 'Type your message below and press Enter to send. Use ⌘/ for keyboard shortcuts.',
    target: '[data-composer]',
  },
  {
    title: 'Add your keys',
    message: 'Open Settings to add API keys from OpenAI, Anthropic, Google, or others.',
    target: '[data-settings-btn]',
  },
];

function getTargetRect(selector: string): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

export function OnboardingTooltips() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const rect = getTargetRect(STEPS[step].target);
    setTargetRect(rect);
  }, [visible, step]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (!visible) return null;

  const current = STEPS[step];
  const tooltipStyle: React.CSSProperties = targetRect
    ? {
        position: 'fixed',
        top: targetRect.bottom + 12,
        left: Math.min(targetRect.left, window.innerWidth - 340),
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <div className="onboarding-overlay" onClick={dismiss}>
      <div className="onboarding-tooltip" style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-header">
          <span className="onboarding-title">{current.title}</span>
          <button className="onboarding-close" onClick={dismiss} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
        <p className="onboarding-message">{current.message}</p>
        <div className="onboarding-actions">
          <span className="onboarding-step">{step + 1} / {STEPS.length}</span>
          <button className="btn btn-primary" onClick={next}>
            {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
