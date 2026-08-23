import { anyActive, startStream, stopStream } from '../../src/state/streamRegistry';
import { useSessionStore } from '../../src/state/sessionStore';
import { onToast } from '../../src/lib/toast';

test('registry tracks and aborts controllers', () => {
  const ac = startStream('a');
  expect(anyActive()).toBe(true);
  stopStream('a');
  expect(ac.signal.aborted).toBe(true);
  expect(anyActive()).toBe(false);
});

test('stopStream() aborts everything', () => {
  startStream('x');
  startStream('y');
  stopStream();
  expect(anyActive()).toBe(false);
});

test('session store lifecycle, autotitle, import/export', () => {
  localStorage.clear();
  const s = () => useSessionStore.getState();
  s().init();
  expect(s().sessions).toHaveLength(0);

  const id = s().createSession({ providerId: 'openai', modelId: 'gpt-4o' });
  expect(s().active()!.title).toBe('New thread');

  s().addTurn(id, { id: 't1', role: 'user', content: 'Explain quantum tunneling briefly please' });
  expect(s().active()!.title).toBe('Explain quantum tunneling briefly please'); // ≤48 chars → full text

  s().addTurn(id, { id: 'a1', role: 'assistant', content: '', modelId: 'gpt-4o', providerId: 'openai', streaming: true });
  s().appendDelta(id, 'a1', 'He');
  s().appendDelta(id, 'a1', 'llo');
  expect(s().active()!.turns.find((t) => t.id === 'a1')!.content).toBe('Hello');

  const dump = s().exportJson();
  localStorage.clear();
  s().init();
  expect(s().importJson(dump)).toBe('ok');
  expect(s().sessions).toHaveLength(1);
  expect(s().importJson('garbage')).toBe('invalid');

  s().setModelKey(id, { providerId: 'anthropic', modelId: 'claude-x' });
  expect(s().active()!.modelKey.providerId).toBe('anthropic');

  let toasts = 0;
  const off = onToast(() => toasts++);
  s().renameSession(id, 'renamed');
  off();
  expect(toasts).toBe(0);
});
