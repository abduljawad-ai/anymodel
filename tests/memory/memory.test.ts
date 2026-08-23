import { memoryPrompt, splitForCompaction, estimateHistoryTokens } from '../../src/lib/memory';
import { ensureMemory, _setMemoryStreamFn } from '../../src/features/thread/useSend';
import { useSessionStore } from '../../src/state/sessionStore';
import { loadSettings } from '../../src/state/settings';

function bigTurns(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
    content: `turn ${i} ${'x'.repeat(400)}`,
  }));
}

test('splitForCompaction: no-op under budget, evicts oldest over budget, protects hot tail', () => {
  const small = bigTurns(4);
  expect(splitForCompaction(small, 100_000)).toBeNull();

  const big = bigTurns(20);
  const total = estimateHistoryTokens(big);
  const split = splitForCompaction(big, Math.round(total * 0.6))!;
  expect(split.keptFrom).toBeGreaterThanOrEqual(1);
  expect(big.length - split.keptFrom).toBeLessThanOrEqual(6); // hot tail intact
  expect(split.evicted[0].content).toContain('turn 0');

  // impossible: nothing evictable when only hot tail exists
  expect(splitForCompaction(bigTurns(6), 10)).toBeNull();
});

test('memoryPrompt folds previous summary + segment (delta style)', () => {
  const p = memoryPrompt('PREV_MEMORY', 'SEGMENT_TEXT');
  expect(p).toContain('MEMORY SO FAR');
  expect(p).toContain('PREV_MEMORY');
  expect(p).toContain('SEGMENT_TEXT');
});

test('ensureMemory summarizes evicted turns and persists rolling memory', async () => {
  localStorage.clear();
  const st = useSessionStore.getState();
  st.init();
  const sid = st.createSession({ providerId: 'openai', modelId: 'm' });
  st.setMemory(sid, undefined);
  for (const t of bigTurns(14)) st.addTurn(sid, t);

  let calls = 0;
  _setMemoryStreamFn(async (req) => {
    calls++;
    if (calls === 1) expect(req.messages[0].content).toContain('NEW CONVERSATION SEGMENT');
    return `SUMMARY#${calls}`;
  });

  // tiny budget forces eviction of all but hot tail
  const real = loadSettings().contextBudgetTokens;
  localStorage.setItem('relay.settings.v1', JSON.stringify({ contextBudgetTokens: 1500 }));
  await ensureMemory(sid, 'm', 'openai');

  const mem = useSessionStore.getState().active()!.memory!;
  expect(mem.text).toBe('SUMMARY#1');
  expect(mem.compactions).toBe(1);
  expect(useSessionStore.getState().active()!.turns.length - (mem.upto + 1)).toBeLessThan(14); // evicted something
  void real;
  _setMemoryStreamFn(undefined);
});
