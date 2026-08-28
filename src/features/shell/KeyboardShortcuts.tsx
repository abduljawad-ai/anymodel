import { Dialog } from '../../ui/Dialog';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Model palette' },
  { keys: ['⌘', 'L'], description: 'Focus composer' },
  { keys: ['⌘', '⇧', 'O'], description: 'New thread' },
  { keys: ['⌘', ','], description: 'Settings' },
  { keys: ['⌘', '/'], description: 'Keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close overlays' },
  { keys: ['↵'], description: 'Send message' },
  { keys: ['⇧', '↵'], description: 'New line' },
];

export function KeyboardShortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard Shortcuts" width={420}>
      <div className="shortcuts-grid">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.description} className="shortcut-row">
            <span className="shortcut-desc">{shortcut.description}</span>
            <div className="shortcut-keys">
              {shortcut.keys.map((key, i) => (
                <kbd key={i} className="shortcut-key">{key}</kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
