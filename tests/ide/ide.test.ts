import { describe, it, expect, beforeEach } from 'vitest';
import { useIDEStore, extFor } from '../../src/ide/ideStore';
import { srcdocFor } from '../../src/ide/Preview';

describe('ideStore', () => {
  beforeEach(() => {
    useIDEStore.setState({ buffers: [], activeId: null, open: false });
  });

  it('opens a buffer and makes it active', () => {
    const id = useIDEStore.getState().openBuffer({ code: '<p>hi</p>', language: 'html' });
    const s = useIDEStore.getState();
    expect(s.buffers).toHaveLength(1);
    expect(s.activeId).toBe(id);
    expect(s.open).toBe(true);
    expect(s.buffers[0].title).toBe('snippet.html');
  });

  it('reuses an identical buffer instead of duplicating', () => {
    useIDEStore.getState().openBuffer({ code: 'const a = 1;', language: 'js' });
    const id2 = useIDEStore.getState().openBuffer({ code: 'const a = 1;', language: 'js' });
    expect(useIDEStore.getState().buffers).toHaveLength(1);
    expect(useIDEStore.getState().activeId).toBe(id2);
  });

  it('updates code and marks dirty', () => {
    const id = useIDEStore.getState().openBuffer({ code: 'a', language: 'js' });
    useIDEStore.getState().updateCode(id, 'ab');
    const buf = useIDEStore.getState().buffers[0];
    expect(buf.code).toBe('ab');
    expect(buf.dirty).toBe(true);
  });

  it('closes a buffer and re-points activeId', () => {
    const id1 = useIDEStore.getState().openBuffer({ code: 'a', language: 'js' });
    const id2 = useIDEStore.getState().openBuffer({ code: 'b', language: 'css' });
    useIDEStore.getState().closeBuffer(id2);
    const s = useIDEStore.getState();
    expect(s.buffers).toHaveLength(1);
    expect(s.activeId).toBe(id1);
  });

  it('closes the panel when the last buffer closes', () => {
    const id = useIDEStore.getState().openBuffer({ code: 'a', language: 'js' });
    useIDEStore.getState().closeBuffer(id);
    expect(useIDEStore.getState().open).toBe(false);
    expect(useIDEStore.getState().activeId).toBeNull();
  });

  it('maps languages to file extensions', () => {
    expect(extFor('html')).toBe('html');
    expect(extFor('css')).toBe('css');
    expect(extFor('typescript')).toBe('ts');
    expect(extFor('javascript')).toBe('js');
    expect(extFor('json')).toBe('json');
    expect(extFor('python')).toBe('py');
    expect(extFor('')).toBe('txt');
  });
});

describe('srcdocFor (live preview sandbox)', () => {
  it('passes HTML through as-is', () => {
    const html = '<!doctype html><html><body><h1>x</h1></body></html>';
    expect(srcdocFor(html, 'html')).toBe(html);
  });

  it('wraps CSS in a style tag with sample content', () => {
    const doc = srcdocFor('h1 { color: red; }', 'css');
    expect(doc).toContain('<style>h1 { color: red; }</style>');
    expect(doc).toContain('<h1>');
  });

  it('wraps JS in a script tag with console mirror', () => {
    const doc = srcdocFor('console.log("hello")', 'javascript');
    expect(doc).toContain('console.log("hello")');
    expect(doc).toContain('window.onerror');
  });

  it('JSON is parsed and logged, not executed', () => {
    const doc = srcdocFor('{"a":1}', 'json');
    expect(doc).toContain('JSON.parse');
    expect(doc).not.toContain('<script>{"a":1}');
  });
});
