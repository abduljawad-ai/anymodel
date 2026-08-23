import { memo, useMemo, useState } from 'react';
import { PROVIDERS } from '../../catalog/providers';
import { listModels, isChatCapable, type ModelInfo } from '../../catalog';
import { renderMarkdown } from '../../lib/markdown';
import { toast } from '../../lib/toast';
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
  for (const p of Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>) {
    for (const m of listModels(p)) if (isChatCapable(m)) candidates.push(m);
  }
  return (
    <div className="handoff-menu" role="menu">
      {candidates
        .filter((m) => m.providerId !== activeProvider || m.id !== '')
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
            <span className="tint-dot" style={{ ['--tint' as string]: PROVIDERS[m.providerId].tint, marginRight: 6 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.label}</span>
          </button>
        ))}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ turn }: { turn: Turn }) {
  const [handoffOpen, setHandoffOpen] = useState(false);
  const md = useMemo(() => renderMarkdown(turn.content), [turn.content]);
  const tint = turn.providerId ? PROVIDERS[turn.providerId].tint : undefined;

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
      ) : (
        <div
          className={`msg-content ${turn.streaming ? 'caret' : ''}`}
          ref={(el) => {
            if (el && turn.content) enhance(el);
          }}
          dangerouslySetInnerHTML={{ __html: md }}
        />
      )}

      {!!turn.tokensEst && !turn.streaming && (
        <div className="msg-meta">
          <span>~{turn.tokensEst} tok</span>
        </div>
      )}
    </div>
  );
});
