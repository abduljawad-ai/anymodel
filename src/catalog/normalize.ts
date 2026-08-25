import type { Capability, ModelInfo, ProviderId } from './types';

const PATTERNS: Array<[Capability, RegExp]> = [
  ['stt', /whisper|transcri|asr|\bstt\b/i],
  ['tts', /\btts\b|speech|speak|voice/i],
  ['reasoning', /(^|[^a-z])o[13]([^0-9]|$)|-r1|reason|think/i],
  ['vision', /gpt-4o|vision|claude-[3-9]|gemini|\bvl\b|llava|multimodal/i],
  ['tools', /function|tool|gpt-4o|claude|gemini/i],
];

export function prettify(id: string): string {
  return id.replace(/[-_:]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Heuristic capability detection from a raw model id. */
export function normalizeModel(providerId: ProviderId, id: string): ModelInfo {
  return {
    id,
    providerId,
    label: prettify(id),
    caps: PATTERNS.filter(([, re]) => re.test(id)).map(([c]) => c),
  };
}
