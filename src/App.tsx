import { lazy, Suspense, useEffect, useState } from 'react';
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
import { autoLoadKeyedModels, ensureSaneActiveModel } from './features/providers/autoLoad';
import { loadSettings } from './state/settings';
import { KeyboardShortcuts } from './features/shell/KeyboardShortcuts';

const Palette = lazy(() => import('./features/palette/Palette').then(m => ({ default: m.Palette })));
const SettingsSheet = lazy(() => import('./features/settings/SettingsSheet').then(m => ({ default: m.SettingsSheet })));

export default function App() {
  const vaultStatus = useVaultStore((s) => s.status);
  const booting = useVaultStore((s) => s.booting);
  const view = useUiStore((s) => s.view);
  const railOpen = useUiStore((s) => s.railOpen);
  const paletteOpen = useUiStore((s) => s.paletteOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setRailOpen = useUiStore((s) => s.setRailOpen);
  const inSetup = useUiStore((s) => s.inSetup);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    useVaultStore.getState().init();
    useSessionStore.getState().init();
  }, []);

  useEffect(() => {
    if (vaultStatus === 'unlocked') {
      void autoLoadKeyedModels().then(ensureSaneActiveModel);
    }
  }, [vaultStatus]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') { e.preventDefault(); setPaletteOpen(true); }
      if (mod && e.key === 'l') { e.preventDefault(); window.dispatchEvent(new Event('relay-focus-composer')); }
      if (mod && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        useSessionStore.getState().createSession(useUiStore.getState().activeModel);
        useUiStore.getState().setView('chat');
      }
      if (mod && e.key === ',') { e.preventDefault(); useUiStore.getState().setSettingsOpen(true); }
      if (mod && e.key === '/') { e.preventDefault(); setShortcutsOpen(true); }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        useUiStore.getState().setSettingsOpen(false);
        setRailOpen(false);
        setShortcutsOpen(false);
      }
      useVaultStore.getState().touch();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setPaletteOpen, setRailOpen]);

  useEffect(() => {
    const iv = setInterval(() => {
      const v = useVaultStore.getState();
      if (v.status !== 'unlocked') return;
      const { autoLockMin } = loadSettings();
      if (Date.now() - v.lastActivity > autoLockMin * 60_000) v.lock();
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  if (booting) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100dvh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', color: 'var(--fg-muted)' }}>
          <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>⟐</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading Relay…</div>
        </div>
      </div>
    );
  }

  if (vaultStatus !== 'unlocked' || inSetup) {
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
        <main className="view-area">
          {view === 'providers' ? <ProvidersPage /> : <ThreadView />}
        </main>
        {view === 'chat' && <Composer />}
        <div id="aria-announcer" className="sr-only" aria-live="polite" />
      </div>
      <ToastStack />
      {paletteOpen && (
        <Suspense fallback={null}>
          <Palette />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsSheet />
        </Suspense>
      )}
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
