import { OpenAIAdapter } from './openai';

/**
 * OpenAI-compatible endpoints (Ollama, Groq, OpenRouter, LM Studio…).
 * Identical wire format; base URL + key arrive via AdapterDeps.
 */
export class CompatibleAdapter extends OpenAIAdapter {}
