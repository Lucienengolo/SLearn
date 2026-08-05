import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorFallback from './components/ErrorFallback.tsx';
import { AppErrorBoundary, initErrorTracking } from './lib/errorTracking';
import { initAnalytics } from './lib/analytics';
import { initServiceWorkerUpdates } from './lib/serviceWorkerUpdates';
import './index.css';

initErrorTracking();
initAnalytics();
initServiceWorkerUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
