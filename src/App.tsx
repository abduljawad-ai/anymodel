import { useEffect } from 'react';
import './styles/tokens.css';
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
import { Palette } from './features/palette/Palette';
import { SettingsSheet } from './features/settings/SettingsSheet';

/**
 * Shell: vault gate → rail + topbar + active view.
 * Owns global keyboard shortcuts and vault auto-lock.
 */
export default function App() {
  const vaultStatus = useVaultStore((s) => s.status);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setRailOpen(false);
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
      const { autoLockMin } = JSON.parse(localStorage.getItem('relay.settings.v1') ?? '{"autoLockMin":15}');
      if (Date.now() - v.lastActivity > autoLockMin * 60_000) v.lock();
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Gate: locked vault OR unlocked-but-empty (force the key-setup step).
  const hasAnyKey = useVaultStore((s) => Object.keys(s.keys).length > 0);
  if (vaultStatus !== 'unlocked' || !hasAnyKey) {
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
          {view === 'providers' ? <ProvidersPage /> : <ThreadView />}
        </main>
        {view === 'chat' && <Composer />}
        <div id="aria-announcer" className="sr-only" aria-live="polite" />
      </div>
      <ToastStack />
      {paletteOpen && <Palette />}
      {settingsOpen && <SettingsSheet />}
    </div>
  );
}
