import { readSSE, SSEFrameParser, streamFromStrings } from '../../src/lib/sse';

async function collect(chunks: string[]) {
  const out: Array<{ event?: string; data: string }> = [];
  for await (const ev of readSSE(streamFromStrings(chunks))) out.push(ev);
  return out;
}

test('parser frames on blank line and joins multiline data', () => {
  const p = new SSEFrameParser();
  expect(p.push('event: foo')).toBeNull();
  expect(p.push('data: line1')).toBeNull();
  expect(p.push('data: line2')).toBeNull();
  expect(p.push('')).toEqual({ event: 'foo', data: 'line1\nline2' });
});

test('ignores comments, tolerates CRLF, buffers split chunks', async () => {
  const out = await collect([': ping\r\n', 'data: {"a":1}\r\n\r', '\ndata: hel', 'lo\n\n']);
  expect(out).toEqual([{ data: '{"a":1}' }, { data: 'hello' }]);
});

test('flushes pending frame at EOF without blank line', async () => {
  expect(await collect(['data: tail'])).toEqual([{ data: 'tail' }]);
});
