import { create } from 'zustand';
import { uid } from '../lib/id';

export interface IDEBuffer {
  id: string;
  /** originating message turn id (for "send back to thread" context) */
  messageId?: string;
  title: string;
  code: string;
  language: string;
  dirty: boolean;
}

interface IDEState {
  buffers: IDEBuffer[];
  activeId: string | null;
  open: boolean;
  openBuffer(input: { code: string; language: string; title?: string; messageId?: string }): string;
  focusBuffer(id: string): void;
  closeBuffer(id: string): void;
  updateCode(id: string, code: string): void;
  setOpen(open: boolean): void;
}

export const useIDEStore = create<IDEState>((set, get) => ({
  buffers: [],
  activeId: null,
  open: false,
  openBuffer({ code, language, title, messageId }) {
    // Reuse an identical buffer instead of stacking duplicates.
    const existing = get().buffers.find((b) => b.code === code && b.language === language);
    if (existing) {
      set({ activeId: existing.id, open: true });
      return existing.id;
    }
    const buf: IDEBuffer = {
      id: uid('ide-'),
      messageId,
      title: title || `snippet.${extFor(language)}`,
      code,
      language,
      dirty: false,
    };
    set((s) => ({ buffers: [...s.buffers, buf], activeId: buf.id, open: true }));
    return buf.id;
  },
  focusBuffer(id) {
    set({ activeId: id, open: true });
  },
  closeBuffer(id) {
    set((s) => {
      const buffers = s.buffers.filter((b) => b.id !== id);
      const activeId =
        s.activeId === id ? (buffers.length ? buffers[buffers.length - 1].id : null) : s.activeId;
      return { buffers, activeId, open: buffers.length > 0 ? s.open : false };
    });
  },
  updateCode(id, code) {
    set((s) => ({
      buffers: s.buffers.map((b) => (b.id === id ? { ...b, code, dirty: true } : b)),
    }));
  },
  setOpen(open) {
    set({ open });
  },
}));

export function extFor(language: string): string {
  const lang = language.toLowerCase();
  if (lang.includes('html')) return 'html';
  if (lang.includes('css')) return 'css';
  if (/\bts\b|typescript/.test(lang)) return 'ts';
  if (/\bjs\b|javascript|jsx/.test(lang)) return 'js';
  if (lang.includes('json')) return 'json';
  if (lang.includes('md')) return 'md';
  if (lang.includes('py') || lang.includes('python')) return 'py';
  return 'txt';
}
