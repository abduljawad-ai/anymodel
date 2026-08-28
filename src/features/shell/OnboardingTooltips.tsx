import { useState, useEffect } from 'react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { useVaultStore } from '../../vault/vaultStore';

const STORAGE_KEY = 'relay-onboarding-complete';

interface Tooltip {
  id: string;
  title: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  target?: string; // CSS selector for positioning
}

const tooltips: Tooltip[] = [
  {
    id: 'welcome',
    title: 'Welcome to Relay',
    message: 'Your personal AI chatbot. You bring your own API keys — no middleman.',
    position: 'bottom',
  },
  {
    id: 'setup-keys',
    title: '1. Add API Keys',
    message: 'Click the gear icon to open Settings, then add your first API key from OpenAI, Anthropic, Google, or others.',
    position: 'bottom',
    target: '[data-settings-btn]',
  },
  {
    id: 'pick-model',
    title: '2. Pick a Model',
    message: 'Press ⌘K (or Ctrl+K) to open the Model Palette and select which model to chat with.',
    position: 'bottom',
    target: '[data-model-chip]',
  },
  {
    id: 'start-chat',
    title: '3. Start Chatting',
    message: 'Type your message below and press Enter. Use ⌘/ for keyboard shortcuts.',
    position: 'top',
    target: '[data-composer]',
  },
];

export function OnboardingTooltips() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const keys = useVaultStore((s) => s.keys);

  useEffect(() => {
    // Check if onboarding is complete
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Only show if user has no keys set up
      const hasKeys = Object.keys(keys).length > 0;
      if (!hasKeys) {
        setVisible(true);
      } else {
        // User has keys, mark as complete
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    }
  }, [keys]);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  function nextStep() {
    if (currentStep < tooltips.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const tooltip = tooltips[currentStep];

  return (
    <div
      className="onboarding-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(25, 23, 20, 0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={dismiss}
    >
      <div
        className="onboarding-card"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{tooltip.title}</span>
          </div>
          <button
            onClick={dismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
            }}
            aria-label="Dismiss onboarding"
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>
          {tooltip.message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {currentStep + 1} of {tooltips.length}
          </span>
          <button
            className="btn btn-primary"
            onClick={nextStep}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {currentStep < tooltips.length - 1 ? (
              <>
                Next <ArrowRight size={14} />
              </>
            ) : (
              'Get Started'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
