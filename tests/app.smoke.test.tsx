import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { useVaultStore } from '../src/vault/vaultStore';
import { idbClear } from '../src/vault/idb';

beforeEach(async () => {
  localStorage.clear();
  await idbClear();
});

test('fresh visitor sees the setup wizard', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/One thread\. Every model\./)).toBeInTheDocument();
  });
});

test('unlocked vault reveals the app shell', async () => {
  useVaultStore.getState().init();
  // Wait for async IndexedDB init
  await new Promise((r) => setTimeout(r, 50));
  await useVaultStore.getState().createVault('password1');
  await useVaultStore.getState().setKey('openai', 'sk-x');
  render(<App />);
  await waitFor(() => {
    expect(screen.getByTestId('app-root')).toBeInTheDocument();
  });
});
