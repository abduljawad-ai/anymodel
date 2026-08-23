import { listProviders, getProviderMeta, PROVIDERS, tintFor } from '../../src/catalog/providers';
import { isAllowedBase } from '../../src/adapters/base';
import { normalizeModel } from '../../src/catalog/normalize';

test('directory integrity: unique ids, valid bases, local http exempt only', () => {
  const ids = Object.keys(PROVIDERS);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBeGreaterThanOrEqual(15); // "15 or 20 most used global providers"
  for (const p of Object.values(PROVIDERS)) {
    expect(p.defaultBase).toMatch(/^https?:\/\//);
    expect(isAllowedBase(p.defaultBase)).toBe(true); // https OR localhost
    expect(p.local ? p.defaultBase.startsWith('http://localhost') : true).toBe(true);
  }
});

test('custom providers resolve through the same meta path', () => {
  localStorage.clear();
  saveCustom();
  const m = getProviderMeta('my-relay-box')!;
  expect(m.kind).toBe('compatible');
  expect(listProviders().some((p) => p.id === 'my-relay-box')).toBe(true);
});

test('suggested model ids normalize into usable ModelInfo (selection before fetch)', () => {
  for (const p of Object.values(PROVIDERS)) {
    for (const id of p.popular ?? []) {
      const m = normalizeModel(p.id, id);
      expect(m.label.length).toBeGreaterThan(0);
    }
  }
  expect(tintFor('anything')).toMatch(/^#/);
});

function saveCustom(): void {
  localStorage.setItem(
    'relay.settings.v1',
    JSON.stringify({
      customProviders: [{ id: 'my-relay-box', name: 'My Relay Box', baseUrl: 'https://box.example.com/v1' }],
    }),
  );
}
