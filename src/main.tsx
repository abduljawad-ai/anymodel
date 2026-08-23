import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Apply saved theme before first paint (no-flash).
document.documentElement.dataset.theme = 'light';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
