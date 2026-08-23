import { getProviderMeta } from '../catalog/providers';
import type { AdapterDeps, ProviderAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { CompatibleAdapter } from './compatible';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';

/** Wire format comes from the provider's kind, so any id routes correctly. */
export function createAdapter(providerId: string, deps: AdapterDeps): ProviderAdapter {
  switch (getProviderMeta(providerId)?.kind ?? 'openai') {
    case 'anthropic':
      return new AnthropicAdapter(deps);
    case 'google':
      return new GoogleAdapter(deps);
    case 'compatible':
      return new CompatibleAdapter(deps);
    default:
      return new OpenAIAdapter(deps);
  }
}
