// Complete no-op without a key — nothing is sent, and posthog-js is never
// even downloaded (same lazy-load reasoning as lib/errorTracking.ts).
// Set VITE_POSTHOG_KEY (Vercel env vars, not committed) to turn this on.
// VITE_POSTHOG_HOST defaults to PostHog Cloud US; override for EU/self-hosted.
type PostHogModule = typeof import('posthog-js');
let posthog: PostHogModule['default'] | null = null;

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  import('posthog-js').then((module) => {
    const client = module.default;
    client.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
    });
    posthog = client;
  });
}

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  posthog?.capture(name, properties);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  posthog?.identify(userId, traits);
}

// Call on sign-out — clears the identified user so the next session
// (possibly a different person on a shared device) doesn't inherit it.
export function resetAnalytics(): void {
  posthog?.reset();
}
