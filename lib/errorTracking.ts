import { Component, ReactNode } from 'react';

// Complete no-op without a DSN — nothing is sent, and @sentry/react is
// never even downloaded. The dynamic import only fires when a DSN is
// actually configured, so it doesn't weigh down the main bundle for the
// common case (most deployments, and every preview build) where it's off.
type SentryModule = typeof import('@sentry/react');
let sentryModule: SentryModule | null = null;

export function initErrorTracking(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
    sentryModule = Sentry;
  });
}

function reportError(error: unknown): void {
  sentryModule?.captureException(error);
}

type Props = { children: ReactNode; fallback: ReactNode };
type State = { hasError: boolean };

// A minimal, dependency-free error boundary — always present regardless of
// whether Sentry is configured, so the app degrades gracefully either way.
// Reporting (if enabled) is a side effect, not a requirement for catching.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    reportError(error);
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
