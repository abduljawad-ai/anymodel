import { useState } from 'react';
import { invalidate } from '../../../catalog';
import { isAllowedBase } from '../../../adapters/base';
import { loadSettings, saveSettings } from '../../../state/settings';
import { toast } from '../../../lib/toast';

/** Add any OpenAI-compatible endpoint as a first-class provider. */
export function AddProviderRow({ onAdded }: { onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [base, setBase] = useState('');

  function save() {
    const id = name.trim().toLowerCase().replace(/\W+/g, '-').slice(0, 40);
    const url = base.trim().replace(/\/+$/, '');
    if (!id || !url) {
      toast('Name and base URL required.');
      return;
    }
    if (!isAllowedBase(url)) {
      toast('Base must be https (localhost exempt).');
      return;
    }
    const cur = loadSettings().customProviders.filter((c) => c.id !== id);
    saveSettings({ customProviders: [...cur, { id, name: name.trim(), baseUrl: url }] });
    setName('');
    setBase('');
    setAdding(false);
    invalidate(id);
    toast(`${name.trim()} added`);
    onAdded();
  }

  if (!adding)
    return (
      <button className="prov-row-line" style={{ borderStyle: 'dashed', color: 'var(--muted)' }} onClick={() => setAdding(true)}>
        ＋ Add custom provider
      </button>
    );

  return (
    <div className="prov-detail" style={{ borderTop: '1px solid var(--hairline)', marginTop: 6 }}>
      <strong>Add custom provider</strong>
      <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="https://host/v1" value={base} onChange={(e) => setBase(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={save}>
          Save provider
        </button>
        <button className="btn" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
