import { uid } from '../../src/lib/id';
import { estimateTokens, estimateTurnTokens } from '../../src/lib/tokens';
import { parseDataUrl } from '../../src/lib/dataurl';

test('uid is unique and keeps prefix', () => {
  const a = uid('t_');
  const b = uid('t_');
  expect(a).not.toBe(b);
  expect(a.startsWith('t_')).toBe(true);
});

test('token estimates', () => {
  expect(estimateTokens('')).toBe(0);
  expect(estimateTokens('abcd')).toBe(1);
  expect(estimateTokens('a'.repeat(401))).toBe(100);
  expect(estimateTurnTokens({ content: '' })).toBe(0);
  expect(estimateTurnTokens({ content: '', imageUrl: 'data:image/png;base64,x' })).toBe(85);
});


test('parseDataUrl extracts mediaType + base64', () => {
  expect(parseDataUrl('data:image/jpeg;base64,QUJD')).toEqual({ mediaType: 'image/jpeg', base64: 'QUJD' });
  expect(parseDataUrl('https://example.com/x.png')).toBeNull();
});
