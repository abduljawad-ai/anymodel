import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './features/shell/ErrorBoundary';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
// Light mode code highlighting (dark theme override via CSS)
import 'highlight.js/styles/github.css';

// Theme is applied by theme-boot.js (loaded in index.html) before React loads (no FOUC).

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
