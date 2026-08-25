import { create } from 'zustand';
import type { ProviderId } from '../catalog/types';
import { loadSettings, saveSettings } from './settings';
import { useSessionStore } from './sessionStore';

export interface ModelRef {
  providerId: ProviderId;
  modelId: string;
}

export type View = 'chat' | 'providers';

interface UiState {
  view: View;
  theme: 'light' | 'dark';
  paletteOpen: boolean;
  settingsOpen: boolean;
  railOpen: boolean;
  /** True while the user is in the guided first-run key setup (after vault create). */
  inSetup: boolean;
  activeModel: ModelRef;
  setView(v: View): void;
  toggleTheme(): void;
  setTheme(t: 'light' | 'dark'): void;
  setPaletteOpen(b: boolean): void;
  setSettingsOpen(b: boolean): void;
  setRailOpen(b: boolean): void;
  setInSetup(b: boolean): void;
  setActiveModel(ref: ModelRef): void;
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

// --- Hash routing helpers ---
function parseHash(): { view: View; sessionId?: string } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  const view = parts[0] === 'providers' ? 'providers' : 'chat';
  const sessionId = parts[1] || undefined;
  return { view, sessionId };
}

function writeHash(view: View, sessionId?: string): void {
  const path = sessionId ? `/${view}/${sessionId}` : `/${view}`;
  if (window.location.hash !== `#${path}`) {
    window.history.pushState(null, '', `#${path}`);
  }
}

/** Initialize routing: read hash → store, listen for popstate. */
function initRouting(): void {
  const { view, sessionId } = parseHash();
  useUiStore.setState({ view });
  if (sessionId) {
    useSessionStore.getState().setActive(sessionId);
  }

  window.addEventListener('popstate', () => {
    const { view: v, sessionId: sid } = parseHash();
    useUiStore.setState({ view: v });
    if (sid) useSessionStore.getState().setActive(sid);
  });
}

export const useUiStore = create<UiState>((set, get) => ({
  view: 'chat',
  theme: loadSettings().theme,
  paletteOpen: false,
  settingsOpen: false,
  railOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
  inSetup: false,
  activeModel: loadSettings().lastModel,
  setTheme(t) {
    applyTheme(t);
    saveSettings({ theme: t });
    set({ theme: t });
  },
  setView(v) {
    set({ view: v });
    writeHash(v, useSessionStore.getState().activeId ?? undefined);
  },
  toggleTheme() {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light');
  },
  setPaletteOpen(b) { set({ paletteOpen: b }); },
  setSettingsOpen(b) { set({ settingsOpen: b }); },
  setRailOpen(b) { set({ railOpen: b }); },
  setInSetup(b) { set({ inSetup: b }); },
  setActiveModel(ref) {
    saveSettings({ lastModel: ref });
    set({ activeModel: ref });
    const st = useSessionStore.getState();
    if (st.activeId) st.setModelKey(st.activeId, ref);
  },
}));

/** Initialize theme + routing on boot. */
applyTheme(useUiStore.getState().theme);
if (typeof window !== 'undefined') initRouting();
