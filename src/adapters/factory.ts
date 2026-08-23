import type { ProviderId } from '../catalog/types';
import type { AdapterDeps, ProviderAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { CompatibleAdapter } from './compatible';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';

export function createAdapter(providerId: ProviderId, deps: AdapterDeps): ProviderAdapter {
  switch (providerId) {
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
