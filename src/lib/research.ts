import type { ProviderAdapter, ChatMessage } from '../adapters/types';

/**
 * Deep-research loop — forces ANY model into a reason → search → synthesize
 * cycle with minimum requests (2 completions + ≤2 searches) and compressed
 * findings so token spend stays tiny. Search uses Exa when a key exists;
 * without one the loop still runs as pure multi-step reasoning.
 */

const PLAN_PROMPT = `Answer prep for: "{q}"
First think briefly. Then output ONLY:
<plan>3 bullet approach</plan>
<queries>
q1
q2
q3
</queries>`;
const SYNTH_PROMPT = `You are completing an answer to the user's ORIGINAL question using the research findings below.
Be complete but tight; cite sources inline as [n]. If findings are thin, say what's missing and answer from reasoning.

FINDINGS:
{findings}`;

interface ExaHit {
  title?: string;
  url?: string;
  text?: string;
}

async function exaSearch(key: string, query: string, signal: AbortSignal): Promise<ExaHit[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      numResults: 4,
      contents: { text: { maxCharacters: 700 } },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`exa ${res.status}`);
  return ((await res.json()).results ?? []) as ExaHit[];
}

function streamOnce(
  adapter: ProviderAdapter,
  modelId: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  sink: { onDelta(t: string): void; onReasoning?(t: string): void },
): Promise<string> {
  let out = '';
  return adapter
    .streamChat(
      { model: modelId, messages, maxTokens: 3000 },
      {
        signal,
        onDelta: (d) => {
          out += d;
          sink.onDelta(d);
        },
        onReasoning: (r) => sink.onReasoning?.(r),
        onDone: () => {},
      },
    )
    .then(() => out);
}

export interface ResearchArgs {
  adapter: ProviderAdapter;
  modelId: string;
  history: ChatMessage[];
  question: string;
  exaKey?: string;
  signal: AbortSignal;
  onDelta(t: string): void;
  onReasoning(t: string): void;
}

/** Run the loop; streams plan/reasoning into `onReasoning`, final answer into `onDelta`. */
export async function deepResearch(a: ResearchArgs): Promise<void> {
  const sys: ChatMessage = {
    role: 'system',
    content:
      'You are in deep-research mode. Reason carefully, plan before acting, and synthesize only verified findings.',
  };

  // ---- pass 1: forced plan + queries -------------------------------------
  const planOut = await streamOnce(
    a.adapter,
    a.modelId,
    [...a.history, sys, { role: 'user', content: PLAN_PROMPT.replace('{q}', a.question) }],
    a.signal,
    { onDelta: () => {}, onReasoning: a.onReasoning },
  );

  const queries =
    /<queries>([\s\S]*?)<\/queries>/i
      .exec(planOut)?.[1]?.split('\n')
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 2) ?? [];

  // ---- search (≤2 requests, compressed) -----------------------------------
  const lines: string[] = [];
  if (queries.length === 0) queries.push(a.question.slice(0, 120));
  if (!a.exaKey) {
    lines.push('(no Exa key configured — synthesizing from reasoning alone)');
  } else {
    let n = 1;
    for (const q of queries) {
      try {
        const hits = await exaSearch(a.exaKey, q, a.signal);
        for (const h of hits.slice(0, 4)) {
          const text = (h.text ?? '').replace(/\s+/g, ' ').slice(0, 500);
          lines.push(`[${n++}] ${h.title ?? q} — ${h.url ?? ''}\n${text}`);
        }
      } catch (e) {
        lines.push(`(search failed: ${e instanceof Error ? e.message : e})`);
      }
    }
  }

  // ---- pass 2: synthesis streamed straight into the bubble -----------------
  await streamOnce(
    a.adapter,
    a.modelId,
    [
      ...a.history,
      sys,
      { role: 'user', content: a.question },
      {
        role: 'assistant',
        content: `<plan>${planOut.slice(0, 600)}</plan>\nResearch complete.`,
      },
      { role: 'user', content: SYNTH_PROMPT.replace('{findings}', lines.join('\n\n').slice(0, 6000)) },
    ],
    a.signal,
    { onDelta: a.onDelta, onReasoning: a.onReasoning },
  );
}
