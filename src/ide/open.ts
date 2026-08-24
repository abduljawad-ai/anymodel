import { useUiStore } from '../state/uiStore';

/**
 * Lightweight entry for opening code in the IDE — dynamically imports the
 * heavy panel (CodeMirror) only when actually used, keeping it out of the
 * main bundle.
 */
export async function openInIDE(
  code: string,
  language: string,
  title?: string,
  messageId?: string,
): Promise<void> {
  const [{ useIDEStore }, { IDEPanel }] = await Promise.all([
    import('./ideStore'),
    import('./IDEPanel'),
  ]);
  void IDEPanel; // panel mounts via App's Suspense; importing registers the chunk
  useIDEStore.getState().openBuffer({ code, language, title, messageId });
  useUiStore.getState().setView('chat');
}
