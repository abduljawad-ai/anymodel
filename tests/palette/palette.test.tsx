import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette } from '../../src/features/palette/Palette';
import { useUiStore } from '../../src/state/uiStore';

function openPalette() {
  useUiStore.getState().setPaletteOpen(true);
  return render(<Palette />);
}

test('default list shows chat-capable models grouped by provider', () => {
  localStorage.clear();
  openPalette();
  expect(screen.getByText('OpenAI')).toBeInTheDocument();
  expect(screen.getByText('GPT-4o')).toBeInTheDocument();
  // whisper is stt-only → hidden by default
  expect(screen.queryByText('Whisper STT')).not.toBeInTheDocument();
});

test('capability synonyms surface the right models', async () => {
  const user = userEvent.setup();
  localStorage.clear();
  openPalette();
  await user.type(screen.getByLabelText('Search models'), 'vision');
  expect(screen.getByText('GPT-4o')).toBeInTheDocument();
  // o3-mini has no vision cap
  expect(screen.queryByText('o3-mini')).not.toBeInTheDocument();

  await user.clear(screen.getByLabelText('Search models'));
  await user.type(screen.getByLabelText('Search models'), 'whisper');
  expect(screen.getByText('Whisper STT')).toBeInTheDocument();
});

test('enter selects and closes, updating active model', async () => {
  const user = userEvent.setup();
  localStorage.clear();
  const ui = useUiStore.getState();
  render(<Palette />);

  await user.type(screen.getByLabelText('Search models'), 'claude sonnet{Enter}');
  expect(useUiStore.getState().paletteOpen).toBe(false);
  expect(ui).toBeDefined();
  expect(useUiStore.getState().activeModel.providerId).toBe('anthropic');
});
