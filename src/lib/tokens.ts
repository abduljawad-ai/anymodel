const IMAGE_TOKENS = 85;

/** Cheap ~4-chars-per-token heuristic. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}

export function estimateTurnTokens(t: { content: string; imageUrl?: string }): number {
  return estimateTokens(t.content) + (t.imageUrl ? IMAGE_TOKENS : 0);
}
