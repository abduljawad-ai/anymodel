import type { ProviderId } from '../catalog/types';
import { PROVIDERS } from '../catalog/providers';
import { loadSettings } from '../state/settings';

/** Resolve the effective base URL for a provider (custom if set, else default). */
export function effectiveBase(providerId: ProviderId): string {
  const custom = loadSettings().bases[providerId]?.trim();
  return custom || PROVIDERS[providerId].defaultBase;
}

/** https required everywhere except localhost development bases. */
export function isAllowedBase(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
  } catch {
    return false;
  }
}
