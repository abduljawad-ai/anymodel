import { memo, useEffect, useMemo, useState } from 'react';
import { listProviders, getProviderMeta } from '../../catalog/providers';
import { cachedModels, isChatCapable } from '../../catalog';
import type { ModelInfo } from '../../catalog/types';
import { renderMarkdown } from '../../lib/markdown';
import { toast } from '../../lib/toast';
import { playBlob, stopAudio } from '../../lib/audioBus';
import { createAdapter } from '../../adapters/factory';
import { effectiveBase } from '../../adapters/base';
import { useVaultStore } from '../../vault/vaultStore';
import { useSessionStore, type Turn } from '../../state/sessionStore';
import { useUiStore, type ModelRef } from '../../state/uiStore';
import { regenerate } from './useSend';

function enhance(container: HTMLDivElement): void {
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'btn code-copy';
    btn.textContent = 'copy';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent ?? '').then(
        () => toast('Code copied'),
        () => toast('Copy failed'),
      );
    });
    wrap.appendChild(btn);
  });
}

/** Handoff: continue this thread's context with a different model. */
function HandoffMenu({ onClose }: { onClose: () => void }) {
  const activeProvider = useSessionStore((s) =>
    s.sessions.find((x) => x.id === s.activeId),
  )?.modelKey.providerId;
  const candidates: ModelInfo[] = [];
  for (const p of listProviders()) {
    for (const m of cachedModels(p.id)) if (isChatCapable(m)) candidates.push(m);
  }
  return (
    <div className="handoff-menu" role="menu">
      {candidates
        .filter((m) => m.providerId !== activeProvider)
        .slice(0, 12)
        .map((m) => (
          <button
            key={`${m.providerId}/${m.id}`}
            onClick={() => {
              const ref: ModelRef = { providerId: m.providerId, modelId: m.id };
              useUiStore.getState().setActiveModel(ref);
              toast(`Next reply handed to ${m.label}`);
              onClose();
            }}
          >
            <span className="tint-dot" style={{ ['--tint' as string]: getProviderMeta(m.providerId)?.tint, marginRight: 6 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.label}</span>
          </button>
        ))}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ turn }: { turn: Turn }) {
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const md = useMemo(() => renderMarkdown(turn.content), [turn.content]);
  const tint = turn.providerId ? getProviderMeta(turn.providerId)?.tint : undefined;
  const hasTtsKey = useVaultStore((s) => !!s.keys.openai);

  useEffect(
    () => () => {
      if (speaking) stopAudio();
    },
    [speaking],
  );

  async function speak() {
    if (!turn.providerId) return;
    if (speaking) {
      stopAudio();
      setSpeaking(false);
      return;
    }
    const adapter = createAdapter('openai', {
      baseUrl: effectiveBase('openai'),
      apiKey: () => useVaultStore.getState().keys.openai,
    });
    try {
      setSpeaking(true);
      const blob = await adapter.speak(turn.content, 'tts-1');
      await playBlob(blob);
      setSpeaking(false);
    } catch (e) {
      setSpeaking(false);
      toast(e instanceof Error ? e.message : 'Speech failed');
    }
  }

  if (turn.role === 'user') {
    return (
      <div className="turn-user">
        {turn.imageUrl && <img className="msg-img" src={turn.imageUrl} alt="attachment" />}
        <div className="msg-content" style={{ whiteSpace: 'pre-wrap' }}>
          {turn.content}
        </div>
      </div>
    );
  }

  return (
    <div className="turn-assistant" style={tint ? ({ ['--tint' as string]: tint }) : undefined}>
      <div className="msg-badge-row">
        {turn.modelId && turn.providerId && (
          <span className="chip">
            <span className="tint-dot" style={{ ['--tint' as string]: tint }} />
            {turn.modelId}
          </span>
        )}
        {turn.streaming && <span className="chip">streaming…</span>}
        {!turn.streaming && !turn.error && turn.content && hasTtsKey && (
          <button
            className={`tts-chip ${speaking ? 'playing' : ''}`}
            onClick={() => void speak()}
            title="Read aloud (OpenAI TTS)"
          >
            {speaking ? '◼ stop' : '▶ listen'}
          </button>
        )}
        <span style={{ position: 'relative', marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {!turn.streaming && !turn.error && turn.content && (
            <>
              <button
                className="icon-btn"
                title="Regenerate"
                aria-label="Regenerate reply"
                onClick={() => void regenerate()}
              >
                ↻
              </button>
              <button
                className="icon-btn"
                title="Hand off to another model"
                aria-label="Hand off to another model"
                onClick={() => setHandoffOpen((o) => !o)}
              >
                ⚡
              </button>
            </>
          )}
          {handoffOpen && <HandoffMenu onClose={() => setHandoffOpen(false)} />}
        </span>
      </div>

      {turn.error ? (
        <div className="error-card" role="alert">
          <span>
            ⚠ {turn.error.message}
            {turn.error.status ? ` (${turn.error.status})` : ''}
          </span>
          <button className="btn" onClick={() => void regenerate()}>
            Retry
          </button>
        </div>
      ) : turn.streaming && !turn.content ? (
        <span className="shimmer">{turn.reasoning ? 'Thinking…' : 'Connecting…'}</span>
      ) : (
        <>
          {turn.reasoning && (
            <details className="reason">
              <summary>🧠 Reasoning</summary>
              <div className="r-body">{turn.reasoning}</div>
            </details>
          )}
          <div
            className={`msg-content ${turn.streaming ? 'caret' : ''}`}
            ref={(el) => {
              if (el && turn.content) enhance(el);
            }}
            dangerouslySetInnerHTML={{ __html: md }}
          />
        </>
      )}

      {!!turn.tokensEst && !turn.streaming && (
        <div className="msg-meta">
          <span>~{turn.tokensEst} tok</span>
        </div>
      )}
    </div>
  );
});
