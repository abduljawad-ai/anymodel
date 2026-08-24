import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

function languageExt(lang: string) {
  const l = lang.toLowerCase();
  if (l.includes('html')) return [html()];
  if (l.includes('css')) return [css()];
  if (l.includes('ts')) return [javascript({ typescript: true })];
  if (l.includes('js') || l.includes('javascript') || l.includes('jsx')) return [javascript({ jsx: true })];
  if (l.includes('json')) return [javascript()];
  return [];
}

interface EditorProps {
  code: string;
  language: string;
  onChange(code: string): void;
}

/** CodeMirror 6 editor themed with the Relay design tokens. */
export function Editor({ code, language, onChange }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: code,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          ...languageExt(language),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
          EditorView.theme({
            '&': { fontSize: '13px', backgroundColor: 'transparent', color: 'var(--ink)', height: '100%' },
            '.cm-scroller': {
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.55',
              overflow: 'auto',
            },
            '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
              backgroundColor: 'var(--accent-soft)',
            },
            '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--paper) 60%, transparent)' },
            '.cm-gutters': {
              backgroundColor: 'transparent',
              color: 'var(--muted)',
              border: 'none',
              paddingLeft: '6px',
            },
            '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create only when the buffer identity changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, code === '' /* recreate on hard reset */]);

  // External code swap (e.g. switching buffers) — replace doc without recreating.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  return <div className="ide-editor" ref={hostRef} />;
}
