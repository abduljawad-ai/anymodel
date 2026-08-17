/**
 * Provider adapter factory — returns the correct adapter instance
 * based on the provider's format field.
 *
 * @param {object} provider    — { id, name, api, format, models }
 * @param {string} apiKey      — decrypted API key
 * @param {string} customBase  — override base URL from settings
 * @returns {ProviderAdapter}
 */

import { OpenAIAdapter } from "./OpenAIAdapter.js";
import { AnthropicAdapter } from "./AnthropicAdapter.js";
import { GoogleAdapter } from "./GoogleAdapter.js";

export function createAdapter(provider, apiKey, customBase) {
  const format = provider?.format || "openai";

  if (format === "anthropic") {
    return new AnthropicAdapter(provider, apiKey, customBase);
  }
  if (format === "google") {
    return new GoogleAdapter(provider, apiKey, customBase);
  }
  return new OpenAIAdapter(provider, apiKey, customBase);
}
