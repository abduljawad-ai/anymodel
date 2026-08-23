import { create } from 'zustand';
import type { ProviderId } from '../catalog/types';
import { loadSettings, saveSettings } from './settings';
import { useSessionStore } from './sessionStore';

export type View = 'thread' | 'compare' | 'lab';
export interface ModelRef {
  providerId: ProviderId;
  modelId: string;
}

interface UiState {
  theme: 'light' | 'dark';
  view: View;
  paletteOpen: boolean;
  settingsOpen: boolean;
  railOpen: boolean;
  activeModel: ModelRef;
  compareModels: ModelRef[];
  toggleTheme(): void;
  setTheme(t: 'light' | 'dark'): void;
  setView(v: View): void;
  setPaletteOpen(b: boolean): void;
  setSettingsOpen(b: boolean): void;
  setRailOpen(b: boolean): void;
  setActiveModel(ref: ModelRef): void;
  toggleCompareModel(ref: ModelRef): void;
  clearCompare(): void;
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: loadSettings().theme,
  view: 'thread',
  paletteOpen: false,
  settingsOpen: false,
  railOpen: false,
  activeModel: loadSettings().lastModel,
  compareModels: [],
  setTheme(t) {
    applyTheme(t);
    saveSettings({ theme: t });
    set({ theme: t });
  },
  toggleTheme() {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light');
  },
  setView(v) {
    set({ view: v });
  },
  setPaletteOpen(b) {
    set({ paletteOpen: b });
  },
  setSettingsOpen(b) {
    set({ settingsOpen: b });
  },
  setRailOpen(b) {
    set({ railOpen: b });
  },
  setActiveModel(ref) {
    saveSettings({ lastModel: ref });
    set({ activeModel: ref });
    // Keep the active session's model slot in sync (mid-thread swap).
    const st = useSessionStore.getState();
    if (st.activeId) st.setModelKey(st.activeId, ref);
  },
  toggleCompareModel(ref) {
    set((st) => {
      const exists = st.compareModels.some((m) => m.modelId === ref.modelId && m.providerId === ref.providerId);
      if (exists) return { compareModels: st.compareModels.filter((m) => !(m.modelId === ref.modelId && m.providerId === ref.providerId)) };
      if (st.compareModels.length >= 3) return {};
      return { compareModels: [...st.compareModels, ref] };
    });
  },
  clearCompare() {
    set({ compareModels: [] });
  },
}));

/** Initialize theme on boot. */
applyTheme(useUiStore.getState().theme);
