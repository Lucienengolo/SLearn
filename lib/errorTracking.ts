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

// Exported for call sites whose own failure handling already covers the
// user-facing side (a local error state, a silently-caught background
// write) but would otherwise leave the underlying error invisible in
// production -- e.g. the WhatsApp-contact/tutor-email RPCs added
// 2026-08-06/07, whose errors previously vanished with no monitoring
// signal at all. A no-op when Sentry isn't configured, same as the error
// boundary's own use of this.
export function reportError(error: unknown): void {
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
