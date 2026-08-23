import { getModel, listModels, pickDefaultModel, refreshProviderModels } from '../../src/catalog';
import { normalizeModel } from '../../src/catalog/normalize';
import { PROVIDERS } from '../../src/catalog/providers';

test('starter lists expose key capabilities', () => {
  const openai = listModels('openai');
  expect(openai.find((m) => m.id === 'whisper-1')!.caps).toContain('stt');
  expect(openai.find((m) => m.id === 'tts-1')!.caps).toContain('tts');
  expect(listModels('anthropic').some((m) => m.id.startsWith('claude'))).toBe(true);
  expect(PROVIDERS.compatible.defaultBase).toMatch(/^http:\/\/localhost/);
});

test('normalizeModel heuristic caps', () => {
  expect(normalizeModel('compatible', 'llava:13b').caps).toContain('vision');
  expect(normalizeModel('compatible', 'qwen2.5-coder').caps).toEqual([]);
});

test('refresh merges live ids without duplicating starters and survives failure', async () => {
  const merged = await refreshProviderModels('openai', async () => ['gpt-4o', 'gpt-x-future']);
  expect(merged.filter((m) => m.id === 'gpt-4o')).toHaveLength(1);
  expect(merged.find((m) => m.id === 'gpt-x-future')).toBeDefined();
  expect(merged.find((m) => m.id === 'whisper-1')).toBeDefined();

  const again = await refreshProviderModels('openai', async () => {
    throw new Error('down');
  });
  expect(again.length).toBeGreaterThan(0);
});

test('pickDefaultModel avoids stt/tts/embedding models', () => {
  expect(pickDefaultModel('openai')!.id).not.toMatch(/whisper|tts|embed/i);
  expect(getModel('openai', 'gpt-4o')).toBeDefined();
});
