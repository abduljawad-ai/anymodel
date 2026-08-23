import { memo, useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { isChatCapable, cachedModels } from '../../catalog';
import type { ModelInfo } from '../../catalog/types';
import { getProviderMeta, listProviders } from '../../catalog/providers';
import { renderMarkdown } from '../../lib/markdown';
import { toast } from '../../lib/toast';
import { playBlob, stopAudio } from '../../lib/audioBus';
import { createAdapter } from '../../adapters/factory';
import { resolveDeps } from '../../vault/gate';
import { useVaultStore } from '../../vault/vaultStore';
import { useSessionStore, type Turn } from '../../state/sessionStore';
import { useUiStore } from '../../state/uiStore';
import { regenerate, editAndResend } from './useSend';

/** Post-process rendered markdown: highlight code + language header + copy. */
function enhance(container: HTMLDivElement): void {
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const code = pre.querySelector('code');
    let lang = '';
    if (code && !code.dataset.hlzed) {
      code.dataset.hlzed = '1';
      try {
        hljs.highlightElement(code as HTMLElement);
      } catch {
        /* unknown language — stays plain */
      }
      lang = ([...code.classList].find((c) => c.startsWith('language-')) ?? '').slice(9).toUpperCase();
    }
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);

    const head = document.createElement('div');
    head.className = 'code-head';
    const label = document.createElement('span');
    label.textContent = lang || 'CODE';
    const btn = document.createElement('button');
    btn.className = 'btn code-copy';
    btn.style.position = 'static';
    btn.textContent = 'copy';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent ?? '').then(
        () => toast('Code copied'),
        () => toast('Copy failed'),
      );
    });
    head.append(label, btn);
    wrap.append(head, pre);
  });
}

/** 💡 Think box — reasoning above the answer; live while streaming, collapsed after. */
function ThinkBox({ reasoning, live }: { reasoning: string; live: boolean }) {
  const [open, setOpen] = useState(live);
  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);
  return (
    <div className={`think-box ${live ? 'live' : ''}`}>
      <button className="think-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>💡 Think</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {(open || live) && <div className="r-body">{reasoning}</div>}
    </div>
  );
}

function copyText(t: string): void {
  navigator.clipboard.writeText(t).then(
    () => toast('Copied'),
    () => toast('Copy failed'),
  );
}

/** Hover toolbar for the USER bubble: Edit · Copy · Share. */
function UserActions({ turn }: { turn: Turn }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(turn.content);
  const sid = useSessionStore((s) => s.activeId);

  function share(): void {
    copyText(`"${turn.content}"\n— via Relay`);
  }

  if (editing) {
    return (
      <div className="user-edit">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void editAndResend(sid!, turn.id, draft.trim());
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-primary"
            onClick={() => void editAndResend(sid!, turn.id, draft.trim())}
          >
            Save & resend ↻
          </button>
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-actions user-actions">
      <button onClick={() => setEditing(true)} title="Edit & resend">
        ✏️ Edit
      </button>
      <button onClick={() => copyText(turn.content)} title="Copy">
        ⧉ Copy
      </button>
      <button onClick={share} title="Share">
        ↗ Share
      </button>
    </div>
  );
}

/** Action row under an ASSISTANT message. */
function AssistantActions({ turn }: { turn: Turn }) {
  const sid = useSessionStore((s) => s.activeId);
  const hasTtsKey = useVaultStore((s) => !!s.keys.openai);
  const [speaking, setSpeaking] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  useEffect(
    () => () => {
      if (speaking) stopAudio();
    },
    [speaking],
  );

  async function speak(): Promise<void> {
    if (!turn.providerId) return;
    if (speaking) {
      stopAudio();
      setSpeaking(false);
      return;
    }
    try {
      setSpeaking(true);
      // Use the turn's provider if it's OpenAI (TTS-capable), otherwise fallback to OpenAI.
      const ttsProvider = turn.providerId === 'openai' ? 'openai' : 'openai';
      const blob = await createAdapter(ttsProvider, resolveDeps(ttsProvider)).speak(turn.content, 'tts-1');
      await playBlob(blob);
      setSpeaking(false);
    } catch (e) {
      setSpeaking(false);
      toast(e instanceof Error ? e.message : 'Speech failed — check your OpenAI key');
    }
  }

  function feedback(v: 'up' | 'down'): void {
    if (!sid) return;
    useSessionStore.getState().patchTurn(sid, turn.id, {
      feedback: turn.feedback === v ? undefined : v,
    });
    toast(v === 'up' ? 'Thanks — noted' : 'Noted — helps tuning');
  }

  /** Handoff candidates from already-loaded catalogs. */
  const candidates: ModelInfo[] = [];
  for (const p of listProviders()) {
    for (const m of cachedModels(p.id)) if (isChatCapable(m)) candidates.push(m);
  }

  return (
    <div className="msg-actions row">
      <button title="Copy reply" onClick={() => copyText(turn.content)}>
        ⧉
      </button>
      <button title="Regenerate" onClick={() => void regenerate()}>
        ↻
      </button>
      <button title="Share (copy quote)" onClick={() => copyText(`"${turn.content.slice(0, 280)}"\n— ${turn.modelId} via Relay`)}>
        ↗
      </button>
      <button
        title="Good reply"
        className={turn.feedback === 'up' ? 'active' : ''}
        onClick={() => feedback('up')}
      >
        👍
      </button>
      <button
        title="Bad reply"
        className={turn.feedback === 'down' ? 'active' : ''}
        onClick={() => feedback('down')}
      >
        👎
      </button>

      <span style={{ position: 'relative' }}>
        <button title="Hand off to another model" onClick={() => setHandoffOpen((o) => !o)}>
          ⚡
        </button>
        {handoffOpen && (
          <div className="handoff-menu" role="menu">
            {candidates
              .filter((m) => m.providerId !== turn.providerId)
              .slice(0, 10)
              .map((m) => (
                <button
                  key={`${m.providerId}/${m.id}`}
                  onClick={() => {
                    useUiStore.getState().setActiveModel({ providerId: m.providerId, modelId: m.id });
                    toast(`Next reply handed to ${m.label}`);
                    setHandoffOpen(false);
                  }}
                >
                  <span
                    className="tint-dot"
                    style={{ ['--tint' as string]: getProviderMeta(m.providerId)?.tint, marginRight: 6 }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.label}</span>
                </button>
              ))}
          </div>
        )}
      </span>

      {hasTtsKey && (
        <button className={`tts-chip ${speaking ? 'playing' : ''}`} onClick={() => void speak()} title="Read aloud">
          {speaking ? '◼ stop' : '▶ listen'}
        </button>
      )}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ turn }: { turn: Turn }) {
  const md = useMemo(() => renderMarkdown(turn.content), [turn.content]);
  const tint = turn.providerId ? getProviderMeta(turn.providerId)?.tint : undefined;

  // Kimi-style think box: live while reasoning streams, collapsed once prose starts.
  const showThinkBox = !!turn.reasoning;
  const thinkLive = !!turn.streaming && !turn.content;

  if (turn.role === 'user') {
    return (
      <div className="turn-user-group">
        <div className="turn-user">
          {turn.imageUrl && <img className="msg-img" src={turn.imageUrl} alt="attachment" />}
          <div className="msg-content" style={{ whiteSpace: 'pre-wrap' }}>
            {turn.content}
          </div>
        </div>
        <UserActions turn={turn} />
      </div>
    );
  }

  return (
    <div className="turn-assistant" style={tint ? ({ ['--tint' as string]: tint } as React.CSSProperties) : undefined}>
      <div className="msg-badge-row">
        {turn.modelId && turn.providerId && (
          <span className="chip">
            <span className="tint-dot" style={{ ['--tint' as string]: tint }} />
            {turn.modelId}
          </span>
        )}
        {turn.streaming && <span className="chip">streaming…</span>}
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
        <>
          {showThinkBox && <ThinkBox reasoning={turn.reasoning!} live={thinkLive} />}
          {turn.streaming && !turn.content && !turn.reasoning && (
            <span className="shimmer">Connecting…</span>
          )}
          {(turn.content || !turn.streaming) && (
            <div
              className={`msg-content ${turn.streaming ? 'caret' : ''}`}
              ref={(el) => {
                if (el && turn.content) enhance(el);
              }}
              dangerouslySetInnerHTML={{ __html: md }}
            />
          )}
        </>
      )}

      {!!turn.tokensEst && turn.tokensEst > 50 && !turn.streaming && (
        <div className="msg-meta">
          <span>~{turn.tokensEst} tok</span>
        </div>
      )}

      {!turn.streaming && !turn.error && <AssistantActions turn={turn} />}
    </div>
  );
});
