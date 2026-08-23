import { estimateTokens, estimateTurnTokens } from './tokens';

/**
 * Session compaction — a client-side port of the mechanisms proven by
 * Claude Code (tiered compaction, structured delta summaries, hot tail,
 * circuit breaker) and MemGPT (FIFO queue headed by a recursive summary).
 * See docs/research/session-compaction.md.
 */

/** Recent turns always kept verbatim (the "hot tail"). */
export const HOT_TAIL = 6;
/** Smallest eviction batch worth an LLM call. */
export const MIN_EVICT = 2;
/** Tokens reserved for the summary itself so it fits after compaction. */
export const SUMMARY_HEADROOM = 700;

export interface TurnLike {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

export interface Split {
  evicted: Array<TurnLike & { index: number }>;
  keptFrom: number; // index into the original array where verbatim context resumes
}

export function estimateHistoryTokens(turns: readonly TurnLike[]): number {
  return turns.reduce((n, t) => n + estimateTurnTokens(t), 0);
}

/**
 * Pick the oldest runs of turns to evict so the remainder fits `budget`.
 * Returns null when nothing needs doing (or nothing CAN be evicted —
 * the hot tail is untouchable).
 */
export function splitForCompaction(turns: readonly TurnLike[], budget: number): Split | null {
  const total = estimateHistoryTokens(turns);
  const target = budget - SUMMARY_HEADROOM;
  if (total <= target) return null;

  const maxEvictable = turns.length - HOT_TAIL;
  if (maxEvictable < MIN_EVICT) return null; // too small to compact

  let acc = 0;
  let cut = 0;
  for (let i = 0; i < maxEvictable; i++) {
    acc += estimateTurnTokens(turns[i]);
    cut = i + 1;
    // Enough freed once remaining tail fits comfortably.
    if (total - acc <= target) break;
  }
  if (cut < MIN_EVICT) return null;

  return {
    evicted: turns.slice(0, cut).map((t, i) => ({ ...t, index: i })),
    keptFrom: cut,
  };
}

/**
 * The structured-summary contract (adapted from Claude Code's nine-section
 * compaction prompt to plain chat). Delta-style: folds new turns into the
 * previous summary instead of reprocessing full history.
 */
export function memoryPrompt(prevSummary: string, segment: string): string {
  const prev = prevSummary.trim()
    ? `MEMORY SO FAR (merge, don't repeat):\n${prevSummary.trim()}\n\n`
    : '';
  return `${prev}NEW CONVERSATION SEGMENT:\n${segment}\n\nCompress everything above into one dense continuation memory (max ~220 words) so a assistant can resume this exact conversation without re-reading it. Use short labeled lines covering ONLY what applies:\n- Intent: what the user wants\n- Facts: names, numbers, constraints worth keeping\n- Decisions: what was chosen/rejected and why\n- Code/artifacts: identifiers, files, commands mentioned\n- Open: unresolved questions or threads\n- Next: the immediate next step\nOutput only the memory lines.`;
}

/** Emergency fallback: plain-text truncation notice when the LLM call fails twice. */
export function truncationNotice(count: number, chars: number): string {
  return `[${count} earlier turns dropped after compaction failure; ~${Math.round(chars / 4)} tokens freed]`;
}

/** Rough size helper reused by callers. */
export function textTokens(text: string): number {
  return estimateTokens(text);
}
