import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorFallback from './components/ErrorFallback.tsx';
import { AppErrorBoundary, initErrorTracking } from './lib/errorTracking';
import { initAnalytics } from './lib/analytics';
import './index.css';

initErrorTracking();
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
