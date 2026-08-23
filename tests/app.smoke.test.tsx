import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { useVaultStore } from '../src/vault/vaultStore';

test('fresh visitor sees the setup wizard', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText(/One thread\. Every model\./)).toBeInTheDocument();
});

test('unlocked vault reveals the app shell', async () => {
  localStorage.clear();
  useVaultStore.getState().init();
  await useVaultStore.getState().createVault('password1');
  await useVaultStore.getState().setKey('openai', 'sk-x');
  render(<App />);
  expect(screen.getByTestId('app-root')).toBeInTheDocument();
});
