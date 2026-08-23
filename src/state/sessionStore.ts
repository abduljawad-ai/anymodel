import { create } from 'zustand';
import { uid } from '../lib/id';
import type { ProviderId } from '../catalog/types';

const LS_SESSIONS = 'relay.sessions.v1';

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelId?: string;
  providerId?: ProviderId;
  imageUrl?: string;
  tokensEst?: number;
  error?: { status?: number; message: string };
  streaming?: boolean;
}

export interface SessionMemory {
  /** Rolling structured summary of turns [0..upto]. */
  text: string;
  upto: number;
  compactions: number;
  at: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelKey: { providerId: ProviderId; modelId: string };
  turns: Turn[];
  memory?: SessionMemory;
}

type ModelKey = Session['modelKey'];

interface SessionsState {
  sessions: Session[];
  activeId: string | null;
  init(): void;
  createSession(mk: ModelKey): string;
  deleteSession(id: string): void;
  renameSession(id: string, title: string): void;
  setActive(id: string): void;
  setModelKey(id: string, mk: ModelKey): void;
  addTurn(sid: string, turn: Turn): void;
  patchTurn(sid: string, tid: string, patch: Partial<Turn>): void;
  setMemory(sid: string, m: Session['memory']): void;
  /** Streaming fast-path — updates content without persisting. */
  appendDelta(sid: string, tid: string, text: string): void;
  active(): Session | undefined;
  exportJson(): string;
  importJson(text: string): 'ok' | 'invalid';
}

let timer: ReturnType<typeof setTimeout> | undefined;

function persistSoon(get: () => SessionsState): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(LS_SESSIONS, JSON.stringify(get().sessions));
    } catch {
      /* quota exceeded — keep in memory */
    }
  }, 250);
}

function touch(list: Session[], sid: string, fn: (s: Session) => Session): Session[] {
  return list.map((s) => (s.id === sid ? { ...fn(s), updatedAt: Date.now() } : s));
}

export const useSessionStore = create<SessionsState>((set, get) => ({
  sessions: [],
  activeId: null,
  init() {
    let sessions: Session[] = [];
    try {
      sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) ?? '[]') as Session[];
    } catch {
      sessions = [];
    }
    set({ sessions, activeId: sessions[0]?.id ?? null });
  },
  createSession(mk) {
    const id = uid('s_');
    set((st) => ({
      sessions: [
        { id, title: 'New thread', createdAt: Date.now(), updatedAt: Date.now(), modelKey: mk, turns: [] },
        ...st.sessions,
      ],
      activeId: id,
    }));
    persistSoon(get);
    return id;
  },
  deleteSession(id) {
    set((st) => {
      const sessions = st.sessions.filter((x) => x.id !== id);
      return { sessions, activeId: st.activeId === id ? sessions[0]?.id ?? null : st.activeId };
    });
    persistSoon(get);
  },
  renameSession(id, title) {
    set((st) => ({ sessions: touch(st.sessions, id, (s) => ({ ...s, title })) }));
    persistSoon(get);
  },
  setActive(id) {
    set({ activeId: id });
  },
  setModelKey(id, mk) {
    set((st) => ({ sessions: touch(st.sessions, id, (s) => ({ ...s, modelKey: mk })) }));
    persistSoon(get);
  },
  addTurn(sid, turn) {
    set((st) => ({
      sessions: touch(st.sessions, sid, (s) => ({
        ...s,
        turns: [...s.turns, turn],
        // Auto-title from the first user message.
        title:
          s.turns.length === 0 && turn.role === 'user'
            ? turn.content.slice(0, 48).trim() || 'New thread'
            : s.title,
      })),
    }));
    persistSoon(get);
  },
  patchTurn(sid, tid, patch) {
    set((st) => ({
      sessions: touch(st.sessions, sid, (s) => ({
        ...s,
        turns: s.turns.map((t) => (t.id === tid ? { ...t, ...patch } : t)),
      })),
    }));
    persistSoon(get);
  },
  setMemory(sid, m) {
    set((st) => ({ sessions: touch(st.sessions, sid, (x) => ({ ...x, memory: m })) }));
    persistSoon(get);
  },
  appendDelta(sid, tid, text) {
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id !== sid
          ? s
          : { ...s, turns: s.turns.map((t) => (t.id !== tid ? t : { ...t, content: t.content + text })) },
      ),
    }));
  },
  active() {
    return get().sessions.find((s) => s.id === get().activeId);
  },
  exportJson() {
    return JSON.stringify(
      { app: 'relay', v: 1, exportedAt: new Date().toISOString(), sessions: get().sessions },
      null,
      2,
    );
  },
  importJson(text) {
    try {
      const j = JSON.parse(text) as { sessions?: Session[] };
      if (!Array.isArray(j.sessions)) return 'invalid';
      set({ sessions: j.sessions, activeId: j.sessions[0]?.id ?? null });
      persistSoon(get);
      return 'ok';
    } catch {
      return 'invalid';
    }
  },
}));
