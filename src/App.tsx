import { useEffect, lazy, Suspense } from 'react';
import './styles/tokens.css';
import './ui/ui.css';
import './styles/app.css';
import { useUiStore } from './state/uiStore';
import { useSessionStore } from './state/sessionStore';
import { useVaultStore } from './vault/vaultStore';
import { Rail } from './features/shell/Rail';
import { TopBar } from './features/shell/TopBar';
import { Wizard } from './features/shell/Wizard';
import { ToastStack } from './features/shell/ToastStack';
import { ThreadView } from './features/thread/ThreadView';
import { Composer } from './features/composer/Composer';
import { ProvidersPage } from './features/providers/ProvidersPage';
import { StudioPage } from './features/studio/StudioPage';
// CodeMirror is heavy — the IDE loads only when a code artifact is opened.
const IDEPanel = lazy(() =>
  import('./ide/IDEPanel').then((m) => ({ default: m.IDEPanel })),
);
import { autoLoadKeyedModels, ensureSaneActiveModel } from './features/providers/autoLoad';
import { Palette } from './features/palette/Palette';
import { SettingsSheet } from './features/settings/SettingsSheet';
import { loadSettings } from './state/settings';

/**
 * Shell: vault gate → rail + topbar + active view.
 * Owns global keyboard shortcuts and vault auto-lock.
 */
export default function App() {
  const vaultStatus = useVaultStore((s) => s.status);
  const booting = useVaultStore((s) => s.booting);
  const view = useUiStore((s) => s.view);
  const railOpen = useUiStore((s) => s.railOpen);
  const paletteOpen = useUiStore((s) => s.paletteOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setRailOpen = useUiStore((s) => s.setRailOpen);

  // Boot stores once.
  useEffect(() => {
    useVaultStore.getState().init();
    useSessionStore.getState().init();
  }, []);

  // The moment the vault is usable, silently load every keyed provider's models.
  useEffect(() => {
    if (vaultStatus === 'unlocked') {
      void autoLoadKeyedModels().then(ensureSaneActiveModel);
    }
  }, [vaultStatus]);

  // Global shortcuts: ⌘K/Ctrl+K palette, Esc closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K: open model palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      // Escape: close overlays
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setRailOpen(false);
        useUiStore.getState().setSettingsOpen(false);
      }
      // Cmd+L / Ctrl+L: focus composer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const ta = document.querySelector('.composer textarea') as HTMLTextAreaElement | null;
        if (ta) ta.focus();
      }
      // Cmd+N / Ctrl+N: new thread
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const { activeModel, setView } = useUiStore.getState();
        useSessionStore.getState().createSession(activeModel);
        setView('chat');
      }
      // Cmd+, / Ctrl+,: open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        useUiStore.getState().setSettingsOpen(true);
      }
      useVaultStore.getState().touch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen, setRailOpen]);

  // Vault auto-lock after configured idle minutes.
  useEffect(() => {
    const iv = setInterval(() => {
      const v = useVaultStore.getState();
      if (v.status !== 'unlocked') return;
      const { autoLockMin } = loadSettings();
      if (Date.now() - v.lastActivity > autoLockMin * 60_000) v.lock();
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Loading state while vault initializes.
  if (booting) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100dvh', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--accent)' }}>⟐</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading Relay…</div>
        </div>
      </div>
    );
  }

  // Gate: locked vault → show wizard. Unlocked vault (even with no keys) → show app.
  if (vaultStatus !== 'unlocked') {
    return (
      <>
        <Wizard />
        <ToastStack />
      </>
    );
  }

  return (
    <div data-testid="app-root" className="shell">
      <Rail />
      <div
        className={`scrim ${railOpen ? 'show' : ''}`}
        onClick={() => setRailOpen(false)}
        aria-hidden
      />
      <div className="shell-main">
        <TopBar />
        <main className="view-area" aria-live="polite">
          {view === 'providers' ? <ProvidersPage /> : view === 'studio' ? <StudioPage /> : <ThreadView />}
        </main>
        {view === 'chat' && <Composer />}
        <div id="aria-announcer" className="sr-only" aria-live="polite" />
      </div>
      <Suspense fallback={null}>
        <IDEPanel />
      </Suspense>
      <ToastStack />
      {paletteOpen && <Palette />}
      {settingsOpen && <SettingsSheet />}
    </div>
  );
}
