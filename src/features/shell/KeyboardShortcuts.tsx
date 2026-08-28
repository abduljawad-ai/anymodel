import { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Open model palette' },
  { keys: ['⌘', 'L'], description: 'Focus composer' },
  { keys: ['⌘', 'Shift', 'O'], description: 'New thread' },
  { keys: ['⌘', ','], description: 'Open settings' },
  { keys: ['Esc'], description: 'Close overlays' },
  { keys: ['Enter'], description: 'Send message' },
  { keys: ['Shift', 'Enter'], description: 'New line in composer' },
];

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: '90%',
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Keyboard Shortcuts</h2>
          <IconButton
            icon={<X size={16} aria-hidden />}
            aria-label="Close"
            onClick={onClose}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < SHORTCUTS.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}
            >
              <span style={{ color: 'var(--ink)' }}>{shortcut.description}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--paper)',
                      border: '1px solid var(--hairline)',
                      borderRadius: 4,
                      boxShadow: '0 1px 0 var(--hairline)',
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
