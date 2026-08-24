import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IDEPanel, openInIDE } from '../../src/ide/IDEPanel';
import { useIDEStore } from '../../src/ide/ideStore';

// CodeMirror needs real layout — mock the editor component.
vi.mock('../../src/ide/Editor', () => ({
  Editor: ({ code }: { code: string }) => <div data-testid="mock-editor">{code}</div>,
}));

describe('IDEPanel', () => {
  beforeEach(() => {
    useIDEStore.setState({ buffers: [], activeId: null, open: false });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<IDEPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the active buffer with editor and actions', () => {
    useIDEStore.getState().openBuffer({ code: '<h1>hi</h1>', language: 'html', title: 't.html' });
    render(<IDEPanel />);
    expect(screen.getByText('t.html')).toBeTruthy();
    expect(screen.getByTestId('mock-editor').textContent).toBe('<h1>hi</h1>');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'To thread' })).toBeTruthy();
  });

  it('switches to preview tab and renders the iframe', () => {
    useIDEStore.getState().openBuffer({ code: '<h1>hi</h1>', language: 'html' });
    render(<IDEPanel />);
    fireEvent.click(screen.getByText('Preview'));
    expect((screen.getByTitle('Live preview') as HTMLIFrameElement).srcdoc).toContain('<h1>hi</h1>');
  });

  it('marks buffer dirty after editing and closes cleanly', () => {
    const id = useIDEStore.getState().openBuffer({ code: 'a', language: 'js' });
    render(<IDEPanel />);
    // simulate edit via store (Editor is mocked)
    useIDEStore.getState().updateCode(id, 'ab');
    expect(useIDEStore.getState().buffers[0].dirty).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close IDE' }));
    expect(useIDEStore.getState().open).toBe(false);
  });

  it('openInIDE opens the panel with the code', () => {
    openInIDE('x = 1', 'js', 'a.js');
    const s = useIDEStore.getState();
    expect(s.open).toBe(true);
    expect(s.buffers[0].title).toBe('a.js');
  });
});
