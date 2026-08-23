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
  activeModel: ModelRef;
  setView(v: View): void;
  toggleTheme(): void;
  setTheme(t: 'light' | 'dark'): void;
  setPaletteOpen(b: boolean): void;
  setSettingsOpen(b: boolean): void;
  setRailOpen(b: boolean): void;
  setActiveModel(ref: ModelRef): void;
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

export const useUiStore = create<UiState>((set, get) => ({
  view: 'chat',
  theme: loadSettings().theme,
  paletteOpen: false,
  settingsOpen: false,
  railOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
  activeModel: loadSettings().lastModel,
  setTheme(t) {
    applyTheme(t);
    saveSettings({ theme: t });
    set({ theme: t });
  },
  setView(v) {
    set({ view: v });
  },
  toggleTheme() {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light');
  },
  setPaletteOpen(b) { set({ paletteOpen: b }); },
  setSettingsOpen(b) { set({ settingsOpen: b }); },
  setRailOpen(b) { set({ railOpen: b }); },
  setActiveModel(ref) {
    saveSettings({ lastModel: ref });
    set({ activeModel: ref });
    const st = useSessionStore.getState();
    if (st.activeId) st.setModelKey(st.activeId, ref);
  },
}));

/** Initialize theme on boot. */
applyTheme(useUiStore.getState().theme);
