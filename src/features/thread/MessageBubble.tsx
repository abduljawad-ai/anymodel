import { memo, useState } from 'react';
import { Copy, RefreshCw, Share2, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight } from 'lucide-react';
import type { Turn } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { renderMarkdown } from '../../lib/markdown';
import { toast } from '../../lib/toast';
import { IconButton } from '../../ui/IconButton';

export const MessageBubble = memo(function MessageBubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === 'user';
  const isAssistant = turn.role === 'assistant';
  const [thinkOpen, setThinkOpen] = useState(false);

  const modelMeta = isAssistant
    ? useUiStore.getState().activeModel
    : null;

  return (
    <div className={`msg msg-${turn.role}`}>
      {/* User message */}
      {isUser && (
        <>
          {turn.imageUrl && (
            <img
              src={turn.imageUrl}
              alt="Attached"
              style={{ maxWidth: 240, maxHeight: 180, borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-2)' }}
            />
          )}
          <div className="msg-content">{turn.content}</div>
          <div className="msg-actions">
            <IconButton
              icon={<Copy size={13} />}
              aria-label="Copy"
              title="Copy"
              onClick={() => {
                navigator.clipboard.writeText(turn.content);
                toast('Copied');
              }}
            />
          </div>
        </>
      )}

      {/* Assistant message */}
      {isAssistant && (
        <>
          <div className="msg-model">
            <span className="tint-dot" />
            {modelMeta?.providerId ?? 'model'}
          </div>

          {turn.streaming && !turn.content && (
            <div className="shimmer">Connecting…</div>
          )}

          {turn.error && (
            <div className="msg-error" role="alert">
              {turn.error.message}
              <button
                className="btn btn-sm btn-secondary"
                style={{ marginTop: 'var(--sp-2)' }}
                onClick={() => toast('Retry not implemented')}
              >
                Retry
              </button>
            </div>
          )}

          {turn.reasoning && (
            <div className="think-box">
              <button
                className="think-toggle"
                onClick={() => setThinkOpen(!thinkOpen)}
                aria-expanded={thinkOpen}
              >
                {thinkOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Thinking
              </button>
              {thinkOpen && <div className="think-content">{turn.reasoning}</div>}
            </div>
          )}

          {turn.content && (
            <div
              className={`msg-content ${turn.streaming ? 'streaming' : ''}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(turn.content) }}
            />
          )}

          {turn.content && (
            <div className="msg-actions">
              <IconButton
                icon={<Copy size={13} />}
                aria-label="Copy"
                title="Copy"
                onClick={() => {
                  navigator.clipboard.writeText(turn.content);
                  toast('Copied');
                }}
              />
              <IconButton
                icon={<RefreshCw size={13} />}
                aria-label="Regenerate"
                title="Regenerate"
                onClick={() => toast('Regenerate')}
              />
              <IconButton
                icon={<Share2 size={13} />}
                aria-label="Share"
                title="Share"
                onClick={() => toast('Share')}
              />
              <IconButton
                icon={<ThumbsUp size={13} />}
                aria-label="Good response"
                title="Good response"
                onClick={() => toast('Thanks for feedback')}
              />
              <IconButton
                icon={<ThumbsDown size={13} />}
                aria-label="Bad response"
                title="Bad response"
                onClick={() => toast('Thanks for feedback')}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});
